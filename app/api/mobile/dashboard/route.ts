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
    // IMPORTANT: Validate that the user actually has the requested role
    let activeRole = requestedRole || userProfile.role;
    
    // Check if user actually has the requested role
    let hasSyndicRole = false;
    let hasResidentRole = false;
    
    // Check if user is a syndic
    const { data: syndicCheck } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', userId)
      .maybeSingle();
    hasSyndicRole = !!syndicCheck;
    
    // Check if user is a resident
    const { data: residentCheck } = await supabase
      .from('profile_residences')
      .select('profile_id')
      .eq('profile_id', userId)
      .limit(1)
      .maybeSingle();
    hasResidentRole = !!residentCheck;
    
    // Validate active role - if user doesn't have the requested role, use their actual role
    if (activeRole === 'syndic' && !hasSyndicRole) {
      // User requested syndic but doesn't have it - force resident role
      activeRole = 'resident';
      console.warn('[Mobile API] Dashboard: User requested syndic role but doesn\'t have it. Forcing resident role.');
    } else if (activeRole === 'resident' && !hasResidentRole) {
      // User requested resident but doesn't have it - this shouldn't happen, but fallback to profile role
      activeRole = userProfile.role || 'resident';
      console.warn('[Mobile API] Dashboard: User requested resident role but doesn\'t have it. Using profile role.');
    }

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
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [
        paymentsResult,
        incidentsResult,
        complaintsResult,
        feesResult,
      ] = await Promise.all([
        // Total payments for this resident
        supabase
          .from('payments')
          .select('id, amount, status, paid_at, created_at')
          .eq('user_id', userId)
          .eq('residence_id', residenceId),
        
        // Incidents for this resident
        supabase
          .from('incidents')
          .select('id, status, created_at')
          .eq('user_id', userId)
          .eq('residence_id', residenceId),
        
        // Complaints for this resident
        supabase
          .from('complaints')
          .select('id, status, created_at')
          .eq('complainant_id', userId)
          .eq('residence_id', residenceId),
        
        // Get fees (resident's payment obligations)
        supabase
          .from('fees')
          .select('id, amount, status, due_date, created_at')
          .eq('user_id', userId)
          .eq('residence_id', residenceId),
      ]);

      const allPayments = paymentsResult.data || [];
      const allIncidents = incidentsResult.data || [];
      const allComplaints = complaintsResult.data || [];
      const allFees = feesResult.data || [];

      // Calculate payment stats
      const totalPayments = allPayments.length;
      const completedPayments = allPayments.filter((p: any) => p.status === 'completed' || p.status === 'paid').length;
      const pendingPayments = allPayments.filter((p: any) => p.status === 'pending').length;
      const totalPaidAmount = allPayments
        .filter((p: any) => p.status === 'completed' || p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      
      // Monthly payment stats
      const monthlyPayments = allPayments.filter((p: any) => {
        if (!p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate >= startOfMonth;
      });
      const monthlyPaidAmount = monthlyPayments
        .filter((p: any) => p.status === 'completed' || p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

      // Fee stats
      const totalFees = allFees.length;
      const pendingFees = allFees.filter((f: any) => f.status === 'pending' || f.status === 'unpaid').length;
      const overdueFees = allFees.filter((f: any) => {
        if (f.status === 'overdue') return true;
        if (f.due_date) {
          const dueDate = new Date(f.due_date);
          return dueDate < now && (f.status === 'pending' || f.status === 'unpaid');
        }
        return false;
      }).length;
      const totalOwedAmount = allFees
        .filter((f: any) => f.status === 'pending' || f.status === 'unpaid' || f.status === 'overdue')
        .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
      const overdueAmount = allFees
        .filter((f: any) => {
          if (f.status === 'overdue') return true;
          if (f.due_date) {
            const dueDate = new Date(f.due_date);
            return dueDate < now && (f.status === 'pending' || f.status === 'unpaid');
          }
          return false;
        })
        .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);

      // Incident stats
      const totalIncidents = allIncidents.length;
      const openIncidents = allIncidents.filter((i: any) => 
        i.status === 'open' || i.status === 'in_progress'
      ).length;
      const resolvedIncidents = allIncidents.filter((i: any) => 
        i.status === 'resolved' || i.status === 'closed'
      ).length;

      // Complaint stats
      const totalComplaints = allComplaints.length;
      const openComplaints = allComplaints.filter((c: any) => 
        c.status === 'submitted' || c.status === 'reviewed'
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
            // Payment stats
            totalPayments,
            completedPayments,
            pendingPayments,
            totalPaidAmount,
            monthlyPaidAmount,
            monthlyPaymentsCount: monthlyPayments.length,
            // Fee stats
            totalFees,
            pendingFees,
            overdueFees,
            totalOwedAmount,
            overdueAmount,
            // Incident stats
            totalIncidents,
            openIncidents,
            resolvedIncidents,
            // Complaint stats
            totalComplaints,
            openComplaints,
            // Legacy fields for backward compatibility
            overduePayments: overdueFees,
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
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const [
        residentsResult,
        paymentsResult,
        incidentsResult,
        complaintsResult,
        feesResult,
        expensesResult,
      ] = await Promise.all([
        // Total residents (excluding syndic)
        supabase
          .from('profile_residences')
          .select('profile_id, profiles!inner(role)')
          .eq('residence_id', residenceId),
        
        // All payments
        supabase
          .from('payments')
          .select('id, amount, status, paid_at, created_at')
          .eq('residence_id', residenceId),
        
        // All incidents
        supabase
          .from('incidents')
          .select('id, status, created_at')
          .eq('residence_id', residenceId),
        
        // All complaints
        supabase
          .from('complaints')
          .select('id, status, created_at')
          .eq('residence_id', residenceId),
        
        // All fees
        supabase
          .from('fees')
          .select('id, amount, status, due_date, created_at')
          .eq('residence_id', residenceId),
        
        // All expenses
        supabase
          .from('expenses')
          .select('id, amount, expense_date, category')
          .eq('residence_id', residenceId),
      ]);

      const allResidents = residentsResult.data?.filter((r: any) => 
        r.profiles?.role !== 'syndic'
      ) || [];
      const totalResidents = allResidents.length;
      const allPayments = paymentsResult.data || [];
      const allIncidents = incidentsResult.data || [];
      const allComplaints = complaintsResult.data || [];
      const allFees = feesResult.data || [];
      const allExpenses = expensesResult.data || [];

      // Payment stats
      const totalPayments = allPayments.length;
      const completedPayments = allPayments.filter((p: any) => p.status === 'completed' || p.status === 'paid').length;
      const pendingPayments = allPayments.filter((p: any) => p.status === 'pending').length;
      const totalRevenue = allPayments
        .filter((p: any) => p.status === 'completed' || p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      
      // Monthly revenue stats
      const monthlyPayments = allPayments.filter((p: any) => {
        if (!p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate >= startOfMonth;
      });
      const monthlyRevenue = monthlyPayments
        .filter((p: any) => p.status === 'completed' || p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      
      // Last month revenue for comparison
      const lastMonthPayments = allPayments.filter((p: any) => {
        if (!p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate >= lastMonthStart && paidDate <= lastMonthEnd;
      });
      const lastMonthRevenue = lastMonthPayments
        .filter((p: any) => p.status === 'completed' || p.status === 'paid')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      
      const revenueGrowth = lastMonthRevenue > 0 
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      // Fee stats
      const totalFees = allFees.length;
      const pendingFees = allFees.filter((f: any) => f.status === 'pending' || f.status === 'unpaid').length;
      const overdueFees = allFees.filter((f: any) => {
        if (f.status === 'overdue') return true;
        if (f.due_date) {
          const dueDate = new Date(f.due_date);
          return dueDate < now && (f.status === 'pending' || f.status === 'unpaid');
        }
        return false;
      }).length;
      const totalExpectedRevenue = allFees.reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
      const pendingAmount = allFees
        .filter((f: any) => f.status === 'pending' || f.status === 'unpaid')
        .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
      const overdueAmount = allFees
        .filter((f: any) => {
          if (f.status === 'overdue') return true;
          if (f.due_date) {
            const dueDate = new Date(f.due_date);
            return dueDate < now && (f.status === 'pending' || f.status === 'unpaid');
          }
          return false;
        })
        .reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0);
      
      // Collection rate
      const collectionRate = totalExpectedRevenue > 0 
        ? (totalRevenue / totalExpectedRevenue) * 100 
        : 0;

      // Expense stats
      const totalExpenses = allExpenses.length;
      const monthlyExpenses = allExpenses.filter((e: any) => {
        if (!e.expense_date) return false;
        const expenseDate = new Date(e.expense_date);
        return expenseDate >= startOfMonth;
      });
      const monthlyExpensesAmount = monthlyExpenses.reduce((sum: number, e: any) => 
        sum + (Number(e.amount) || 0), 0);
      const totalExpensesAmount = allExpenses.reduce((sum: number, e: any) => 
        sum + (Number(e.amount) || 0), 0);

      // Net profit (revenue - expenses)
      const monthlyProfit = monthlyRevenue - monthlyExpensesAmount;
      const totalProfit = totalRevenue - totalExpensesAmount;

      // Incident stats
      const totalIncidents = allIncidents.length;
      const openIncidents = allIncidents.filter((i: any) => 
        i.status === 'open' || i.status === 'in_progress'
      ).length;
      const resolvedIncidents = allIncidents.filter((i: any) => 
        i.status === 'resolved' || i.status === 'closed'
      ).length;

      // Complaint stats
      const totalComplaints = allComplaints.length;
      const openComplaints = allComplaints.filter((c: any) => 
        c.status === 'submitted' || c.status === 'reviewed'
      ).length;
      const resolvedComplaints = allComplaints.filter((c: any) => 
        c.status === 'resolved'
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
            // Resident stats
            totalResidents,
            // Payment stats
            totalPayments,
            completedPayments,
            pendingPayments,
            totalRevenue,
            monthlyRevenue,
            monthlyPaymentsCount: monthlyPayments.length,
            revenueGrowth,
            // Fee stats
            totalFees,
            pendingFees,
            overdueFees,
            totalExpectedRevenue,
            pendingAmount,
            overdueAmount,
            collectionRate,
            // Expense stats
            totalExpenses,
            monthlyExpenses: monthlyExpenses.length,
            monthlyExpensesAmount,
            totalExpensesAmount,
            // Profit stats
            monthlyProfit,
            totalProfit,
            // Incident stats
            totalIncidents,
            openIncidents,
            resolvedIncidents,
            // Complaint stats
            totalComplaints,
            openComplaints,
            resolvedComplaints,
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

