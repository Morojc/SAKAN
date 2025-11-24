import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
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

  // STEP 1: Delete document submissions and their files from storage FIRST
  // This must be done before deleting the profile due to foreign key constraints
  const { data: submissions, error: submissionsError } = await dbasakanClient
    .from('syndic_document_submissions')
    .select('document_url, id_card_url')
    .eq('user_id', userId);

  if (!submissionsError && submissions) {
    console.log(`[Account Delete] Found ${submissions.length} document submission(s) to delete`);
    
    // Delete all files from storage
    const filesToDelete: string[] = [];
    for (const submission of submissions) {
      if (submission.document_url) {
        const documentPath = submission.document_url.split('/syndic-documents/')[1];
        if (documentPath) {
          filesToDelete.push(`syndic-documents/${documentPath}`);
        }
      }
      if (submission.id_card_url) {
        const idCardPath = submission.id_card_url.split('/syndic-documents/')[1];
        if (idCardPath) {
          filesToDelete.push(`syndic-documents/${idCardPath}`);
        }
      }
    }

    if (filesToDelete.length > 0) {
      const { error: storageDeleteError } = await adminSupabase.storage
        .from('SAKAN')
        .remove(filesToDelete);

      if (storageDeleteError) {
        console.error('[Account Delete] Error deleting files from storage:', storageDeleteError);
        // Continue anyway - don't fail account deletion if file deletion fails
      } else {
        console.log(`[Account Delete] Deleted ${filesToDelete.length} file(s) from storage`);
      }
    }

    // Delete document submissions from database
    const { error: deleteSubmissionsError } = await dbasakanClient
      .from('syndic_document_submissions')
      .delete()
      .eq('user_id', userId);

    if (deleteSubmissionsError) {
      console.error('[Account Delete] Error deleting document submissions:', deleteSubmissionsError);
      // This is critical - if we can't delete submissions, we can't delete the profile
      throw new Error(`Failed to delete document submissions: ${deleteSubmissionsError.message}`);
    } else {
      console.log(`[Account Delete] Deleted ${submissions.length} document submission(s)`);
    }
  }

  // STEP 2: Delete from stripe_customers
  const { error: deleteStripeError } = await adminSupabase
    .from('stripe_customers')
    .delete()
    .eq('user_id', userId);

  if (deleteStripeError) {
    console.error('Error deleting from stripe_customers:', deleteStripeError);
  }

  // STEP 3: Delete from dbasakan.profiles (now safe since submissions are deleted)
  const { error: deleteProfileError } = await dbasakanClient
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (deleteProfileError && deleteProfileError.code !== 'PGRST116') {
    console.error('Error deleting from profiles:', deleteProfileError);
    throw new Error(`Failed to delete profile: ${deleteProfileError.message}`);
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
