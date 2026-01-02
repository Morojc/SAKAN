'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import { nanoid } from 'nanoid';

export interface QRCodeData {
  qrCode: string;
  registrationUrl: string;
  residenceId: number;
  residenceName: string;
  brandColor: string;
}

export async function generateResidenceQRCode(): Promise<{
  success?: boolean;
  error?: string;
  data?: QRCodeData;
}> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get syndic's residence
  const { data: residence, error: residenceError } = await supabase
    .from('residences')
    .select('id, name, onboarding_qr_code, qr_brand_color')
    .eq('syndic_user_id', session.user.id)
    .single();

  if (residenceError || !residence) {
    return { error: 'Residence not found' };
  }

  // Generate unique code if doesn't exist
  let qrCode = residence.onboarding_qr_code;
  
  if (!qrCode) {
    // Generate unique code: res_{nanoid}
    qrCode = `res_${nanoid(16)}`;
    
    // Save to database
    const { error: updateError } = await supabase
      .from('residences')
      .update({
        onboarding_qr_code: qrCode,
        qr_code_generated_at: new Date().toISOString(),
      })
      .eq('id', residence.id);

    if (updateError) {
      console.error('Error saving QR code:', updateError);
      return { error: 'Failed to generate QR code' };
    }
  }

  // Build full URL using environment variable
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://masksan.com';
  const registrationUrl = `${baseUrl}/register/${qrCode}`;

  return {
    success: true,
    data: {
      qrCode,
      registrationUrl,
      residenceId: residence.id,
      residenceName: residence.name,
      brandColor: residence.qr_brand_color || '#1e40af',
    },
  };
}

export async function regenerateResidenceQRCode(): Promise<{
  success?: boolean;
  error?: string;
  data?: QRCodeData;
}> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get syndic's residence
  const { data: residence, error: residenceError } = await supabase
    .from('residences')
    .select('id, name, qr_brand_color')
    .eq('syndic_user_id', session.user.id)
    .single();

  if (residenceError || !residence) {
    return { error: 'Residence not found' };
  }

  // Generate new unique code
  const newQrCode = `res_${nanoid(16)}`;
  
  // Update in database
  const { error: updateError } = await supabase
    .from('residences')
    .update({
      onboarding_qr_code: newQrCode,
      qr_code_generated_at: new Date().toISOString(),
    })
    .eq('id', residence.id);

  if (updateError) {
    console.error('Error regenerating QR code:', updateError);
    return { error: 'Failed to regenerate QR code' };
  }

  // Build full URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://masksan.com';
  const registrationUrl = `${baseUrl}/register/${newQrCode}`;

  return {
    success: true,
    data: {
      qrCode: newQrCode,
      registrationUrl,
      residenceId: residence.id,
      residenceName: residence.name,
      brandColor: residence.qr_brand_color || '#1e40af',
    },
  };
}

