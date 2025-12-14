import { Suspense } from 'react';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import ExpensesContent from '@/components/app/expenses/ExpensesContent';
import { Receipt } from 'lucide-react';
import { auth } from '@/lib/auth';

/**
 * Server component to fetch expenses data
 * Joins expenses with profiles and residences
 * Uses admin client to bypass RLS policy issues
 */
async function ExpensesData() {
  console.log('[ExpensesPage] Starting data fetch...');
  
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Use admin client to bypass RLS policy recursion issues
    const supabase = createSupabaseAdminClient();
    
    // Get user's profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[ExpensesPage] Error fetching user profile:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const userRole = userProfile.role;
    let residenceId = null;

    // Resolve Residence ID based on role
    if (userRole === 'syndic') {
        const { data: res } = await supabase.from('residences').select('id').eq('syndic_user_id', userId).maybeSingle();
        residenceId = res?.id;
    } else if (userRole === 'guard') {
        const { data: res } = await supabase.from('residences').select('id').eq('guard_user_id', userId).maybeSingle();
        residenceId = res?.id;
    } else {
        // Resident - fetch from profile_residences
        const { data: pr } = await supabase.from('profile_residences').select('residence_id').eq('profile_id', userId).limit(1).maybeSingle();
        residenceId = pr?.residence_id;
    }

    // All users must have a residence_id to view expenses
    if (!residenceId) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg">
            <h2 className="font-semibold mb-2">Residence Assignment Required</h2>
            <p className="mb-4">
              You need to be assigned to a residence before you can view expenses.
              Please contact your administrator.
            </p>
          </div>
        </div>
      );
    }

    console.log('[ExpensesPage] Fetching expenses for residence_id:', residenceId);

    // Fetch expenses with joins
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        *,
        profiles:created_by (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name,
          address
        )
      `)
      .eq('residence_id', residenceId)
      .order('expense_date', { ascending: false });

    if (expensesError) {
      console.error('[ExpensesPage] Error fetching expenses:', expensesError);
      throw new Error('Failed to fetch expenses');
    }

    // Fetch residence details for UI context
    const { data: residence } = await supabase
      .from('residences')
      .select('id, name, address')
      .eq('id', residenceId)
      .single();

    // Transform expenses to include creator name
    const expensesWithCreator = (expenses || []).map((expense: any) => ({
      ...expense,
      creator_name: expense.profiles?.full_name || 'Unknown',
      residence_name: expense.residences?.name || residence?.name || 'Unknown',
    }));

    return (
      <ExpensesContent 
        initialExpenses={expensesWithCreator} 
        currentUserId={userId}
        currentUserRole={userProfile?.role}
        currentUserResidenceId={residenceId}
        residenceName={residence?.name || 'Unknown'}
      />
    );

  } catch (error: any) {
    console.error('[ExpensesPage] Fatal error:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Error Loading Expenses</h2>
          <p className="mb-2">{error.message || 'Failed to load expenses data'}</p>
        </div>
      </div>
    );
  }
}

/**
 * Main Expenses Page
 * Displays expenses management interface with table, summary cards, and CRUD operations
 */
export default function ExpensesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Receipt className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Expenses</h1>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--background)] rounded-lg p-4 shadow animate-pulse">
                <div className="h-6 bg-muted rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        }
      >
        <ExpensesData />
      </Suspense>
    </div>
  );
}

