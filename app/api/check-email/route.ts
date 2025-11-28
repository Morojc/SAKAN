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

    // Check if the user is a syndic
    let isSyndic = false;
    if (existingUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', existingUser.id)
        .maybeSingle();
      
      isSyndic = profile?.role === 'syndic';
    }

    // Cannot use email if it belongs to a syndic (even if it's the current user)
    const canUse = !emailExists || (belongsToCurrentUser && !isSyndic);

    return NextResponse.json({
      success: true,
      exists: emailExists,
      belongsToCurrentUser: belongsToCurrentUser,
      isSyndic: isSyndic,
      canUse: canUse,
      error: isSyndic ? 'Cannot add a syndic as a resident. Syndics cannot be added to residences as residents.' : null
    });

  } catch (error: any) {
    console.error('[Check Email] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

