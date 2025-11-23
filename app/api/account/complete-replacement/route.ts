import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateAccessCodeForUser, markCodeAsUsed } from '@/lib/utils/access-code';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

/**
 * POST /api/account/complete-replacement
 * Completes the replacement process by updating role and transferring data
 * Called after code validation when user is already authenticated
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, userEmail } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const email = userEmail || session.user.email;
    const supabase = createSupabaseAdminClient();

    // Validate the code with email
    const validation = await validateAccessCodeForUser(code, email);
    
    if (!validation.valid || !validation.data) {
      return NextResponse.json({ 
        error: 'Invalid code',
        message: validation.message
      }, { status: 400 });
    }

    // If action_type is 'change_role', transfer data from original syndic to this user
    if (validation.data.action_type === 'change_role') {
      console.log(`[Complete Replacement] Transferring syndic data from ${validation.data.original_user_id} to ${session.user.id}`);
      const { transferSyndicData } = await import('@/lib/utils/account-transfer');
      await transferSyndicData(validation.data.original_user_id, session.user.id);
      
      // Change original syndic's role to resident
      await supabase
        .from('profiles')
        .update({ role: 'resident' })
        .eq('id', validation.data.original_user_id);
      
      console.log(`[Complete Replacement] Data transferred and original syndic role changed to resident`);
    }
    
    // Update profile to syndic and link residence
    await supabase
      .from('profiles')
      .update({
        role: 'syndic',
        residence_id: validation.data.residence_id,
        onboarding_completed: true // Implicitly completed as they are taking over
      })
      .eq('id', session.user.id);

    // Mark code as used
    await markCodeAsUsed(code, session.user.id);
    
    return NextResponse.json({ 
      success: true,
      message: 'Replacement completed successfully'
    });
  } catch (error: any) {
    console.error('Error completing replacement:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
