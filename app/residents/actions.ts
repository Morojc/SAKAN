'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendResidentOnboardingOTP } from '@/lib/email/verification';

export async function resendOnboardingCode(residentId: string, residentEmail: string, residentName: string) {
  try {
    const supabase = await createSupabaseAdminClient();

    // Generate a new 6-digit code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update the resident's profile with the new code
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        resident_onboarding_code: newCode,
        resident_onboarding_code_expires_at: expiresAt.toISOString(),
      })
      .eq('id', residentId);

    if (updateError) {
      console.error('Error updating resident onboarding code:', updateError);
      return { success: false, error: 'Failed to generate new code' };
    }

    // Send email using the existing helper which sends a nice HTML email
    await sendResidentOnboardingOTP(
      residentEmail,
      newCode,
      residentName
    );

    return { success: true };
  } catch (error) {
    console.error('Error in resendOnboardingCode:', error);
    return { success: false, error: 'Failed to resend code' };
  }
}
