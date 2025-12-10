import { Suspense } from 'react';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
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
    
    // Get user's profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[ResidentsPage] Error fetching user profile:', profileError);
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

    // All users (including syndics) must have a residence_id to view residents
    if (!residenceId) {
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

    console.log('[ResidentsPage] Fetching residents and guards for residence_id:', residenceId);

    // Fetch residents via junction table
    // Include all residents (verified and unverified) to show verification status
    const { data: residentLinks, error: linkError } = await supabase
        .from('profile_residences')
        .select(`
            apartment_number,
            verified,
            profiles (
                id,
                full_name,
                phone_number,
                role,
                created_at,
                email_verified
            )
        `)
        .eq('residence_id', residenceId);

    if (linkError) {
        console.error('[ResidentsPage] Error fetching residents:', linkError);
        throw new Error('Failed to fetch residents');
    }

    // Transform residents to flat profile structure expected by UI
    const residentProfiles = residentLinks?.map(link => {
        const p = link.profiles as any; // Cast because nested type inference might be tricky
        return {
            ...p,
            apartment_number: link.apartment_number,
            residence_id: residenceId, // Synthesize this for UI compatibility
            verified: link.verified || false, // Get verification status from profile_residences
        };
    }) || [];

    // Fetch guard for this residence (if exists)
    // Guards are assigned via residences.guard_user_id (1:1 relationship)
    let guardProfile = null;
    const { data: residenceData, error: residenceError } = await supabase
        .from('residences')
        .select('id, guard_user_id')
        .eq('id', residenceId)
        .maybeSingle();

    if (residenceError) {
        console.warn('[ResidentsPage] Error fetching residence:', residenceError);
    } else if (residenceData?.guard_user_id) {
        // Fetch guard's profile
        const { data: guardProfileData, error: guardError } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number, role, created_at, verified')
            .eq('id', residenceData.guard_user_id)
            .maybeSingle();

        if (guardError) {
            console.warn('[ResidentsPage] Error fetching guard profile:', guardError);
        } else if (guardProfileData) {
            guardProfile = {
                ...guardProfileData,
                apartment_number: null, // Guards don't have apartment numbers
                residence_id: residenceId,
            };
        }
    }

    // Combine residents and guard
    const profiles = guardProfile 
        ? [...residentProfiles, guardProfile]
        : residentProfiles;

    // Fetch residence details for UI context
    const { data: residence } = await supabase
        .from('residences')
        .select('id, name, address')
        .eq('id', residenceId)
        .single();

    // Fetch fees
    const { data: fees, error: feesError } = await supabase
      .from('fees')
      .select('*')
      .eq('residence_id', residenceId)
      .order('created_at', { ascending: false });

    if (feesError) console.warn('[ResidentsPage] Error fetching fees:', feesError);

    // Fetch user emails from users table (NextAuth)
    const userIds = profiles.map(p => p.id).filter(Boolean);
    let users: { id: string; email: string | null }[] | null = null;
    
    if (userIds.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIds);
        users = usersData;
      } catch (_error) {
        console.warn('Error fetching emails');
      }
    }

    // Combine data
    const residentsWithFees = profiles.map(profile => {
      const userEmail = users?.find(u => u.id === profile.id)?.email || null;
      const residentFees = fees?.filter(f => f.user_id === profile.id) || [];
      const outstandingFees = residentFees
        .filter(f => f.status === 'unpaid' || f.status === 'overdue')
        .reduce((sum, f) => sum + Number(f.amount), 0);

      return {
        id: profile.id,
        full_name: profile.full_name,
        apartment_number: profile.apartment_number,
        phone_number: profile.phone_number,
        role: profile.role,
        created_at: profile.created_at,
        residence_id: residenceId,
        email: userEmail,
        verified: profile.verified || false, // Include verification status
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
    });

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
    console.error('[ResidentsPage] Fatal error:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Error Loading Residents</h2>
          <p className="mb-2">{error.message || 'Failed to load residents data'}</p>
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
