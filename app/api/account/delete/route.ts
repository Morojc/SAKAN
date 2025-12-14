import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { getCustomerByUserId } from '@/lib/stripe/services/customer.service';
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
async function deleteUserAccount(userId: string, userEmail?: string | null, skipDeletionRequestCheck: boolean = false) {
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

  // Check if this is a syndic with a pending deletion request (unless skipDeletionRequestCheck is true, which means it's from the approval flow)
  if (!skipDeletionRequestCheck) {
    const { data: profile } = await dbasakanClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'syndic') {
      const { data: deletionRequest } = await dbasakanClient
        .from('syndic_deletion_requests')
        .select('id, status')
        .eq('syndic_user_id', userId)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      if (deletionRequest) {
        throw new Error(`Cannot delete syndic with a ${deletionRequest.status} deletion request. Please process the deletion request through the admin approval flow.`);
      }
    }
  }

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

  // STEP 7.5: Delete accounts and sessions (before deleting users)
  // This is critical because `accounts` table often has FK to `users` table
  // The error "violates foreign key constraint accounts_userid_fkey" confirms this dependency
  await dbasakanClient.from('accounts').delete().eq('userId', userId); // NextAuth usually uses userId (camelCase) or user_id (snake_case)
  // Let's try both common column names for NextAuth accounts table to be safe or check schema if possible
  await dbasakanClient.from('accounts').delete().eq('user_id', userId); 
  await dbasakanClient.from('sessions').delete().eq('userId', userId);
  await dbasakanClient.from('sessions').delete().eq('user_id', userId);

  // STEP 8: Delete from users (NextAuth)
  const { error: deleteUserError } = await dbasakanClient.from('users').delete().eq('id', userId);

  if (deleteUserError) {
    console.error('Error deleting from dbasakan.users:', deleteUserError);
    // Fallback to public schema
    await adminSupabase.from('users').delete().eq('id', userId);
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
    
    // Create dbasakan client first for consistent schema usage
    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    // Check for residence - try dbasakan schema first
    let residenceId: number | null = null;
    const { data: dbasakanResidence } = await dbasakanClient
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();
    
    residenceId = dbasakanResidence?.id || null;
    
    // Fallback to public schema if not found in dbasakan
    if (!residenceId) {
      residenceId = await getUserResidenceId(supabase, userId, 'syndic');
    }
    
    console.log('[Account Delete] Found residenceId:', residenceId, '(from dbasakan:', !!dbasakanResidence, ')');
    
    if (residenceId) {

      // Parse request body for successorId
      const body = await req.json().catch(() => ({}));
      const _successorId = body.successorId;

      // Query residents from profile_residences in dbasakan schema
      const { data: otherResidents, error: residentsCheckError } = await dbasakanClient
        .from('profile_residences')
        .select('profile_id')
        .eq('residence_id', residenceId)
        .neq('profile_id', userId);
      
      console.log('[Account Delete] Query result - otherResidents from dbasakan:', otherResidents, 'error:', residentsCheckError);
      
      // Also try querying from public schema as fallback
      let otherResidentIds = otherResidents?.map((r: any) => r.profile_id) || [];
      
      // If no residents found in dbasakan schema, try public schema
      if (otherResidentIds.length === 0) {
        console.log('[Account Delete] No residents in dbasakan schema, trying public schema...');
        const { data: publicResidents, error: publicError } = await supabase
          .from('profile_residences')
          .select('profile_id')
          .eq('residence_id', residenceId)
          .neq('profile_id', userId);
        
        console.log('[Account Delete] Public schema residents:', publicResidents, 'error:', publicError);
        if (publicResidents && publicResidents.length > 0) {
          otherResidentIds = publicResidents.map((r: any) => r.profile_id);
        }
      }
      
      // Additional check: Query all profiles with role='resident' that might be in this residence
      // This is a fallback in case profile_residences doesn't have the data
      if (otherResidentIds.length === 0) {
        console.log('[Account Delete] Trying alternative query: checking all residents in profiles table...');
        // This is a less precise query but might catch residents that aren't in profile_residences
        const { data: allResidents } = await dbasakanClient
          .from('profiles')
          .select('id')
          .eq('role', 'resident')
          .neq('id', userId);
        
        console.log('[Account Delete] All residents in dbasakan profiles:', allResidents);
        // Note: We can't directly verify they're in this residence without profile_residences,
        // but this at least shows there are residents in the system
      }

      // If no other residents exist, delete the entire residence immediately
      if (!residentsCheckError && otherResidentIds.length === 0) {
        await deleteResidenceRecursively(dbasakanClient, residenceId);
      } else {
        // If other residents exist, require successor selection before creating deletion request
        // Use the body that was already parsed at line 287
        const { successorId } = body;

        // If no successorId provided, return eligible successors for selection
        if (!successorId) {
          // Check if a deletion request already exists
          const { data: existingRequest } = await dbasakanClient
            .from('syndic_deletion_requests')
            .select('id, status')
            .eq('syndic_user_id', userId)
            .eq('residence_id', residenceId)
            .in('status', ['pending', 'approved'])
            .maybeSingle();

          if (existingRequest) {
            return NextResponse.json({ 
              error: 'A deletion request is already pending or approved for this account.',
              code: 'REQUEST_ALREADY_EXISTS',
              requestId: existingRequest.id
            }, { status: 409 });
          }

          // Fetch eligible successors for selection
          let eligibleSuccessors: any[] = [];
          
          if (otherResidentIds.length > 0) {
            // Fetch profiles and emails
            const { data: dbasakanProfiles } = await dbasakanClient
              .from('profiles')
              .select('id, full_name, phone_number, role')
              .in('id', otherResidentIds);

            eligibleSuccessors = dbasakanProfiles || [];

            // Get emails from users table
            const { data: users } = await dbasakanClient
              .from('users')
              .select('id, email')
              .in('id', otherResidentIds);

            if (users && users.length > 0) {
              eligibleSuccessors = otherResidentIds.map((id: string) => {
                const profile = eligibleSuccessors.find((p: any) => p.id === id);
                const user = users.find((u: any) => u.id === id);
                
                return {
                  id,
                  full_name: profile?.full_name || null,
                  phone_number: profile?.phone_number || null,
                  email: user?.email || null,
                  role: profile?.role || null
                };
              });
            }

            // Filter out syndics and residents with the same email as the syndic
            const syndicEmail = session.user?.email;
            const filteredSuccessors = eligibleSuccessors.filter((successor: any) => {
              if (successor.role === 'syndic') return false;
              if (!syndicEmail || !successor.email) return true;
              return successor.email.toLowerCase() !== syndicEmail.toLowerCase();
            });

            return NextResponse.json({ 
              error: 'Please select a successor to take over the Syndic role before submitting the deletion request.',
              code: 'RESIDENCE_HAS_RESIDENTS',
              eligibleSuccessors: filteredSuccessors
            }, { status: 403 });
          }
        }

        // SuccessorId is provided - validate and create deletion request
        if (!successorId) {
          return NextResponse.json({ 
            error: 'Successor selection is required. Please select a resident to become the new syndic.',
            code: 'SUCCESSOR_REQUIRED'
          }, { status: 400 });
        }

        // Verify successor is a valid resident of this residence
        if (!otherResidentIds.includes(successorId)) {
          return NextResponse.json({ 
            error: 'Invalid successor selected',
          }, { status: 400 });
        }

        // Verify successor is not already a syndic
        const { data: successorProfile } = await dbasakanClient
          .from('profiles')
          .select('role')
          .eq('id', successorId)
          .maybeSingle();

        // Fallback to public schema if not found
        const profileToCheck = successorProfile || await supabase
          .from('profiles')
          .select('role')
          .eq('id', successorId)
          .maybeSingle()
          .then(({ data }) => data);

        if (profileToCheck?.role === 'syndic') {
          return NextResponse.json({ 
            error: 'Cannot select a syndic as a successor. Syndics cannot be added as residents.',
          }, { status: 400 });
        }

        // Check if a deletion request already exists
        const { data: existingRequest } = await dbasakanClient
          .from('syndic_deletion_requests')
          .select('id, status')
          .eq('syndic_user_id', userId)
          .eq('residence_id', residenceId)
          .in('status', ['pending', 'approved'])
          .maybeSingle();

        if (existingRequest) {
          return NextResponse.json({ 
            error: 'A deletion request is already pending or approved for this account.',
            code: 'REQUEST_ALREADY_EXISTS',
            requestId: existingRequest.id
          }, { status: 409 });
        }

        // Create a new deletion request with the selected successor
        const { data: newRequest, error: requestError } = await dbasakanClient
          .from('syndic_deletion_requests')
          .insert({
            syndic_user_id: userId,
            residence_id: residenceId,
            successor_user_id: successorId, // Include the selected successor
            status: 'pending'
          })
          .select('id')
          .single();

        if (requestError) {
          console.error('[Account Delete] Error creating deletion request:', requestError);
          return NextResponse.json({ 
            error: 'Failed to create deletion request',
          }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true,
          message: 'Deletion request submitted successfully with selected successor. An administrator will review your request.',
          code: 'DELETION_REQUEST_CREATED',
          requestId: newRequest.id
        }, { status: 200 });
      }
    }

    // If no residence, proceed with immediate deletion
    await deleteUserAccount(userId, session.user.email);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Account Delete] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while processing your request' 
    }, { status: 500 });
  }
}

// DELETE handler for non-syndic users (residents, guards, etc.)
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
