import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { getCustomerByUserId } from '@/lib/stripe/services/customer.service';
import { revalidatePath } from 'next/cache';
import { getUserResidenceId } from '@/lib/residence-utils';

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

// Helper to delete residence and all its related data
async function deleteResidenceRecursively(supabase: any, residenceId: number) {
  console.log(`[Account Delete] Deleting residence ${residenceId} and all related data...`);

  // Delete child tables first (referencing residences)
  // Order matters due to foreign key constraints
  
  // 1. Transactions & Financials
  await supabase.from('transaction_history').delete().eq('residence_id', residenceId);
  await supabase.from('balance_snapshots').delete().eq('residence_id', residenceId);
  await supabase.from('expenses').delete().eq('residence_id', residenceId);
  
  // 2. Payments references Fees
  await supabase.from('payments').delete().eq('residence_id', residenceId);
  await supabase.from('fees').delete().eq('residence_id', residenceId);
  
  // 3. Operational
  await supabase.from('incidents').delete().eq('residence_id', residenceId);
  await supabase.from('deliveries').delete().eq('residence_id', residenceId);
  await supabase.from('access_logs').delete().eq('residence_id', residenceId);
  await supabase.from('announcements').delete().eq('residence_id', residenceId);
  
  // 4. Polls (delete options/votes first if needed, but they cascade from poll usually? 
  // Schema check: poll_votes ref polls. poll_options ref polls.
  // Assuming we need to clean them or rely on cascade if configured. 
  // Safest is to find polls and delete children.
  const { data: polls } = await supabase.from('polls').select('id').eq('residence_id', residenceId);
  if (polls?.length) {
    const pollIds = polls.map((p: any) => p.id);
    await supabase.from('poll_votes').delete().in('poll_id', pollIds);
    await supabase.from('poll_options').delete().in('poll_id', pollIds);
    await supabase.from('polls').delete().in('id', pollIds);
  }

  // 5. Notifications
  await supabase.from('notifications').delete().eq('residence_id', residenceId);
  
  // 6. Document Submissions (unlink or delete?)
  // syndic_document_submissions has assigned_residence_id
  await supabase.from('syndic_document_submissions').update({ assigned_residence_id: null }).eq('assigned_residence_id', residenceId);

  // 7. Profile Residences (unlink residents)
  await supabase.from('profile_residences').delete().eq('residence_id', residenceId);

  // 8. Finally delete residence
  const { error } = await supabase.from('residences').delete().eq('id', residenceId);
  
  if (error) {
    console.error(`[Account Delete] Error deleting residence ${residenceId}:`, error);
    throw error;
  }
}

// Helper to delete user account data
async function deleteUserAccount(userId: string, userEmail?: string | null) {
  const adminSupabase = createSupabaseAdminClient();
  
  // Create a client configured for dbasakan schema with service role
  const { createClient } = await import('@supabase/supabase-js');
  const dbasakanClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      db: { schema: 'dbasakan' },
      auth: { persistSession: false },
    }
  );

  console.log('[Account Delete] Starting comprehensive user data cleanup for:', userId);

  // STEP 0: Unlink from Residences (Syndic/Guard roles) to prevent FK violation on users/profiles deletion
  await dbasakanClient.from('residences').update({ syndic_user_id: null }).eq('syndic_user_id', userId);
  await dbasakanClient.from('residences').update({ guard_user_id: null }).eq('guard_user_id', userId);

  // STEP 1: Delete dependent data where user is the "subject" (Resident/User data)
  await dbasakanClient.from('profile_residences').delete().eq('profile_id', userId);
  await dbasakanClient.from('notifications').delete().eq('user_id', userId);
  await dbasakanClient.from('poll_votes').delete().eq('user_id', userId);
  await dbasakanClient.from('verification_tokens').delete().eq('identifier', userEmail || '');

  // STEP 2: Nullify references where user was "creator" or "actor" (nullable columns)
  // This ensures profile deletion doesn't fail due to FKs
  await dbasakanClient.from('announcements').update({ created_by: null }).eq('created_by', userId);
  await dbasakanClient.from('expenses').update({ created_by: null }).eq('created_by', userId);
  await dbasakanClient.from('polls').update({ created_by: null }).eq('created_by', userId);
  await dbasakanClient.from('balance_snapshots').update({ created_by: null }).eq('created_by', userId);
  await dbasakanClient.from('payments').update({ verified_by: null }).eq('verified_by', userId);
  await dbasakanClient.from('incidents').update({ assigned_to: null }).eq('assigned_to', userId);
  // deliveries logged_by is nullable? Schema says logged_by REFERENCES profiles. 
  // Checking schema: logged_by text NOT NULL? 
  // delivery definition: logged_by text NOT NULL.
  // So we must DELETE deliveries logged by this user.
  await dbasakanClient.from('deliveries').delete().eq('logged_by', userId);
  await dbasakanClient.from('deliveries').delete().eq('recipient_id', userId);

  // STEP 3: Delete data where user is REQUIRED (NOT NULL FK)
  // Payments (user_id), Fees (user_id), Incidents (user_id)
  await dbasakanClient.from('payments').delete().eq('user_id', userId);
  await dbasakanClient.from('fees').delete().eq('user_id', userId);
  await dbasakanClient.from('incidents').delete().eq('user_id', userId);
  await dbasakanClient.from('access_logs').delete().eq('generated_by', userId);
  await dbasakanClient.from('access_logs').delete().eq('scanned_by', userId); // scanned_by is nullable? Schema: scanned_by text. Nullable.
  // But access_logs definition: scanned_by text (nullable).
  // So update scanned_by to null?
  await dbasakanClient.from('access_logs').update({ scanned_by: null }).eq('scanned_by', userId);

  // STEP 4: Delete document submissions and their files from storage
  // ... existing logic ...
  const { data: submissions, error: submissionsError } = await dbasakanClient
    .from('syndic_document_submissions')
    .select('document_url, id_card_url')
    .eq('user_id', userId);

  if (!submissionsError && submissions) {
    // Delete all files from storage
    const filesToDelete: string[] = [];
    for (const submission of submissions) {
      if (submission.document_url) {
        const documentPath = submission.document_url.split('/syndic-documents/')[1];
        if (documentPath) filesToDelete.push(`syndic-documents/${documentPath}`);
      }
      if (submission.id_card_url) {
        const idCardPath = submission.id_card_url.split('/syndic-documents/')[1];
        if (idCardPath) filesToDelete.push(`syndic-documents/${idCardPath}`);
      }
    }

    if (filesToDelete.length > 0) {
      await adminSupabase.storage.from('SAKAN').remove(filesToDelete);
    }

    // Delete document submissions from database
    await dbasakanClient.from('syndic_document_submissions').delete().eq('user_id', userId);
  }

  // STEP 5: Delete from stripe_customers
  await adminSupabase.from('stripe_customers').delete().eq('user_id', userId);

  // STEP 6: Delete from profiles
  const { error: deleteProfileError } = await dbasakanClient.from('profiles').delete().eq('id', userId);

  if (deleteProfileError && deleteProfileError.code !== 'PGRST116') {
    console.error('Error deleting from profiles:', deleteProfileError);
    // If it fails, log but try to continue to users
  }

  // STEP 7: Delete from users (NextAuth)
  const { error: deleteUserError } = await dbasakanClient.from('users').delete().eq('id', userId);

  if (deleteUserError) {
    console.error('Error deleting from dbasakan.users:', deleteUserError);
    // Fallback to public schema
    await adminSupabase.from('users').delete().eq('id', userId);
  }

  // STEP 8: Delete accounts and sessions
  await dbasakanClient.from('accounts').delete().eq('user_id', userId);
  await dbasakanClient.from('sessions').delete().eq('user_id', userId);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // Verify user is a syndic (or we allow it? Page calls this for syndic)
    // We should allow it even if profile is half-deleted or role is unclear, but for safety:
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    // Allow if role is syndic OR if no profile (already partial delete?) - no, security.
    if (profile?.role !== 'syndic') {
      return NextResponse.json({ error: 'Only syndics can perform this action' }, { status: 403 });
    }

    // Cancel subscriptions
    await cancelSubscriptions(userId);
    
    // Check for residence and other residents
    const residenceId = await getUserResidenceId(supabase, userId, 'syndic');
    
    if (residenceId) {
      // Create dbasakan client for deep cleanup
      const { createClient } = await import('@supabase/supabase-js');
      const dbasakanClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
        { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
      );

      const { data: otherResidents, error: residentsCheckError } = await dbasakanClient
        .from('profile_residences')
        .select('id')
        .eq('residence_id', residenceId)
        .neq('profile_id', userId);
      
      // If no other residents exist, delete the entire residence
      if (!residentsCheckError && (!otherResidents || otherResidents.length === 0)) {
        await deleteResidenceRecursively(dbasakanClient, residenceId);
      } else {
        // If other residents exist, we just unlink the syndic from the residence
        console.log(`[Account Delete] Residence ${residenceId} has other residents. Unlinking syndic only.`);
        await dbasakanClient
          .from('residences')
          .update({ syndic_user_id: null })
          .eq('id', residenceId);
      }
    }
    
    // Delete account
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
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

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
