import { Suspense } from 'react';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import ComplaintsContent from '@/components/app/complaints/ComplaintsContent';
import { AlertCircle } from 'lucide-react';
import { auth } from '@/lib/auth';

/**
 * Server component to fetch complaints data
 * Joins complaints with profiles and residences
 * Uses admin client to bypass RLS policy issues
 */
async function ComplaintsData() {
  console.log('[ComplaintsPage] Starting data fetch...');
  
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
      console.error('[ComplaintsPage] Error fetching user profile:', profileError);
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

    // All users must have a residence_id to view complaints
    if (!residenceId) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg">
            <h2 className="font-semibold mb-2">Residence Assignment Required</h2>
            <p className="mb-4">
              You need to be assigned to a residence before you can view complaints.
              Please contact your administrator.
            </p>
          </div>
        </div>
      );
    }

    console.log('[ComplaintsPage] Fetching complaints for residence_id:', residenceId);

    // Fetch complaints with joins
    let complaintsQuery = supabase
      .from('complaints')
      .select(`
        *,
        complainant:complainant_id (
          id,
          full_name
        ),
        complained_about:complained_about_id (
          id,
          full_name
        ),
        reviewer:reviewed_by (
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
      // Residents can only see their own complaints or complaints against them
      complaintsQuery = complaintsQuery.or(`complainant_id.eq.${userId},complained_about_id.eq.${userId}`);
    }
    // Syndics can see all complaints for their residence

    const { data: complaints, error: complaintsError } = await complaintsQuery
      .order('created_at', { ascending: false });

    if (complaintsError) {
      console.error('[ComplaintsPage] Error fetching complaints:', complaintsError);
      throw new Error('Failed to fetch complaints');
    }

    // Fetch residence details for UI context
    const { data: residence } = await supabase
      .from('residences')
      .select('id, name, address')
      .eq('id', residenceId)
      .single();

    // Fetch evidence counts for syndics
    let evidenceCounts: Record<number, number> = {};
    if (userRole === 'syndic' && complaints && complaints.length > 0) {
      const complaintIds = complaints.map((c: any) => c.id);
      const { data: evidenceData } = await supabase
        .from('complaint_evidence')
        .select('complaint_id')
        .in('complaint_id', complaintIds);
      
      // Count evidence per complaint
      evidenceData?.forEach((e: any) => {
        evidenceCounts[e.complaint_id] = (evidenceCounts[e.complaint_id] || 0) + 1;
      });
    }

    // Transform complaints to include names and evidence count
    const complaintsWithNames = (complaints || []).map((complaint: any) => ({
      ...complaint,
      complainant_name: complaint.complainant?.full_name || 'Unknown',
      complained_about_name: complaint.complained_about?.full_name || 'Unknown',
      reviewer_name: complaint.reviewer?.full_name || null,
      residence_name: complaint.residences?.name || residence?.name || 'Unknown',
      evidence_count: evidenceCounts[complaint.id] || 0,
    }));

    return (
      <ComplaintsContent 
        initialComplaints={complaintsWithNames} 
        currentUserId={userId}
        currentUserRole={userProfile?.role}
        currentUserResidenceId={residenceId}
        residenceName={residence?.name || 'Unknown'}
      />
    );

  } catch (error: any) {
    console.error('[ComplaintsPage] Fatal error:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Error Loading Complaints</h2>
          <p className="mb-2">{error.message || 'Failed to load complaints data'}</p>
        </div>
      </div>
    );
  }
}

/**
 * Main Complaints Page
 * Displays complaints management interface with table, submission, and review
 */
export default function ComplaintsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Complaints</h1>
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
        <ComplaintsData />
      </Suspense>
    </div>
  );
}

