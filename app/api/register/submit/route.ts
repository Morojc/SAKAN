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

    // Check for duplicate email in same residence (only verified residents)
    const { data: existingEmail } = await supabase
      .from('profile_residences')
      .select('profile_id, profiles:profile_id(email)')
      .eq('residence_id', residenceId)
      .eq('verified', true);

    if (existingEmail && existingEmail.some((pr: any) => pr.profiles?.email === email)) {
      return NextResponse.json(
        { error: 'This email is already registered as a resident in this residence' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'This apartment is already occupied' },
        { status: 400 }
      );
    }

    // Check for pending requests with same email or apartment
    const { data: pendingRequests } = await supabase
      .from('resident_registration_requests')
      .select('id, email, apartment_number')
      .eq('residence_id', residenceId)
      .eq('status', 'pending');

    if (pendingRequests) {
      const emailExists = pendingRequests.some((req: any) => req.email === email);
      const aptExists = pendingRequests.some((req: any) => req.apartment_number === apartmentNumber);

      if (emailExists) {
        return NextResponse.json(
          { error: 'You already have a pending registration request' },
          { status: 400 }
        );
      }

      if (aptExists) {
        return NextResponse.json(
          { error: 'A registration request is pending for this apartment' },
          { status: 400 }
        );
      }
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

