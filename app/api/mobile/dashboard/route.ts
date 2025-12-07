import { NextRequest, NextResponse } from 'next/server';
import { getMobileUser } from '@/lib/auth/mobile';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/app/actions/dashboard';

/**
 * Mobile API: Dashboard
 * GET /api/mobile/dashboard - Get dashboard statistics
 * Returns resident-specific data for mobile app
 */

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

export async function GET(request: NextRequest) {
  try {
    const mobileUser = await getMobileUser(request);
    if (!mobileUser?.id) {
      console.error('[Mobile API] Dashboard: No mobile user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const supabase = createSupabaseAdminClient();
    const userId = mobileUser.id;

    // Get role and residence_id from query params (for role switching)
    const searchParams = request.nextUrl.searchParams;
    const requestedRole = searchParams.get('role') as 'syndic' | 'resident' | null;
    const requestedResidenceId = searchParams.get('residence_id');

    console.log('[Mobile API] Dashboard: Fetching profile for user:', userId, 'Role:', requestedRole, 'Residence:', requestedResidenceId);

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[Mobile API] Dashboard: Profile error:', profileError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch user profile: ${profileError.message}` },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!userProfile) {
      console.error('[Mobile API] Dashboard: Profile not found for user:', userId);
      return NextResponse.json(
        { success: false, error: 'User profile not found. Please contact your syndic.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Determine active role: use requested role if provided, otherwise use profile role
    const activeRole = requestedRole || userProfile.role;

    // If user is a resident (or requesting resident role), return resident-specific stats
    if (activeRole === 'resident') {
      console.log('[Mobile API] Dashboard: User is a resident, fetching residence data');
      
      // Get residence ID - use requested residence_id if provided, otherwise get first residence
      let residenceId: number | null = null;
      let residenceData: any = null;

      if (requestedResidenceId) {
        // Use requested residence
        const { data: res } = await supabase
          .from('residences')
          .select('id, name, address, city')
          .eq('id', parseInt(requestedResidenceId))
          .maybeSingle();
        
        if (res) {
          residenceId = res.id;
          residenceData = res;
        }
      } else {
        // Get first residence from profile_residences
        const { data: prLink, error: prLinkError } = await supabase
          .from('profile_residences')
          .select('residence_id, residences(id, name, address, city)')
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();

        if (prLinkError) {
          console.error('[Mobile API] Dashboard: Error fetching residence:', prLinkError);
          return NextResponse.json(
            { success: false, error: `Failed to fetch residence: ${prLinkError.message}` },
            { status: 400, headers: getCorsHeaders() }
          );
        }

        if (prLink) {
          residenceId = prLink.residence_id;
          residenceData = Array.isArray(prLink.residences) ? prLink.residences[0] : prLink.residences;
        }
      }


      // Get resident-specific stats
      const [
        paymentsResult,
        incidentsResult,
        complaintsResult,
        balancesResult,
      ] = await Promise.all([
        // Total payments for this resident
        supabase
          .from('payments')
          .select('id, amount, status, paid_at')
          .eq('user_id', userId)
          .eq('residence_id', residenceId),
        
        // Incidents for this resident
        supabase
          .from('incidents')
          .select('id, status')
          .eq('user_id', userId)
          .eq('residence_id', residenceId),
        
        // Complaints for this resident
        supabase
          .from('complaints')
          .select('id, status')
          .eq('complainant_id', userId)
          .eq('residence_id', residenceId),
        
        // Get balances (resident's payment status)
        supabase
          .from('fees')
          .select('amount, status')
          .eq('user_id', userId)
          .eq('residence_id', residenceId),
      ]);

      const allPayments = paymentsResult.data || [];
      const allIncidents = incidentsResult.data || [];
      const allComplaints = complaintsResult.data || [];
      const allFees = balancesResult.data || [];

      // Calculate stats
      const totalPayments = allPayments.length;
      const pendingPayments = allPayments.filter((p: any) => p.status === 'pending').length;
      const overduePayments = allFees.filter((f: any) => f.status === 'overdue').length;
      const totalIncidents = allIncidents.length;
      const openIncidents = allIncidents.filter((i: any) => 
        i.status === 'open' || i.status === 'in_progress'
      ).length;

      // Get recent activities
      const recentPayments = allPayments
        .filter((p: any) => p.paid_at)
        .slice(0, 5)
        .map((p: any) => ({
          type: 'payment',
          title: `Payment of ${p.amount} MAD`,
          description: `Payment ${p.status}`,
          timestamp: p.paid_at ? new Date(p.paid_at).toISOString() : new Date().toISOString(),
        }));

      const recentIncidents = allIncidents
        .slice(0, 3)
        .map((i: any) => ({
          type: 'incident',
          title: `Incident #${i.id}`,
          description: `Status: ${i.status}`,
          timestamp: i.created_at ? new Date(i.created_at).toISOString() : new Date().toISOString(),
        }));

      const activities = [...recentPayments, ...recentIncidents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      console.log('[Mobile API] Dashboard: Returning resident dashboard data');

      return NextResponse.json(
        {
          success: true,
          stats: {
            totalPayments,
            pendingPayments,
            overduePayments,
            totalIncidents,
            openIncidents,
          },
          user: {
            name: userProfile.full_name || 'Resident',
            email: mobileUser.email || '',
            role: 'resident',
          },
          residence: residenceData || null,
          activities: activities || [],
        },
        { headers: getCorsHeaders() }
      );
    }

    // If user is a syndic (or requesting syndic role), return syndic-specific stats
    if (activeRole === 'syndic') {
      console.log('[Mobile API] Dashboard: User is a syndic, fetching syndic dashboard data');
      
      // Get syndic's residence
      const { data: syndicRes } = await supabase
        .from('residences')
        .select('id, name, address, city')
        .eq('syndic_user_id', userId)
        .maybeSingle();

      if (!syndicRes) {
        return NextResponse.json(
          { success: false, error: 'User is not a syndic or has no residence assigned' },
          { status: 400, headers: getCorsHeaders() }
        );
      }

      const residenceId = syndicRes.id;

      // Get syndic dashboard stats
      const [
        residentsResult,
        paymentsResult,
        incidentsResult,
        complaintsResult,
        feesResult,
      ] = await Promise.all([
        // Total residents
        supabase
          .from('profile_residences')
          .select('profile_id')
          .eq('residence_id', residenceId),
        
        // All payments
        supabase
          .from('payments')
          .select('id, amount, status, paid_at')
          .eq('residence_id', residenceId),
        
        // All incidents
        supabase
          .from('incidents')
          .select('id, status, created_at')
          .eq('residence_id', residenceId),
        
        // All complaints
        supabase
          .from('complaints')
          .select('id, status')
          .eq('residence_id', residenceId),
        
        // All fees
        supabase
          .from('fees')
          .select('amount, status')
          .eq('residence_id', residenceId),
      ]);

      const totalResidents = residentsResult.data?.length || 0;
      const allPayments = paymentsResult.data || [];
      const allIncidents = incidentsResult.data || [];
      const allComplaints = complaintsResult.data || [];
      const allFees = feesResult.data || [];

      // Calculate stats
      const totalPayments = allPayments.length;
      const totalRevenue = allPayments
        .filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const pendingPayments = allPayments.filter((p: any) => p.status === 'pending').length;
      const overdueFees = allFees.filter((f: any) => f.status === 'overdue').length;
      const openIncidents = allIncidents.filter((i: any) => 
        i.status === 'open' || i.status === 'in_progress'
      ).length;
      const openComplaints = allComplaints.filter((c: any) => 
        c.status === 'submitted' || c.status === 'in_review'
      ).length;

      // Get recent activities
      const recentPayments = allPayments
        .filter((p: any) => p.paid_at)
        .slice(0, 5)
        .map((p: any) => ({
          type: 'payment',
          title: `Payment of ${p.amount} MAD`,
          description: `Payment ${p.status}`,
          timestamp: p.paid_at ? new Date(p.paid_at).toISOString() : new Date().toISOString(),
        }));

      const recentIncidents = allIncidents
        .slice(0, 3)
        .map((i: any) => ({
          type: 'incident',
          title: `Incident #${i.id}`,
          description: `Status: ${i.status}`,
          timestamp: i.created_at ? new Date(i.created_at).toISOString() : new Date().toISOString(),
        }));

      const activities = [...recentPayments, ...recentIncidents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      console.log('[Mobile API] Dashboard: Returning syndic dashboard data');

      return NextResponse.json(
        {
          success: true,
          stats: {
            totalResidents,
            totalPayments,
            totalRevenue,
            pendingPayments,
            overdueFees,
            openIncidents,
            openComplaints,
          },
          user: {
            name: userProfile.full_name || 'Syndic',
            email: mobileUser.email || '',
            role: 'syndic',
          },
          residence: {
            id: syndicRes.id,
            name: syndicRes.name,
            address: syndicRes.address,
            city: syndicRes.city,
          },
          activities: activities || [],
        },
        { headers: getCorsHeaders() }
      );
    }

    // For other roles (guard, admin), use the existing dashboard stats
    const result = await getDashboardStats();

    if (!result.success) {
      return NextResponse.json(result, { status: 400, headers: getCorsHeaders() });
    }

    return NextResponse.json(result, { headers: getCorsHeaders() });
  } catch (error: any) {
    console.error('[Mobile API] Dashboard GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

