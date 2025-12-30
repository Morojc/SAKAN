import { Suspense } from 'react';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import IncidentsContent from '@/components/app/incidents/IncidentsContent';
import { AlertCircle } from 'lucide-react';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Server component to fetch incidents data
 * Joins incidents with profiles and residences
 * Uses admin client to bypass RLS policy issues
 */
async function IncidentsData() {
  console.log('[IncidentsPage] Starting data fetch...');
  
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
      console.error('[IncidentsPage] Error fetching user profile:', profileError);
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

    // All users must have a residence_id to view incidents
    if (!residenceId) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg">
            <h2 className="font-semibold mb-2">Residence Assignment Required</h2>
            <p className="mb-4">
              You need to be assigned to a residence before you can view incidents.
              Please contact your administrator.
            </p>
          </div>
        </div>
      );
    }

    console.log('[IncidentsPage] Fetching incidents for residence_id:', residenceId);

    // Fetch incidents with joins
    let incidentsQuery = supabase
      .from('incidents')
      .select(`
        *,
        reporter:user_id (
          id,
          full_name
        ),
        assignee:assigned_to (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name,
          address
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering
    if (userRole === 'resident') {
      // Residents can only see their own incidents
      incidentsQuery = incidentsQuery.eq('user_id', userId);
    }
    // Syndics and guards can see all incidents for their residence

    const { data: incidents, error: incidentsError } = await incidentsQuery
      .order('created_at', { ascending: false });

    if (incidentsError) {
      console.error('[IncidentsPage] Error fetching incidents:', incidentsError);
      throw new Error('Failed to fetch incidents');
    }

    // Fetch residence details for UI context
    const { data: residence } = await supabase
      .from('residences')
      .select('id, name, address')
      .eq('id', residenceId)
      .single();

    // Transform incidents to include reporter and assignee names
    const incidentsWithNames = (incidents || []).map((incident: any) => ({
      ...incident,
      reporter_name: incident.reporter?.full_name || 'Unknown',
      assignee_name: incident.assignee?.full_name || null,
      residence_name: incident.residences?.name || residence?.name || 'Unknown',
    }));

    return (
      <IncidentsContent 
        initialIncidents={incidentsWithNames} 
        currentUserId={userId}
        currentUserRole={userProfile?.role}
        currentUserResidenceId={residenceId}
        residenceName={residence?.name || 'Unknown'}
      />
    );

  } catch (error: any) {
    console.error('[IncidentsPage] Fatal error:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Error Loading Incidents</h2>
          <p className="mb-2">{error.message || 'Failed to load incidents data'}</p>
        </div>
      </div>
    );
  }
}

/**
 * Main Incidents Page
 * Displays incidents management interface with table, reporting, and assignment
 */
export default function IncidentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Incidents</h1>
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
        <IncidentsData />
      </Suspense>
    </div>
  );
}

