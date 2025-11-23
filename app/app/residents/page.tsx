import { Suspense } from 'react';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import ResidentsContent from '@/components/app/residents/ResidentsContent';
import { Users } from 'lucide-react';
import { auth } from '@/lib/auth';

/**
 * Server component to fetch residents data
 * Joins profiles with users and fetches related fees
 * Uses admin client to bypass RLS policy issues
 */
async function ResidentsData() {
  console.log('[ResidentsPage] Starting data fetch...');
  
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Use admin client to bypass RLS policy recursion issues
    const supabase = createSupabaseAdminClient();
    
    // Get user's profile and residence_id
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('residence_id, role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[ResidentsPage] Error fetching user profile:', {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
      });
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const residenceId = userProfile.residence_id;
    const userRole = userProfile.role;

    // If user is syndic/admin and has no residence, show all residents
    // Otherwise, require residence_id
    if (!residenceId && userRole !== 'syndic') {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg">
            <h2 className="font-semibold mb-2">Residence Assignment Required</h2>
            <p className="mb-4">
              You need to be assigned to a residence before you can view residents.
              Please contact your administrator.
            </p>
          </div>
        </div>
      );
    }

    console.log('[ResidentsPage] Fetching residents for residence_id:', residenceId || 'ALL (syndic)');

    // Build query - filter by residence_id if user has one, otherwise show all (for syndic)
    // Exclude profiles with role 'syndic' - only show residents and guards
    let profilesQuery = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        apartment_number,
        phone_number,
        role,
        created_at,
        residence_id,
        residences (
          id,
          name,
          address
        )
      `)
      .neq('role', 'syndic') // Exclude syndic profiles
      .order('full_name', { ascending: true });

    // For syndics: show ALL residents (no filtering by residence_id)
    // For non-syndics: show only residents in their residence
    if (userRole === 'syndic') {
      // Syndics see all residents regardless of residence_id
      console.log('[ResidentsPage] Syndic mode: showing ALL residents (no residence_id filter, excluding syndics)');
      // No filter applied - will fetch all profiles except syndics
    } else if (residenceId) {
      // Non-syndics only see residents in their residence
      profilesQuery = profilesQuery.eq('residence_id', residenceId);
      console.log('[ResidentsPage] Non-syndic mode: showing residents with residence_id =', residenceId, '(excluding syndics)');
    } else {
      // Non-syndic with no residence_id - should not reach here (handled by earlier check)
      console.log('[ResidentsPage] Warning: Non-syndic user has no residence_id');
    }

    // Fetch all profiles (no limit) to ensure we get all residents
    const { data: profiles, error: profilesError, count } = await profilesQuery;

    if (profilesError) {
      console.error('[ResidentsPage] Error fetching profiles:', {
        message: profilesError.message,
        code: profilesError.code,
        details: profilesError.details,
        hint: profilesError.hint,
      });
      throw new Error(`Failed to fetch residents: ${profilesError.message || 'Unknown error'}`);
    }

    console.log('[ResidentsPage] Fetched', profiles?.length || 0, 'profiles', {
      residenceId: residenceId || 'ALL',
      userRole,
      profilesCount: profiles?.length,
      sampleIds: profiles?.slice(0, 3).map(p => ({ id: p.id, name: p.full_name, residence_id: p.residence_id })),
    });

    // Build fees query - filter by residence_id if user has one
    let feesQuery = supabase
      .from('fees')
      .select(`
        id,
        user_id,
        title,
        amount,
        due_date,
        status,
        created_at,
        residence_id
      `)
      .order('created_at', { ascending: false });

    // For syndics: show all fees (no filtering)
    // For non-syndics: filter by residence_id
    if (userRole !== 'syndic' && residenceId) {
      feesQuery = feesQuery.eq('residence_id', residenceId);
    }

    const { data: fees, error: feesError } = await feesQuery;

    if (feesError) {
      console.error('[ResidentsPage] Error fetching fees:', {
        message: feesError.message,
        code: feesError.code,
        details: feesError.details,
        hint: feesError.hint,
      });
      // Continue without fees - they're not critical
      console.warn('[ResidentsPage] Continuing without fees data');
    }

    console.log('[ResidentsPage] Fetched', fees?.length || 0, 'fees');

    // Fetch user emails from users table (NextAuth)
    const userIds = profiles?.map(p => p.id).filter(Boolean) || [];
    let users: { id: string; email: string | null }[] | null = null;
    
    if (userIds.length > 0) {
      try {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);

        if (usersError) {
          console.warn('[ResidentsPage] Could not fetch user emails:', {
            message: usersError.message,
            code: usersError.code,
          });
          // Email is optional - continue without it
        } else {
          users = usersData;
          console.log('[ResidentsPage] Fetched', users?.length || 0, 'user emails');
        }
      } catch (error: any) {
        console.warn('[ResidentsPage] Error fetching user emails:', error.message);
        // Email is optional - continue without it
      }
    }

    // Combine profiles with user emails and calculate outstanding fees
    const residentsWithFees = profiles?.map(profile => {
      const userEmail = users?.find(u => u.id === profile.id)?.email || null;
      const residentFees = fees?.filter(f => f.user_id === profile.id) || [];
      const outstandingFees = residentFees
        .filter(f => f.status === 'unpaid' || f.status === 'overdue')
        .reduce((sum, f) => sum + Number(f.amount), 0);

      // Handle residences - it might be an array or single object from Supabase
      const residence = Array.isArray(profile.residences) 
        ? profile.residences[0] || null
        : profile.residences || null;

      return {
        id: profile.id,
        full_name: profile.full_name,
        apartment_number: profile.apartment_number,
        phone_number: profile.phone_number,
        role: profile.role,
        created_at: profile.created_at,
        residence_id: profile.residence_id,
        email: userEmail,
        fees: residentFees,
        outstandingFees,
        feeCount: residentFees.length,
        unpaidFeeCount: residentFees.filter(f => f.status === 'unpaid' || f.status === 'overdue').length,
        residences: residence ? {
          id: residence.id,
          name: residence.name,
          address: residence.address,
        } : null,
      };
    }) || [];

        console.log('[ResidentsPage] Data normalized. Total residents:', residentsWithFees.length);

        return (
          <ResidentsContent 
            initialResidents={residentsWithFees} 
            initialFees={fees || []}
            currentUserId={userId}
            currentUserRole={userProfile?.role}
            currentUserResidenceId={residenceId}
          />
        );
  } catch (error: any) {
    console.error('[ResidentsPage] Fatal error:', {
      message: error.message,
      stack: error.stack,
      error: error,
    });
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Error Loading Residents</h2>
          <p className="mb-2">{error.message || 'Failed to load residents data'}</p>
          <p className="text-sm opacity-75">
            Please check your authentication and try refreshing the page. If the problem persists, contact your administrator.
          </p>
        </div>
      </div>
    );
  }
}

/**
 * Main Residents Page
 * Displays residents management interface with table, search, filters, and CRUD operations
 */
export default function ResidentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Residents</h1>
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
        <ResidentsData />
      </Suspense>
    </div>
  );
}
