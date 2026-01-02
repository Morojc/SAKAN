import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { CreateContributionDTO, Contribution } from '@/types/financial.types';

// GET /api/contributions?residenceId=1&year=2025&status=pending
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
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const apartmentNumber = searchParams.get('apartmentNumber');

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('contributions')
      .select(`
        *,
        profile_residences!inner(
          profile_id,
          apartment_number,
          profiles(full_name)
        )
      `)
      .eq('residence_id', residenceId);

    if (year) {
      const yearNum = parseInt(year);
      query = query.gte('period_start', `${yearNum}-01-01`)
                   .lte('period_start', `${yearNum}-12-31`);
    }

    if (month) {
      const monthNum = parseInt(month);
      const yearNum = year ? parseInt(year) : new Date().getFullYear();
      query = query.gte('period_start', `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`)
                   .lt('period_start', `${yearNum}-${(monthNum + 1).toString().padStart(2, '0')}-01`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (apartmentNumber) {
      query = query.eq('apartment_number', apartmentNumber);
    }

    query = query.order('period_start', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/contributions] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform data to include resident name
    const contributions = data.map((item: any) => ({
      ...item,
      resident_name: item.profile_residences?.profiles?.full_name || 'Unknown',
      resident_id: item.profile_residences?.profile_id,
    }));

    return NextResponse.json({
      success: true,
      data: contributions as Contribution[],
    });
  } catch (error: any) {
    console.error('[GET /api/contributions] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/contributions (Manual entry)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateContributionDTO = await request.json();

    // Validate required fields
    if (!body.residence_id || !body.profile_residence_id || !body.apartment_number || 
        !body.period_start || !body.period_end || !body.amount_due || !body.due_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can create contributions manually' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('contributions')
      .insert({
        ...body,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/contributions] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as Contribution,
      message: 'Contribution created successfully',
    });
  } catch (error: any) {
    console.error('[POST /api/contributions] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

