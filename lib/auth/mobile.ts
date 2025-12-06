import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Get authenticated user from mobile app request
 * Validates Supabase access token from Authorization header
 */
export async function getMobileUser(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Mobile Auth] No authorization header or invalid format');
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('[Mobile Auth] Token received:', token.substring(0, 20) + '...');

    // If it's a custom OTP token, extract user ID
    if (token.startsWith('otp_verified_')) {
      const userId = token.replace('otp_verified_', '');
      console.log('[Mobile Auth] Custom OTP token detected, user ID:', userId);
      
      const supabase = createSupabaseAdminClient();
      
      // Get user from database
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Mobile Auth] Error fetching user:', error);
        return null;
      }

      if (!user) {
        console.error('[Mobile Auth] User not found for ID:', userId);
        return null;
      }

      console.log('[Mobile Auth] User authenticated:', user.id);
      return {
        id: user.id,
        email: user.email,
      };
    }

    // Validate Supabase JWT token
    const supabase = createSupabaseAdminClient();
    
    // Use Supabase to verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('[Mobile Auth] Error validating Supabase token:', error);
      return null;
    }

    if (!user) {
      console.error('[Mobile Auth] No user found in Supabase token');
      return null;
    }

    console.log('[Mobile Auth] Supabase user authenticated:', user.id);
    return {
      id: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error('[Mobile Auth] Error validating token:', error);
    return null;
  }
}

