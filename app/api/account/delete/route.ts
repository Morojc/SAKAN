import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { stripe } from '@/utils/stripe';
import { getCustomerByUserId } from '@/lib/stripe/services/customer.service';
import { createAccessCode } from '@/lib/utils/access-code';
import { transferSyndicData } from '@/lib/utils/account-transfer';
import { sendAccessCodeEmail } from '@/lib/utils/email';
import { revalidatePath } from 'next/cache';

// Helper to cancel Stripe subscriptions
async function cancelSubscriptions(userId: string) {
  console.log('[Account Delete] Checking for active subscriptions for user:', userId);
  
  try {
    // Get customer from Stripe SDK
    const customer = await getCustomerByUserId(userId);
    
    if (customer) {
      console.log('[Account Delete] Found Stripe customer:', customer.id);
      
      // Get all active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 100,
      });

      console.log(`[Account Delete] Found ${subscriptions.data.length} active subscription(s) to cancel`);

      // Cancel all active subscriptions immediately
      for (const subscription of subscriptions.data) {
        try {
          if (subscription.status === 'active') {
            await stripe.subscriptions.cancel(subscription.id);
            console.log(`[Account Delete] ✅ Cancelled subscription: ${subscription.id}`);
          }
        } catch (subscriptionError: any) {
          console.error(`[Account Delete] ❌ Error cancelling subscription ${subscription.id}:`, subscriptionError);
        }
      }

      // Cancel other statuses (trialing, past_due, etc.)
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 100,
      });

      const otherStatusSubscriptions = allSubscriptions.data.filter(
        (sub) => ['trialing', 'past_due', 'incomplete', 'incomplete_expired'].includes(sub.status)
      );

      for (const subscription of otherStatusSubscriptions) {
        try {
          await stripe.subscriptions.cancel(subscription.id);
          console.log(`[Account Delete] ✅ Cancelled subscription: ${subscription.id}`);
        } catch (subscriptionError: any) {
          console.error(`[Account Delete] ❌ Error cancelling subscription ${subscription.id}:`, subscriptionError);
        }
      }
    } else {
      console.log('[Account Delete] No Stripe customer found for user - skipping subscription cancellation');
    }
  } catch (subscriptionError: any) {
    console.error('[Account Delete] Error during subscription cancellation process:', subscriptionError);
  }
}

// Helper to delete user account data
async function deleteUserAccount(userId: string, userEmail?: string | null) {
  const adminSupabase = createSupabaseAdminClient();
  
  // Create a client configured for dbasakan schema
  const { createClient } = await import('@supabase/supabase-js');
  const dbasakanClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      db: { schema: 'dbasakan' },
      auth: { persistSession: false },
    }
  );

  // Delete from stripe_customers
  const { error: deleteStripeError } = await adminSupabase
    .from('stripe_customers')
    .delete()
    .eq('user_id', userId);

  if (deleteStripeError) {
    console.error('Error deleting from stripe_customers:', deleteStripeError);
  }

  // Delete from dbasakan.profiles
  const { error: deleteProfileError } = await dbasakanClient
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (deleteProfileError && deleteProfileError.code !== 'PGRST116') {
    console.error('Error deleting from profiles:', deleteProfileError);
  }

  // Delete from dbasakan.users (NextAuth)
  const { error: deleteUserError } = await dbasakanClient
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteUserError) {
    console.error('Error deleting from dbasakan.users:', deleteUserError);
    // Fallback to public schema if needed
    const { error: deletePublicUserError } = await adminSupabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deletePublicUserError) {
      console.error('Error deleting from public users:', deletePublicUserError);
    }
  }

  // Delete accounts and sessions
  await dbasakanClient.from('accounts').delete().eq('user_id', userId);
  await dbasakanClient.from('sessions').delete().eq('user_id', userId);

  // Delete verification tokens
  if (userEmail) {
    await dbasakanClient.from('verification_tokens').delete().eq('identifier', userEmail);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const body = await req.json();
    const { replacementEmail, actionType } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (!actionType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Verify user is a syndic
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, residence_id')
      .eq('id', userId)
      .single();

    if (profileError || profile?.role !== 'syndic') {
      return NextResponse.json({ error: 'Only syndics can perform this action' }, { status: 403 });
    }

    // If no replacement email, delete account directly (no residents available)
    if (!replacementEmail) {
      // Cancel subscriptions
      await cancelSubscriptions(userId);
      
      // Check if there are any other residents in the residence
      if (profile.residence_id) {
        const { data: otherResidents, error: residentsCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('residence_id', profile.residence_id)
          .neq('id', userId); // Exclude current user
        
        // If no other residents exist, delete the residence as well
        if (!residentsCheckError && (!otherResidents || otherResidents.length === 0)) {
          console.log(`[Account Delete] No other residents found. Deleting residence ${profile.residence_id}`);
          
          // Delete the residence (this will cascade to related records based on FK constraints)
          const { error: deleteResidenceError } = await supabase
            .from('residences')
            .delete()
            .eq('id', profile.residence_id);
          
          if (deleteResidenceError) {
            console.error('[Account Delete] Error deleting residence:', deleteResidenceError);
            // Continue with account deletion even if residence deletion fails
          } else {
            console.log(`[Account Delete] Residence ${profile.residence_id} deleted successfully`);
          }
        }
      }
      
      // Delete account immediately
      await deleteUserAccount(userId, session.user.email);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Account deleted successfully' 
      });
    }
    
    if (!profile.residence_id) {
       return NextResponse.json({ error: 'No residence associated with profile' }, { status: 400 });
    }

    // Find replacement user ID by email
    // Note: replacementEmail comes from frontend selection, but we verify ID
    // We need to look up the replacement user ID to perform transfer
    // We can look in profiles table (joined with users or email field if added)
    // For now, let's assume we need to find the user by email in Users or Profiles
    // Since we populated the dropdown from Profiles/Users, let's try to find by email
    
    // First try to find in profiles if email is stored there (schema doesn't strictly enforce email in profiles but our API joined it)
    // The ReplacementResidentSelect sends the email.
    // Let's find the user ID corresponding to this email in the same residence
    
    // Try to find user by email in users table (NextAuth table)
    const { data: replacementUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', replacementEmail)
      .single();
      
    if (userError || !replacementUser) {
        // Try looking in profiles if email is stored there
        const { data: replacementProfile, error: profError } = await supabase
            .from('profiles')
            .select('id')
            .eq('residence_id', profile.residence_id)
            .ilike('email', replacementEmail) // Assuming email might be added to profiles or we search by join logic
            .maybeSingle();
            
        if (!replacementProfile) {
             return NextResponse.json({ error: 'Replacement user not found' }, { status: 404 });
        }
        // Use this ID
        var replacementUserId = replacementProfile.id;
    } else {
        var replacementUserId = replacementUser.id;
    }
    
    // Verify replacement is in same residence
    const { data: replacementProfileCheck } = await supabase
        .from('profiles')
        .select('residence_id')
        .eq('id', replacementUserId)
        .single();
        
    if (replacementProfileCheck?.residence_id !== profile.residence_id) {
        return NextResponse.json({ error: 'Replacement user must be in the same residence' }, { status: 400 });
    }

    // 1. Cancel subscriptions
    await cancelSubscriptions(userId);

    // 2. Transfer data immediately
    await transferSyndicData(userId, replacementUserId);

    // 3. Generate Access Code
    const accessCode = await createAccessCode(
      userId,
      replacementEmail,
      profile.residence_id,
      actionType
    );

    // 4. Handle Action Type
    if (actionType === 'delete_account') {
      // Delete account immediately
      await deleteUserAccount(userId, session.user.email);
      // We can't revalidate path effectively if user is deleted and signed out
    } else if (actionType === 'change_role') {
      // Change role to resident
      const { error: updateRoleError } = await supabase
        .from('profiles')
        .update({ role: 'resident' })
        .eq('id', userId);

      if (updateRoleError) {
        console.error('Error changing role:', updateRoleError);
        return NextResponse.json({ error: 'Failed to change role' }, { status: 500 });
      }
      
      revalidatePath('/app');
    }

    // 5. Send Email
    await sendAccessCodeEmail({
      to: replacementEmail,
      code: accessCode.code,
      actionType
    });
    
    return NextResponse.json({ 
      success: true, 
      accessCode: accessCode.code,
      message: 'Process completed successfully' 
    });

  } catch (error: any) {
    console.error('Error processing syndic request:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE() {
  // Keeping the simple delete logic for non-syndics or general use
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Check if user is syndic
    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'syndic') {
      return NextResponse.json({ 
        error: 'Syndics must use the transfer process to delete their account' 
      }, { status: 403 });
    }

    await cancelSubscriptions(userId);
    await deleteUserAccount(userId, session.user?.email);

    return NextResponse.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });

  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ 
      error: 'Failed to delete account', 
      details: error.message 
    }, { status: 500 });
  }
}
