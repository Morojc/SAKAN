import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/account/deletion-request
 * Get the current user's deletion request status
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    // Get the most recent deletion request for this user
    const { data: request, error } = await dbasakanClient
      .from('syndic_deletion_requests')
      .select('*')
      .eq('syndic_user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Deletion Request] Error fetching request:', error);
      return NextResponse.json({ error: 'Failed to fetch deletion request' }, { status: 500 });
    }

    if (!request) {
      return NextResponse.json({ request: null }, { status: 200 });
    }

    return NextResponse.json({ request }, { status: 200 });
  } catch (error: any) {
    console.error('[Deletion Request] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/account/deletion-request
 * Cancel/remove a pending deletion request
 */
export async function DELETE() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    // Find the pending deletion request with full details
    const { data: request, error: findError } = await dbasakanClient
      .from('syndic_deletion_requests')
      .select('id, status, residence_id, successor_user_id')
      .eq('syndic_user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (findError) {
      console.error('[Deletion Request] Error finding request:', findError);
      return NextResponse.json({ error: 'Failed to find deletion request' }, { status: 500 });
    }

    if (!request) {
      return NextResponse.json({ error: 'No pending deletion request found' }, { status: 404 });
    }

    // Only allow cancellation of pending requests
    if (request.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Cannot cancel a request that is not pending',
        status: request.status
      }, { status: 400 });
    }

    // Verify the syndic still has the same residence
    const { data: syndicResidence } = await dbasakanClient
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .eq('id', request.residence_id)
      .maybeSingle();

    if (!syndicResidence) {
      return NextResponse.json({ 
        error: 'Cannot cancel: Your residence assignment has changed or no longer exists'
      }, { status: 400 });
    }

    // If a successor was selected, verify they still exist in the same residence and are still a resident
    if (request.successor_user_id) {
      // Check if successor is still in the residence
      const { data: successorResidence, error: successorError } = await dbasakanClient
        .from('profile_residences')
        .select('residence_id')
        .eq('profile_id', request.successor_user_id)
        .eq('residence_id', request.residence_id)
        .maybeSingle();

      // Fallback to public schema if not found in dbasakan
      let isInResidence = !!successorResidence;
      if (!successorResidence && !successorError) {
        const supabase = createSupabaseAdminClient();
        const { data: publicSuccessorResidence } = await supabase
          .from('profile_residences')
          .select('residence_id')
          .eq('profile_id', request.successor_user_id)
          .eq('residence_id', request.residence_id)
          .maybeSingle();
        isInResidence = !!publicSuccessorResidence;
      }

      if (!isInResidence) {
        return NextResponse.json({ 
          error: 'Cannot cancel: The selected successor no longer exists in your residence'
        }, { status: 400 });
      }

      // Verify the successor is still a resident (not a syndic)
      const { data: successorProfile } = await dbasakanClient
        .from('profiles')
        .select('role')
        .eq('id', request.successor_user_id)
        .maybeSingle();

      // Fallback to public schema if not found
      const profileToCheck = successorProfile || await createSupabaseAdminClient()
        .from('profiles')
        .select('role')
        .eq('id', request.successor_user_id)
        .maybeSingle()
        .then(({ data }) => data);

      if (profileToCheck?.role === 'syndic') {
        return NextResponse.json({ 
          error: 'Cannot cancel: The selected successor is no longer a resident'
        }, { status: 400 });
      }
    }

    // Delete the request
    const { error: deleteError } = await dbasakanClient
      .from('syndic_deletion_requests')
      .delete()
      .eq('id', request.id);

    if (deleteError) {
      console.error('[Deletion Request] Error deleting request:', deleteError);
      return NextResponse.json({ error: 'Failed to cancel deletion request' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Deletion request cancelled successfully'
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Deletion Request] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

