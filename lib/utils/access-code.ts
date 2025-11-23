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
  
  // Handle case where RPC might return an array or single object
  const result = Array.isArray(data) ? data[0] : data;
  
  if (!result || !result.code) {
    console.error('Invalid data returned from create_access_code RPC:', data);
    throw new Error('Failed to retrieve created access code');
  }
  
  console.log(`[Access Code] Created code for ${replacementEmail}: ${result.code}`);
  
  return result;
}

/**
 * Validate access code and track failed attempts
 * After 3 failed attempts, the code is automatically deleted for security
 * @param code - The access code to validate
 * @param userEmail - Optional: user's email to verify it matches the replacement email
 * @returns Validation result with attempt information
 */
export async function validateAccessCode(code: string, userEmail?: string) {
  const supabase = createSupabaseAdminClient();
  
  // Use RPC function to bypass RLS policies
  // Note: RPC function returns SETOF (array), so we need to handle it as an array
  const { data, error } = await supabase
    .rpc('get_access_code_by_code', { p_code: code });
    
  if (error) {
    console.error('Error validating access code:', error);
    return { valid: false, message: 'Error validating code', attemptsRemaining: 0 };
  }
  
  // RPC function returns an array (SETOF), get the first element
  const codeData = Array.isArray(data) && data.length > 0 ? data[0] : null;
  
  if (!codeData) {
    return { valid: false, message: 'Invalid code', attemptsRemaining: 0 };
  }
  
  // Check if code has exceeded max failed attempts (3)
  if (codeData.failed_attempts >= 3) {
    // Delete the code for security
    await supabase
      .from('access_codes')
      .delete()
      .eq('id', codeData.id);
    
    console.log(`[Access Code] Code ${code} deleted after 3 failed attempts`);
    return { 
      valid: false, 
      message: 'This code has been invalidated due to too many failed attempts. Please contact the syndic for a new code.',
      attemptsRemaining: 0,
      codeDeleted: true
    };
  }
  
  if (codeData.code_used) {
    return { valid: false, message: 'This code has already been used', attemptsRemaining: 0 };
  }
  
  if (new Date(codeData.expires_at) < new Date()) {
    return { valid: false, message: 'This code has expired', attemptsRemaining: 0 };
  }
  
  // If userEmail is provided, verify it matches the replacement email
  if (userEmail && codeData.replacement_email.toLowerCase() !== userEmail.toLowerCase()) {
    // Increment failed attempts
    const newFailedAttempts = (codeData.failed_attempts || 0) + 1;
    const attemptsRemaining = 3 - newFailedAttempts;
    
    if (attemptsRemaining <= 0) {
      // Delete the code after 3 failed attempts
      await supabase
        .from('access_codes')
        .delete()
        .eq('id', codeData.id);
      
      console.log(`[Access Code] Code ${code} deleted after 3 failed attempts (email mismatch)`);
      return { 
        valid: false, 
        message: 'Email does not match. This code has been invalidated due to too many failed attempts.',
        attemptsRemaining: 0,
        codeDeleted: true
      };
    }
    
    // Update failed attempts count
    await supabase
      .from('access_codes')
      .update({ failed_attempts: newFailedAttempts })
      .eq('id', codeData.id);
    
    return { 
      valid: false, 
      message: `Email does not match. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`,
      attemptsRemaining
    };
  }
  
  // Code is valid - reset failed attempts on successful validation
  if (codeData.failed_attempts > 0) {
    await supabase
      .from('access_codes')
      .update({ failed_attempts: 0 })
      .eq('id', codeData.id);
  }
  
  return { 
    valid: true, 
    data: {
      id: codeData.id,
      replacement_email: codeData.replacement_email,
      residence_id: codeData.residence_id,
      original_user_id: codeData.original_user_id,
      action_type: codeData.action_type
    },
    attemptsRemaining: 3
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
    // Don't throw here to allow the process to continue even if marking as used fails
    // (though it's critical, we don't want to rollback the role change if possible)
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
  
  // Check if code has been invalidated (3 failed attempts)
  if (codeData.failed_attempts >= 3) {
    return {
      exists: true,
      status: 'invalidated',
      message: 'Code has been invalidated due to too many failed attempts',
      failedAttempts: codeData.failed_attempts
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
    failedAttempts: codeData.failed_attempts || 0,
    attemptsRemaining: 3 - (codeData.failed_attempts || 0),
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
        new Date(code.expires_at) > new Date() &&
        (code.failed_attempts || 0) < 3
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
      .lt('failed_attempts', 3)
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

