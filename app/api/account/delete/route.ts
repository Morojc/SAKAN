import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { stripe } from '@/utils/stripe';
import { getCustomerByUserId } from '@/lib/stripe/services/customer.service';
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

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
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

  } catch (error: any) {
    console.error('Error deleting account:', error);
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
