import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/admin/documents/review
 * Approve or reject a document submission
 * Note: Admin check should be implemented based on your admin system
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
		const { submissionId, action, rejectionReason } = body;

		if (!submissionId || !action) {
			return NextResponse.json({ 
				success: false,
				error: 'Missing required fields' 
			}, { status: 400 });
		}

		if (action !== 'approve' && action !== 'reject') {
			return NextResponse.json({ 
				success: false,
				error: 'Invalid action. Must be "approve" or "reject"' 
			}, { status: 400 });
		}

		if (action === 'reject' && !rejectionReason) {
			return NextResponse.json({ 
				success: false,
				error: 'Rejection reason is required' 
			}, { status: 400 });
		}

		const supabase = createSupabaseAdminClient();

		// TODO: Add admin role check here
		// For now, we'll allow any authenticated user to review
		// In production, add proper admin role verification
		// const { data: profile } = await supabase
		//   .from('profiles')
		//   .select('role')
		//   .eq('id', session.user.id)
		//   .maybeSingle();
		// if (profile?.role !== 'admin') {
		//   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
		// }

		// Get the submission
		const { data: submission, error: fetchError } = await supabase
			.from('syndic_document_submissions')
			.select('id, user_id, status')
			.eq('id', submissionId)
			.maybeSingle();

		if (fetchError) {
			console.error('[Admin Review] Error fetching submission:', fetchError);
			return NextResponse.json({
				success: false,
				error: 'Failed to fetch submission',
			}, { status: 500 });
		}

		if (!submission) {
			return NextResponse.json({
				success: false,
				error: 'Submission not found',
			}, { status: 404 });
		}

		// Update submission status
		const updateData: any = {
			status: action === 'approve' ? 'approved' : 'rejected',
			reviewed_at: new Date().toISOString(),
			reviewed_by: session.user.id,
		};

		if (action === 'reject') {
			updateData.rejection_reason = rejectionReason;
		}

		const { error: updateError } = await supabase
			.from('syndic_document_submissions')
			.update(updateData)
			.eq('id', submissionId);

		if (updateError) {
			console.error('[Admin Review] Error updating submission:', updateError);
			return NextResponse.json({
				success: false,
				error: 'Failed to update submission',
			}, { status: 500 });
		}

		// If approved, set user as verified
		if (action === 'approve') {
			const { error: verifyError } = await supabase
				.from('profiles')
				.update({ verified: true })
				.eq('id', submission.user_id);

			if (verifyError) {
				console.error('[Admin Review] Error verifying user:', verifyError);
				// Don't fail the request, but log the error
			}
		}

		return NextResponse.json({
			success: true,
			message: `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
		});
	} catch (error: any) {
		console.error('[Admin Review] Error:', error);
		return NextResponse.json({
			success: false,
			error: error.message || 'Internal server error',
		}, { status: 500 });
	}
}

/**
 * GET /api/admin/documents/review
 * Get all pending document submissions for admin review
 */
export async function GET() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ 
				success: false,
				error: 'Not authenticated' 
			}, { status: 401 });
		}

		const supabase = createSupabaseAdminClient();

		// TODO: Add admin role check here

		// Get all submissions with user info
		const { data: submissions, error } = await supabase
			.from('syndic_document_submissions')
			.select(`
				id,
				user_id,
				document_url,
				id_card_url,
				status,
				submitted_at,
				reviewed_at,
				rejection_reason,
				profiles:user_id (
					id,
					full_name,
					email_verified
				)
			`)
			.order('submitted_at', { ascending: false });

		if (error) {
			console.error('[Admin Review] Error fetching submissions:', error);
			return NextResponse.json({
				success: false,
				error: 'Failed to fetch submissions',
			}, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			submissions: submissions || [],
		});
	} catch (error: any) {
		console.error('[Admin Review] Error:', error);
		return NextResponse.json({
			success: false,
			error: error.message || 'Internal server error',
		}, { status: 500 });
	}
}

