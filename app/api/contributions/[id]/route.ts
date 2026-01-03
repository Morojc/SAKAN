import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// DELETE /api/contributions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can delete contributions' },
        { status: 403 }
      );
    }

    // Check if contribution exists
    const { data: contribution, error: contributionError } = await supabase
      .from('contributions')
      .select('id, residence_id')
      .eq('id', id)
      .maybeSingle();

    if (contributionError) {
      console.error('[DELETE /api/contributions/[id]] Error fetching contribution:', contributionError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contribution' },
        { status: 500 }
      );
    }

    if (!contribution) {
      return NextResponse.json(
        { success: false, error: 'Contribution not found' },
        { status: 404 }
      );
    }

    // Check if contribution has any related payments
    const { data: relatedPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('id')
      .eq('contribution_id', id)
      .limit(1);

    if (paymentsError) {
      console.error('[DELETE /api/contributions/[id]] Error checking payments:', paymentsError);
      return NextResponse.json(
        { success: false, error: 'Failed to check for related payments' },
        { status: 500 }
      );
    }

    if (relatedPayments && relatedPayments.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete contribution: This contribution has related payments. Contributions with payments cannot be deleted to maintain financial integrity.' 
        },
        { status: 400 }
      );
    }

    // Delete the contribution
    const { error: deleteError } = await supabase
      .from('contributions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[DELETE /api/contributions/[id]] Error deleting contribution:', deleteError);
      return NextResponse.json(
        { success: false, error: deleteError.message || 'Failed to delete contribution' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contribution deleted successfully',
    });
  } catch (error: any) {
    console.error('[DELETE /api/contributions/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

