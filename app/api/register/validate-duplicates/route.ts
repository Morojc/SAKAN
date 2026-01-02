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

    // Get all profile_ids in this residence (verified and unverified)
    const { data: profileResidences } = await supabase
      .from('profile_residences')
      .select('profile_id')
      .eq('residence_id', residenceId);

    let profileIds: string[] = [];
    if (profileResidences && profileResidences.length > 0) {
      profileIds = profileResidences.map((pr: any) => pr.profile_id);
    }

    // Check for duplicate email in same residence
    // Email is stored in users table, not profiles table
    if (profileIds.length > 0) {
      const { data: usersWithEmail } = await supabase
        .from('users')
        .select('id, email')
        .in('id', profileIds)
        .ilike('email', email);

      if (usersWithEmail && usersWithEmail.length > 0) {
        errors.push('This email address is already registered in this residence');
      }
    }

    // Check for duplicate phone number in same residence
    if (profileIds.length > 0) {
      const { data: profilesWithPhone } = await supabase
        .from('profiles')
        .select('id, phone_number')
        .in('id', profileIds)
        .not('phone_number', 'is', null);

      if (profilesWithPhone && profilesWithPhone.length > 0) {
        const normalize = (p: string) => p.replace(/[\s\-\(\)]/g, '');
        const normalizedInputPhone = normalize(phoneNumber);
        
        const phoneExists = profilesWithPhone.some((profile: any) => {
          if (!profile.phone_number) return false;
          return normalize(profile.phone_number) === normalizedInputPhone;
        });

        if (phoneExists) {
          errors.push('This phone number is already registered in this residence');
        }
      }
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

