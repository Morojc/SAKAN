import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/check-email
 * Check if an email already exists in the database
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ 
        success: false,
        error: 'Email is required' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Check if email exists
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[Check Email] Error checking email:', error);
      return NextResponse.json({ 
        success: false,
        error: 'Error checking email' 
      }, { status: 500 });
    }

    const emailExists = !!existingUser;
    const belongsToCurrentUser = existingUser?.id === session.user.id;

    // Check if the user is a syndic and get their managed residence
    let isSyndic = false;
    let existingRole: string | null = null;
    let managedResidenceId: number | null = null;
    if (existingUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', existingUser.id)
        .maybeSingle();
      
      existingRole = profile?.role || null;
      isSyndic = existingRole === 'syndic';
      
      // If syndic, get their managed residence
      if (isSyndic) {
        const { data: residence } = await supabase
          .from('residences')
          .select('id')
          .eq('syndic_user_id', existingUser.id)
          .maybeSingle();
        
        managedResidenceId = residence?.id || null;
      }
    }

    // Get the current user's managed residence (to check if we're trying to add to their own residence)
    let currentUserManagedResidenceId: number | null = null;
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if (currentUserProfile?.role === 'syndic') {
      const { data: currentUserResidence } = await supabase
        .from('residences')
        .select('id')
        .eq('syndic_user_id', session.user.id)
        .maybeSingle();
      
      currentUserManagedResidenceId = currentUserResidence?.id || null;
    }

    // Get residence_id from request body if provided
    const { residence_id } = body;
    
    // Check if syndic is adding themselves to their own residence
    let isAddingSelf = false;
    let errorMessage: string | null = null;
    
    // Check if user exists in another residence (to determine if only apartment number can be updated)
    let existsInOtherResidence = false;
    let existingProfileData: { full_name: string; phone_number: string | null } | null = null;
    
    // If user exists, always fetch profile data (for any existing resident)
    // This allows us to extract existing data and only allow apartment number input
    if (existingUser) {
      // Fetch profile data to show in read-only fields
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', existingUser.id)
        .maybeSingle();
      
      if (profile) {
        existingProfileData = {
          full_name: profile.full_name,
          phone_number: profile.phone_number,
        };
      }
      
      // Check if user already exists in another residence (different from current)
      if (residence_id) {
        const targetResidenceId = Number(residence_id);
        
        const { data: existingResidences } = await supabase
          .from('profile_residences')
          .select('residence_id')
          .eq('profile_id', existingUser.id)
          .neq('residence_id', targetResidenceId);
        
        if (existingResidences && existingResidences.length > 0) {
          existsInOtherResidence = true;
        }
      }
    }
    
    console.log('[Check Email API] Detection check:', {
      existingUser: !!existingUser,
      belongsToCurrentUser,
      isSyndic,
      residence_id,
      managedResidenceId,
      currentUserManagedResidenceId,
      sessionUserId: session.user.id,
      existsInOtherResidence
    });
    
    if (existingUser && belongsToCurrentUser && isSyndic && residence_id && managedResidenceId) {
      // Check if they're adding themselves to their own managed residence
      const residenceIdNum = Number(residence_id);
      console.log('[Check Email API] Comparing residences:', {
        residenceIdNum,
        managedResidenceId,
        match: residenceIdNum === managedResidenceId
      });
      
      if (residenceIdNum === managedResidenceId) {
        // Note: We don't check for existing resident link here because:
        // 1. We allow multiple entries per residence (different apartments)
        // 2. The apartment number is not available at this point in the flow
        // 3. Duplicate check based on apartment number happens in createResident action
        
        // Syndic is adding themselves to their own residence
        // Allow it - duplicate check will happen later based on apartment number
        isAddingSelf = true;
        console.log('[Check Email API] Setting isAddingSelf = true - syndic adding themselves');
      }
    }

    // Can use email if:
    // 1. Email doesn't exist (new user), OR
    // 2. Email exists (existing user can be added to different residences)
    // A resident can be added by different syndics in different residences
    // The only restriction is if they're already in THIS specific residence with THIS apartment
    // (which is checked in createResident action)
    // Note: Duplicate check based on apartment number happens in createResident action
    const canUse = true; // Always allow - existing users can be added to different residences

    return NextResponse.json({
      success: true,
      exists: emailExists,
      belongsToCurrentUser: belongsToCurrentUser,
      isSyndic: isSyndic,
      existingRole: existingRole, // Return existing role so frontend can lock it
      isAddingSelf: isAddingSelf, // Flag to indicate syndic is adding themselves
      existsInOtherResidence: existsInOtherResidence, // Flag to indicate user exists in another residence
      existingProfileData: existingProfileData, // Profile data to show in read-only fields
      canUse: canUse,
      error: errorMessage
    });

  } catch (error: any) {
    console.error('[Check Email] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

