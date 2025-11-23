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
  
  // Store the original generated code - THIS IS THE SOURCE OF TRUTH
  const originalCode = code;
  console.log(`[Access Code] Generated code: "${originalCode}"`);
  
  // Use database function to bypass RLS
  const { data, error } = await supabase.rpc('create_access_code', {
    p_code: originalCode, // Use the original generated code
    p_original_user_id: originalUserId,
    p_replacement_email: replacementEmail,
    p_residence_id: residenceId,
    p_action_type: actionType,
    p_expires_at: expiresAt.toISOString(),
  });
    
  if (error) {
    console.error('[Access Code] Error creating access code:', error);
    throw new Error('Failed to create access code');
  }
  
  // Handle case where RPC might return an array or single object
  const result = Array.isArray(data) ? data[0] : data;
  
  if (!result || !result.id) {
    console.error('[Access Code] Invalid data returned from create_access_code RPC:', data);
    throw new Error('Failed to retrieve created access code');
  }
  
  // CRITICAL: Always use the original generated code, not the one from RPC return
  // This ensures the email and database are guaranteed to match
  result.code = originalCode;
  
  // Verify the code was actually stored correctly in the database
  const { data: verifyData, error: verifyError } = await supabase
    .from('access_codes')
    .select('code, id')
    .eq('id', result.id)
    .maybeSingle();
  
  if (verifyError) {
    console.error('[Access Code] Error verifying code in database:', verifyError);
  } else if (verifyData) {
    if (verifyData.code !== originalCode) {
      console.error(`[Access Code] ❌ CRITICAL MISMATCH DETECTED!`);
      console.error(`[Access Code] Generated code: "${originalCode}"`);
      console.error(`[Access Code] Database code: "${verifyData.code}"`);
      console.error(`[Access Code] Attempting to fix by updating database...`);
      
      // Fix the database by updating it with the correct code
      const { error: updateError } = await supabase
        .from('access_codes')
        .update({ code: originalCode })
        .eq('id', result.id);
      
      if (updateError) {
        console.error(`[Access Code] Failed to fix database code:`, updateError);
        throw new Error(`Database code mismatch and could not be fixed: ${updateError.message}`);
      } else {
        console.log(`[Access Code] ✅ Database code fixed! Updated to: "${originalCode}"`);
      }
    } else {
      console.log(`[Access Code] ✅ Verification passed: Database code matches generated code`);
    }
  }
  
  console.log(`[Access Code] Created code for ${replacementEmail}: ${result.code}`);
  console.log(`[Access Code] Code to be used everywhere: "${originalCode}"`);
  
  return result;
}

/**
 * Validate access code
 * @param code - The access code to validate
 * @param userEmail - Optional: user's email to verify it matches the replacement email
 * @returns Validation result
 */
export async function validateAccessCode(code: string, userEmail?: string) {
  const supabase = createSupabaseAdminClient();
  
  // Use RPC function to bypass RLS policies
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
  
  // If userEmail is provided, verify it matches the replacement email
  if (userEmail && codeData.replacement_email.toLowerCase() !== userEmail.toLowerCase()) {
    return { 
      valid: false, 
      message: 'Email does not match the code recipient.'
    };
  }
  
  return { 
    valid: true, 
    data: {
      id: codeData.id,
      replacement_email: codeData.replacement_email,
      residence_id: codeData.residence_id,
      original_user_id: codeData.original_user_id,
      action_type: codeData.action_type
    }
  };
}

export async function markCodeAsUsed(code: string, usedByUserId: string) {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Try RPC function first (if migration is applied)
    const { data, error: rpcError } = await supabase.rpc('mark_access_code_as_used', {
      p_code: code,
      p_used_by_user_id: usedByUserId
    });
    
    if (!rpcError) {
      return data;
    }
    
    console.log('[markCodeAsUsed] RPC not available, using direct update fallback');
    
    // Fallback to direct update
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
  } catch (error) {
    console.error('[markCodeAsUsed] Unexpected error:', error);
    return false;
  }
}

/**
 * Check the status of an access code
 * Used by the original syndic to check if the replacement user has successfully used the code
 * @param code - The access code to check
 * @returns Status information about the code
 */
export async function checkAccessCodeStatus(code: string) {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .rpc('get_access_code_by_code', { p_code: code });
    
  if (error) {
    console.error('Error checking access code status:', error);
    return { 
      exists: false, 
      status: 'error',
      message: 'Error checking code status'
    };
  }
  
  const codeData = Array.isArray(data) && data.length > 0 ? data[0] : null;
  
  if (!codeData) {
    return { 
      exists: false, 
      status: 'not_found',
      message: 'Code not found'
    };
  }
  
  // Check if code has been used successfully
  if (codeData.code_used) {
    return {
      exists: true,
      status: 'used',
      message: 'Code has been used successfully',
      usedByUserId: codeData.used_by_user_id,
      usedAt: codeData.used_at
    };
  }
  
  // Check if code has expired
  if (new Date(codeData.expires_at) < new Date()) {
    return {
      exists: true,
      status: 'expired',
      message: 'Code has expired',
      expiresAt: codeData.expires_at
    };
  }
  
  // Code is still valid and waiting to be used
  return {
    exists: true,
    status: 'pending',
    message: 'Code is waiting to be used',
    expiresAt: codeData.expires_at
  };
}

/**
 * Delete an access code
 * Used when the original syndic cancels the process
 * @param code - The access code to delete
 * @returns Success status
 */
export async function deleteAccessCode(code: string) {
  const supabase = createSupabaseAdminClient();
  
  // Use RPC function to bypass RLS
  const { data, error } = await supabase.rpc('delete_access_code', {
    p_code: code
  });
    
  if (error) {
    console.error('Error deleting access code:', error);
    throw new Error('Failed to delete access code');
  }
  
  if (!data) {
    console.warn(`[Access Code] Code ${code} not found for deletion`);
    throw new Error('Access code not found');
  }
  
  console.log(`[Access Code] Code ${code} deleted (process cancelled)`);
  return true;
}

/**
 * Check if a user email is a replacement_email in any pending access code
 * @param userEmail - The user's email to check
 * @returns Access code data if found, null otherwise
 */
export async function checkIfReplacementEmail(userEmail: string) {
  try {
    const supabase = createSupabaseAdminClient();
    
    // Try RPC function first (if migration is applied)
    const { data: accessCodesArray, error: rpcError } = await supabase
      .rpc('get_access_codes_by_email', {
        p_email: userEmail.toLowerCase()
      });
    
    // If RPC works, use it
    if (!rpcError && accessCodesArray) {
      if (accessCodesArray.length === 0) {
        return null;
      }
      
      // Filter and sort in code since RPC might return multiple
      const validCodes = accessCodesArray.filter((code: any) => 
        !code.code_used && 
        new Date(code.expires_at) > new Date()
      );
      
      if (validCodes.length === 0) {
        return null;
      }
      
      // Sort by created_at descending and return the most recent
      validCodes.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      return validCodes[0];
    }
    
    // Fallback: If RPC doesn't exist or fails, try direct query with admin client
    console.log('[checkIfReplacementEmail] RPC not available, using direct query fallback');
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('replacement_email', userEmail.toLowerCase())
      .eq('code_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('[checkIfReplacementEmail] Direct query error (RLS might be blocking):', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[checkIfReplacementEmail] Unexpected error:', error);
    return null;
  }
}

/**
 * Validate access code specifically for a user (by email)
 * @param inputCode - The access code entered by the user
 * @param userEmail - The user's email
 * @returns Validation result
 */
export async function validateAccessCodeForUser(inputCode: string, userEmail: string) {
  const supabase = createSupabaseAdminClient();
  
  // 1. Find the pending access code for this user
  const codeData = await checkIfReplacementEmail(userEmail);
  
  if (!codeData) {
    return { valid: false, message: 'No pending access code found for this email' };
  }
  
  // 2. Check general validity (expiry, used status)
  if (codeData.code_used) {
    return { valid: false, message: 'This code has already been used' };
  }
  
  if (new Date(codeData.expires_at) < new Date()) {
    return { valid: false, message: 'This code has expired' };
  }
  
  // 3. Validate the input code against the actual code
  // Case insensitive comparison
  if (inputCode.toUpperCase() !== codeData.code.toUpperCase()) {
    return { 
      valid: false, 
      message: 'Invalid code. Please check and try again.'
    };
  }
  
  // 4. Code matches!
  return { 
    valid: true, 
    data: {
      id: codeData.id,
      replacement_email: codeData.replacement_email,
      residence_id: codeData.residence_id,
      original_user_id: codeData.original_user_id,
      action_type: codeData.action_type
    }
  };
}
