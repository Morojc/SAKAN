import { NextResponse } from 'next/server';
import { getAdminId } from '@/lib/admin-auth';

/**
 * POST /api/admin/deletion-requests/approve
 * Approve a deletion request and transfer role to successor
 */
export async function POST(req: Request) {
  try {
    const adminId = await getAdminId();
    
    if (!adminId) {
      return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, successorId } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Get the deletion request first to check if it has a pre-selected successor
    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    const { data: deletionRequest, error: requestError } = await dbasakanClient
      .from('syndic_deletion_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !deletionRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
    }

    if (deletionRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This deletion request has already been processed' }, { status: 400 });
    }

    // Use provided successorId, or fall back to pre-selected successor from the request
    // If admin didn't select a new one, use the pre-selected one from the syndic
    const finalSuccessorId = (successorId && successorId.trim()) || deletionRequest.successor_user_id;

    // Successor ID is mandatory - cannot approve without a successor
    if (!finalSuccessorId || finalSuccessorId.trim() === '') {
      return NextResponse.json({ 
        error: 'Successor selection is required. Please select a resident to become the new syndic before approving the deletion request.',
        code: 'SUCCESSOR_REQUIRED'
      }, { status: 400 });
    }

    const syndicUserId = deletionRequest.syndic_user_id;
    const residenceId = deletionRequest.residence_id;

    // Verify successor is a valid resident of this residence
    const { data: otherResidents } = await dbasakanClient
      .from('profile_residences')
      .select('profile_id')
      .eq('residence_id', residenceId)
      .neq('profile_id', syndicUserId);

    const otherResidentIds = otherResidents?.map((r: any) => r.profile_id) || [];

    if (!otherResidentIds.includes(finalSuccessorId)) {
      return NextResponse.json({ 
        error: 'Invalid successor selected',
      }, { status: 400 });
    }

    // Verify successor is not already a syndic
    const { data: successorProfile } = await dbasakanClient
      .from('profiles')
      .select('role')
      .eq('id', finalSuccessorId)
      .maybeSingle();

    if (successorProfile?.role === 'syndic') {
      return NextResponse.json({ 
        error: 'Cannot select a syndic as a successor. Syndics cannot be added as residents.',
      }, { status: 400 });
    }

    // 1. Demote the old syndic to resident role
    const { error: demoteError } = await dbasakanClient
      .from('profiles')
      .update({ role: 'resident' })
      .eq('id', syndicUserId);

    if (demoteError) {
      console.error('[Admin Approve] Error demoting old syndic:', demoteError);
      return NextResponse.json({ error: 'Failed to demote old syndic' }, { status: 500 });
    }

    // 2. Add the old syndic to profile_residences as a resident
    // First check if they're already in profile_residences
    const { data: existingResidenceLink } = await dbasakanClient
      .from('profile_residences')
      .select('id')
      .eq('profile_id', syndicUserId)
      .eq('residence_id', residenceId)
      .maybeSingle();

    if (!existingResidenceLink) {
      const { error: addResidentError } = await dbasakanClient
        .from('profile_residences')
        .insert({
          profile_id: syndicUserId,
          residence_id: residenceId
        });

      if (addResidentError) {
        console.error('[Admin Approve] Error adding old syndic as resident:', addResidentError);
        // Continue anyway - they might already be linked
      }
    }

    // 3. Promote new user to syndic
    const { error: promoteError } = await dbasakanClient
      .from('profiles')
      .update({ role: 'syndic', verified: true })
      .eq('id', finalSuccessorId);

    if (promoteError) {
      console.error('[Admin Approve] Error promoting successor:', promoteError);
      return NextResponse.json({ error: 'Failed to promote successor' }, { status: 500 });
    }

    // 4. Update residence to point to new syndic
    const { error: updateResidenceError } = await dbasakanClient
      .from('residences')
      .update({ syndic_user_id: finalSuccessorId })
      .eq('id', residenceId);

    if (updateResidenceError) {
      console.error('[Admin Approve] Error updating residence owner:', updateResidenceError);
      return NextResponse.json({ error: 'Failed to update residence owner' }, { status: 500 });
    }

    // 5. Remove the successor from profile_residences (since they're now the syndic)
    await dbasakanClient
      .from('profile_residences')
      .delete()
      .eq('profile_id', finalSuccessorId)
      .eq('residence_id', residenceId);

    // 6. Update deletion request with successor and mark as approved
    // If admin provided a different successor, update it; otherwise keep the pre-selected one
    await dbasakanClient
      .from('syndic_deletion_requests')
      .update({
        successor_user_id: finalSuccessorId,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        status: 'approved'
      })
      .eq('id', requestId);

    // 7. Mark deletion request as completed
    await dbasakanClient
      .from('syndic_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    return NextResponse.json({ 
      success: true, 
      message: 'Deletion request approved. The old syndic has been demoted to resident and the successor has been promoted to syndic.' 
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Admin Approve] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while processing the approval' 
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/deletion-requests/reject
 * Reject a deletion request
 */
export async function PUT(req: Request) {
  try {
    const adminId = await getAdminId();
    
    if (!adminId) {
      return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, rejectionReason } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    // Get the deletion request
    const { data: deletionRequest, error: requestError } = await dbasakanClient
      .from('syndic_deletion_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !deletionRequest) {
      return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
    }

    if (deletionRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This deletion request has already been processed' }, { status: 400 });
    }

    // Update deletion request as rejected
    await dbasakanClient
      .from('syndic_deletion_requests')
      .update({
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        status: 'rejected',
        rejection_reason: rejectionReason || null
      })
      .eq('id', requestId);

    return NextResponse.json({ 
      success: true, 
      message: 'Deletion request rejected successfully' 
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Admin Reject] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while processing the rejection' 
    }, { status: 500 });
  }
}

