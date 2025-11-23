import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function generateAccessCode(): Promise<string> {
  // Generate a 8-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createAccessCode(
  originalUserId: string,
  replacementEmail: string,
  residenceId: number,
  actionType: 'delete_account' | 'change_role'
) {
  const supabase = createSupabaseAdminClient();
  
  // Generate a unique code
  let code = await generateAccessCode();
  let isUnique = false;
  
  // Ensure code uniqueness
  while (!isUnique) {
    const { data } = await supabase
      .from('access_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle();
      
    if (!data) {
      isUnique = true;
    } else {
      code = await generateAccessCode();
    }
  }
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
  
  // Use database function to bypass RLS
  const { data, error } = await supabase.rpc('create_access_code', {
    p_code: code,
    p_original_user_id: originalUserId,
    p_replacement_email: replacementEmail,
    p_residence_id: residenceId,
    p_action_type: actionType,
    p_expires_at: expiresAt.toISOString(),
  });
    
  if (error) {
    console.error('Error creating access code:', error);
    throw new Error('Failed to create access code');
  }
  
  return data;
}

export async function validateAccessCode(code: string) {
  const supabase = createSupabaseAdminClient();
  
  // Use RPC function to bypass RLS policies
  // Note: RPC function returns SETOF (array), so we need to handle it as an array
  const { data, error } = await supabase
    .rpc('get_access_code_by_code', { p_code: code });
    
  if (error) {
    console.error('Error validating access code:', error);
    return { valid: false, message: 'Error validating code' };
  }
  
  // RPC function returns an array (SETOF), get the first element
  const codeData = Array.isArray(data) && data.length > 0 ? data[0] : null;
  
  if (!codeData) {
    return { valid: false, message: 'Invalid code' };
  }
  
  if (codeData.code_used) {
    return { valid: false, message: 'This code has already been used' };
  }
  
  if (new Date(codeData.expires_at) < new Date()) {
    return { valid: false, message: 'This code has expired' };
  }
  
  return { 
    valid: true, 
    data: {
      replacement_email: codeData.replacement_email,
      residence_id: codeData.residence_id,
      original_user_id: codeData.original_user_id,
      action_type: codeData.action_type
    }
  };
}

export async function markCodeAsUsed(code: string, usedByUserId: string) {
  const supabase = createSupabaseAdminClient();
  
  const { error } = await supabase
    .from('access_codes')
    .update({
      code_used: true,
      used_by_user_id: usedByUserId,
      used_at: new Date().toISOString(),
    })
    .eq('code', code);
    
  if (error) {
    console.error('Error marking code as used:', error);
    throw new Error('Failed to mark code as used');
  }
  
  return true;
}

