import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateAccessCode, markCodeAsUsed } from '@/lib/utils/access-code';
import { transferSyndicData } from '@/lib/utils/account-transfer';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

/**
 * POST /api/account/validate-code
 * Validates the access code entered by the syndic and completes the role change process
 * This is called after the replacement user has used the code to sign in
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    // Validate the access code
    const validation = await validateAccessCode(code);

    if (!validation.valid) {
      return NextResponse.json({ 
        error: validation.message || 'Invalid access code',
        valid: false 
      }, { status: 400 });
    }

    const codeData = validation.data!;
    const supabase = createSupabaseAdminClient();

    // Verify this code belongs to the current user (syndic)
    const { data: codeRecord, error: codeError } = await supabase
      .from('access_codes')
      .select('original_user_id, action_type, code_used')
      .eq('code', code)
      .maybeSingle();

    if (codeError || !codeRecord) {
      return NextResponse.json({ error: 'Access code not found' }, { status: 404 });
    }

    if (codeRecord.original_user_id !== session.user.id) {
      return NextResponse.json({ 
        error: 'This access code does not belong to you' 
      }, { status: 403 });
    }

    if (codeRecord.code_used) {
      return NextResponse.json({ 
        error: 'This access code has already been used' 
      }, { status: 400 });
    }

    if (codeRecord.action_type !== 'change_role') {
      return NextResponse.json({ 
        error: 'This endpoint is only for role change validation' 
      }, { status: 400 });
    }

    // Check if the replacement user has already used the code (signed in)
    // First, get the replacement user's ID from the users table by email
    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    const { data: replacementUser, error: userError } = await dbasakanClient
      .from('users')
      .select('id')
      .eq('email', codeData.replacement_email)
      .maybeSingle();

    if (userError || !replacementUser) {
      console.error('[Validate Code] Error fetching replacement user:', userError);
      return NextResponse.json({ 
        error: 'Replacement user not found. They may not have signed up yet.',
        waitingForReplacement: true
      }, { status: 400 });
    }

    const replacementUserId = replacementUser.id;

    // Check if replacement user's profile has been updated to syndic (meaning they signed in with the code)
    const { data: replacementProfile, error: replacementError } = await supabase
      .from('profiles')
      .select('id, role, residence_id')
      .eq('id', replacementUserId)
      .maybeSingle();

    if (replacementError) {
      console.error('[Validate Code] Error fetching replacement profile:', replacementError);
      return NextResponse.json({ 
        error: 'Error checking replacement user status' 
      }, { status: 500 });
    }

    // Check if replacement user has signed in and their role was updated
    // This happens in the NextAuth createUser/signIn events
    if (!replacementProfile || replacementProfile.role !== 'syndic') {
      return NextResponse.json({ 
        error: 'The replacement user has not yet signed in with the access code. Please wait for them to complete the sign-in process.',
        waitingForReplacement: true
      }, { status: 400 });
    }

    // Replacement user has signed in and role was updated
    // Now complete the process: transfer data and change original user's role

    // 1. Transfer all syndic data to replacement user
    await transferSyndicData(session.user.id, replacementUserId);

    // 2. Cancel subscriptions for original user
    const { getCustomerByUserId } = await import('@/lib/stripe/services/customer.service');
    const { stripe } = await import('@/utils/stripe');
    
    try {
      const customer = await getCustomerByUserId(session.user.id);
      if (customer) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 100,
        });
        for (const subscription of subscriptions.data) {
          if (subscription.status === 'active') {
            await stripe.subscriptions.cancel(subscription.id);
            console.log(`[Validate Code] ✅ Cancelled subscription: ${subscription.id}`);
          }
        }
      }
    } catch (subError) {
      console.error('[Validate Code] Error cancelling subscriptions:', subError);
      // Don't fail the entire process if subscription cancellation fails
    }

    // 3. Change original user's role to resident
    const { error: updateRoleError } = await supabase
      .from('profiles')
      .update({ role: 'resident' })
      .eq('id', session.user.id);

    if (updateRoleError) {
      console.error('[Validate Code] Error changing role:', updateRoleError);
      return NextResponse.json({ error: 'Failed to change role' }, { status: 500 });
    }

    // 4. Mark the code as used (if not already marked)
    await markCodeAsUsed(code, replacementUserId);

    return NextResponse.json({ 
      success: true,
      message: 'Role change completed successfully. Your role has been changed to Resident.'
    });

  } catch (error: any) {
    console.error('Error validating access code:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
