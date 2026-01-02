import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

interface ValidateQrCodeResponse {
  residence_id: number;
  residence_name: string;
  residence_address: string;
  is_valid: boolean;
  error_message: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = await createSupabaseAdminClient();

  // Validate QR code using database function
  const { data, error } = await supabase
    .rpc('validate_qr_code', { p_qr_code: code })
    .single<ValidateQrCodeResponse>();

  if (error) {
    console.error('Error validating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to validate code' },
      { status: 500 }
    );
  }

  if (!data || !data.is_valid) {
    return NextResponse.json(
      { error: data?.error_message || 'Invalid code' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    residence: {
      id: data.residence_id,
      name: data.residence_name,
      address: data.residence_address,
    },
  });
}

