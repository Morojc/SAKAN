import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendRegistrationConfirmationEmail, sendSyndicNewRequestNotification } from '@/lib/email/registration';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      residenceId,
      fullName,
      email,
      phoneNumber,
      apartmentNumber,
      idNumber,
      idDocumentUrl,
    } = body;

    // Validate required fields
    if (!residenceId || !fullName || !email || !phoneNumber || !apartmentNumber || !idNumber || !idDocumentUrl) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAdminClient();

    // Collect all validation errors
    const errors: string[] = [];

    // Check for duplicate email in same residence (verified residents)
    const { data: existingEmail } = await supabase
      .from('profile_residences')
      .select('profile_id, profiles:profile_id(email)')
      .eq('residence_id', residenceId)
      .eq('verified', true)
      .or('verified.eq.false');

    if (existingEmail && existingEmail.some((pr: any) => pr.profiles?.email?.toLowerCase() === email.toLowerCase())) {
      errors.push('This email address is already registered as a verified resident in this residence');
    }

    // Check for duplicate phone number in same residence (verified residents)
    const { data: existingPhone } = await supabase
      .from('profile_residences')
      .select('profile_id, profiles:profile_id(phone_number)')
      .eq('residence_id', residenceId)
      .eq('verified', true);

    if (existingPhone && existingPhone.some((pr: any) => {
      const profilePhone = pr.profiles?.phone_number;
      if (!profilePhone || !phoneNumber) return false;
      // Normalize phone numbers for comparison (remove spaces, dashes, etc.)
      const normalize = (p: string) => p.replace(/[\s\-\(\)]/g, '');
      return normalize(profilePhone) === normalize(phoneNumber);
    })) {
      errors.push('This phone number is already registered as a verified resident in this residence');
    }

    // Check for duplicate apartment number (verified residents)
    const { data: existingApt } = await supabase
      .from('profile_residences')
      .select('id')
      .eq('residence_id', residenceId)
      .eq('apartment_number', apartmentNumber)
      .eq('verified', true)
      .single();

    if (existingApt) {
      errors.push(`Apartment number ${apartmentNumber} is already occupied by a verified resident in this residence`);
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

    // Return all errors at once
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: errors.length === 1 ? errors[0] : 'Multiple issues found with your registration:',
          errors: errors.length > 1 ? errors : undefined
        },
        { status: 400 }
      );
    }

    // Get client IP and user agent
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create registration request
    const { data: newRequest, error } = await supabase
      .from('resident_registration_requests')
      .insert({
        residence_id: residenceId,
        full_name: fullName,
        email,
        phone_number: phoneNumber,
        apartment_number: apartmentNumber,
        id_number: idNumber,
        id_document_url: idDocumentUrl,
        status: 'pending',
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating registration request:', error);
      return NextResponse.json(
        { error: 'Failed to submit registration' },
        { status: 500 }
      );
    }

    // Get residence and syndic info for notifications
    const { data: residence } = await supabase
      .from('residences')
      .select('name, syndic_user_id, profiles:syndic_user_id(email, full_name)')
      .eq('id', residenceId)
      .single();

    // Send confirmation email to applicant
    try {
      await sendRegistrationConfirmationEmail(
        email,
        fullName,
        residence?.name || 'the residence',
        apartmentNumber
      );
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    // Send notification to syndic
    if (residence && (residence.profiles as any)?.email) {
      try {
        await sendSyndicNewRequestNotification(
          (residence.profiles as any).email,
          (residence.profiles as any).full_name || 'Syndic',
          residence.name,
          fullName,
          apartmentNumber
        );
      } catch (emailError) {
        console.error('Error sending syndic notification:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      requestId: newRequest.id,
      message: 'Registration submitted successfully',
    });
  } catch (error: any) {
    console.error('Error in registration submission:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

