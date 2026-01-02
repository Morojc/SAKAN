import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/payments/outstanding?residenceId=1&userId=xxx&apartmentNumber=A1
// Get outstanding contributions and fees for a user/apartment
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const residenceId = searchParams.get('residenceId');
    const userId = searchParams.get('userId') || session.user.id;
    const apartmentNumber = searchParams.get('apartmentNumber');

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get profile_residence_id
    let profileResidenceQuery = supabase
      .from('profile_residences')
      .select('id')
      .eq('residence_id', residenceId)
      .eq('profile_id', userId);

    if (apartmentNumber) {
      profileResidenceQuery = profileResidenceQuery.eq('apartment_number', apartmentNumber);
    }

    const { data: profileResidences, error: prError } = await profileResidenceQuery.limit(1);

    if (prError || !profileResidences || profileResidences.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Profile residence not found' },
        { status: 404 }
      );
    }

    const profileResidenceId = profileResidences[0].id;

    // Get outstanding contributions
    const { data: contributions, error: contribError } = await supabase
      .from('contributions')
      .select(`
        *,
        profile_residences!inner(
          apartment_number,
          profiles(full_name)
        )
      `)
      .eq('residence_id', residenceId)
      .eq('profile_residence_id', profileResidenceId)
      .in('status', ['pending', 'partial', 'overdue']);

    // Get outstanding fees
    const { data: fees, error: feesError } = await supabase
      .from('fees')
      .select(`
        *,
        profiles(full_name)
      `)
      .eq('residence_id', residenceId)
      .eq('user_id', userId)
      .eq('status', 'unpaid');

    if (apartmentNumber) {
      // Filter fees by apartment if provided
      // Note: fees might not have apartment_number, so we filter in memory
    }

    // Calculate totals
    const totalContributionsDue = contributions?.reduce((sum, c) => sum + (c.amount_due - (c.amount_paid || 0)), 0) || 0;
    const totalFeesDue = fees?.reduce((sum, f) => sum + f.amount, 0) || 0;
    const totalDue = totalContributionsDue + totalFeesDue;

    return NextResponse.json({
      success: true,
      data: {
        contributions: contributions?.map((c: any) => ({
          id: c.id,
          type: 'contribution',
          period: `${c.period_start} to ${c.period_end}`,
          amount_due: c.amount_due,
          amount_paid: c.amount_paid || 0,
          outstanding: c.amount_due - (c.amount_paid || 0),
          due_date: c.due_date,
          status: c.status,
          apartment_number: c.profile_residences?.apartment_number,
        })) || [],
        fees: fees?.map((f: any) => ({
          id: f.id,
          type: 'fee',
          title: f.title,
          amount: f.amount,
          outstanding: f.amount,
          due_date: f.due_date,
          fee_type: f.fee_type,
          apartment_number: f.apartment_number,
        })) || [],
        totals: {
          contributions_due: totalContributionsDue,
          fees_due: totalFeesDue,
          total_due: totalDue,
        },
      },
    });
  } catch (error: any) {
    console.error('[GET /api/payments/outstanding] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

