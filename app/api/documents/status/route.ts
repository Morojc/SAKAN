import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/documents/status
 * Get current user's document submission status
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

		const { data: submission, error } = await supabase
			.from('syndic_document_submissions')
			.select('id, status, submitted_at, reviewed_at, rejection_reason, document_url')
			.eq('user_id', session.user.id)
			.order('submitted_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error) {
			console.error('[Document Status] Error:', error);
			return NextResponse.json({
				success: false,
				error: 'Failed to fetch status',
			}, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			submission: submission || null,
		});
	} catch (error: any) {
		console.error('[Document Status] Error:', error);
		return NextResponse.json({
			success: false,
			error: error.message || 'Internal server error',
		}, { status: 500 });
	}
}

