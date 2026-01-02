import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { ContributionStatusMatrix } from '@/types/financial.types';

// GET /api/contributions/status?residenceId=1&year=2025
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
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get all contributions for the year
    const { data: contributions, error } = await supabase
      .from('contributions')
      .select(`
        *,
        profile_residences!inner(
          profile_id,
          apartment_number,
          profiles(full_name)
        )
      `)
      .eq('residence_id', residenceId)
      .gte('period_start', `${year}-01-01`)
      .lte('period_start', `${year}-12-31`)
      .order('apartment_number', { ascending: true })
      .order('period_start', { ascending: true });

    if (error) {
      console.error('[GET /api/contributions/status] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Group by apartment
    const apartmentMap = new Map<string, ContributionStatusMatrix>();

    contributions?.forEach((contrib: any) => {
      const aptNum = contrib.apartment_number;
      const residentName = contrib.profile_residences?.profiles?.full_name || 'Unknown';
      const residentId = contrib.profile_residences?.profile_id;

      if (!apartmentMap.has(aptNum)) {
        apartmentMap.set(aptNum, {
          apartment_number: aptNum,
          resident_name: residentName,
          resident_id: residentId,
          months: {},
          outstanding_months: 0,
          total_due: 0,
          total_paid: 0,
        });
      }

      const apt = apartmentMap.get(aptNum)!;
      
      // Format month key (e.g., "janv-25")
      const periodStart = new Date(contrib.period_start);
      const monthNames = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
      const monthKey = `${monthNames[periodStart.getMonth()]}-${year.toString().slice(-2)}`;
      
      apt.months[monthKey] = contrib.status;
      apt.total_due += parseFloat(contrib.amount_due);
      apt.total_paid += parseFloat(contrib.amount_paid);
      
      if (contrib.status === 'pending' || contrib.status === 'partial' || contrib.status === 'overdue') {
        apt.outstanding_months++;
      }
    });

    const statusMatrix = Array.from(apartmentMap.values());

    return NextResponse.json({
      success: true,
      data: statusMatrix,
    });
  } catch (error: any) {
    console.error('[GET /api/contributions/status] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

