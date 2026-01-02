import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      residenceId,
      email,
      phoneNumber,
      apartmentNumber,
    } = body;

    // Validate required fields
    if (!residenceId || !email || !phoneNumber || !apartmentNumber) {
      return NextResponse.json(
        { error: 'All fields are required for validation' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAdminClient();

    // Collect all validation errors
    const errors: string[] = [];

    // Check for duplicate email in same residence (verified and unverified residents)
    const { data: existingEmail } = await supabase
      .from('profile_residences')
      .select('profile_id, profiles:profile_id(email)')
      .eq('residence_id', residenceId)
      .or('verified.eq.true,verified.eq.false');

    if (existingEmail && existingEmail.some((pr: any) => pr.profiles?.email?.toLowerCase() === email.toLowerCase())) {
      errors.push('This email address is already registered in this residence');
    }

    // Check for duplicate phone number in same residence (verified and unverified residents)
    const { data: existingPhone } = await supabase
      .from('profile_residences')
      .select('profile_id, profiles:profile_id(phone_number)')
      .eq('residence_id', residenceId)
      .or('verified.eq.true,verified.eq.false');

    if (existingPhone && existingPhone.some((pr: any) => {
      const profilePhone = pr.profiles?.phone_number;
      if (!profilePhone || !phoneNumber) return false;
      // Normalize phone numbers for comparison (remove spaces, dashes, etc.)
      const normalize = (p: string) => p.replace(/[\s\-\(\)]/g, '');
      return normalize(profilePhone) === normalize(phoneNumber);
    })) {
      errors.push('This phone number is already registered in this residence');
    }

    // Check for duplicate apartment number (verified and unverified residents)
    const { data: existingApt } = await supabase
      .from('profile_residences')
      .select('id')
      .eq('residence_id', residenceId)
      .eq('apartment_number', apartmentNumber)
      .or('verified.eq.true,verified.eq.false')
      .maybeSingle();

    if (existingApt) {
      errors.push(`Apartment number ${apartmentNumber} is already occupied in this residence`);
    }

    // Check for pending requests with same email, phone, or apartment
    const { data: pendingRequests } = await supabase
      .from('resident_registration_requests')
      .select('id, email, phone_number, apartment_number')
      .eq('residence_id', residenceId)
      .eq('status', 'pending');

    if (pendingRequests) {
      const emailExists = pendingRequests.some((req: any) => req.email?.toLowerCase() === email.toLowerCase());
      const phoneExists = pendingRequests.some((req: any) => {
        if (!req.phone_number || !phoneNumber) return false;
        const normalize = (p: string) => p.replace(/[\s\-\(\)]/g, '');
        return normalize(req.phone_number) === normalize(phoneNumber);
      });
      const aptExists = pendingRequests.some((req: any) => req.apartment_number === apartmentNumber);

      if (emailExists) {
        errors.push('A registration request with this email address is already pending for this residence');
      }

      if (phoneExists) {
        errors.push('A registration request with this phone number is already pending for this residence');
      }

      if (aptExists) {
        errors.push(`A registration request for apartment ${apartmentNumber} is already pending for this residence`);
      }
    }

    // Return validation result
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: errors.length === 1 ? errors[0] : 'Multiple issues found:',
          errors: errors.length > 1 ? errors : undefined
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Validation passed',
    });
  } catch (error: any) {
    console.error('Error in validation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

