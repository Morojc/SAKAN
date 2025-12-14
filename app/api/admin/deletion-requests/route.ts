import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getAdminId } from '@/lib/admin-auth';

/**
 * GET /api/admin/deletion-requests
 * Get all pending deletion requests
 */
export async function GET() {
  try {
    const adminId = await getAdminId();
    
    if (!adminId) {
      return NextResponse.json({ error: 'Not authenticated as admin' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const dbasakanClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { db: { schema: 'dbasakan' }, auth: { persistSession: false } }
    );

    // Get all pending deletion requests
    const { data: requests, error: requestsError } = await dbasakanClient
      .from('syndic_deletion_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (requestsError) {
      console.error('[Admin Deletion Requests] Error fetching requests:', requestsError);
      return NextResponse.json({ error: 'Failed to fetch deletion requests' }, { status: 500 });
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] }, { status: 200 });
    }

    // Get syndic profiles and emails
    const syndicIds = requests.map(r => r.syndic_user_id);
    const { data: syndicProfiles } = await dbasakanClient
      .from('profiles')
      .select('id, full_name, phone_number')
      .in('id', syndicIds);

    const { data: syndicUsers } = await dbasakanClient
      .from('users')
      .select('id, email')
      .in('id', syndicIds);

    // Get residence details
    const residenceIds = requests.map(r => r.residence_id);
    const { data: residences } = await dbasakanClient
      .from('residences')
      .select('id, name, address, city')
      .in('id', residenceIds);

    // Get eligible successors for each residence
    const requestsWithDetails = await Promise.all(
      requests.map(async (request) => {
        const syndicProfile = syndicProfiles?.find(p => p.id === request.syndic_user_id);
        const syndicUser = syndicUsers?.find(u => u.id === request.syndic_user_id);
        const residence = residences?.find(r => r.id === request.residence_id);

        // Get eligible successors (residents in this residence, excluding the syndic)
        const { data: otherResidents, error: residentsError } = await dbasakanClient
          .from('profile_residences')
          .select('profile_id')
          .eq('residence_id', request.residence_id)
          .neq('profile_id', request.syndic_user_id);

        console.log(`[Admin Deletion Requests] Request ${request.id}: Found ${otherResidents?.length || 0} other residents`, { residentsError });

        const otherResidentIds = otherResidents?.map((r: any) => r.profile_id) || [];

        // Fallback to public schema if not found in dbasakan
        if (otherResidentIds.length === 0 && !residentsError) {
          const supabase = createSupabaseAdminClient();
          const { data: publicResidents } = await supabase
            .from('profile_residences')
            .select('profile_id')
            .eq('residence_id', request.residence_id)
            .neq('profile_id', request.syndic_user_id);
          
          if (publicResidents && publicResidents.length > 0) {
            otherResidentIds.push(...publicResidents.map((r: any) => r.profile_id));
            console.log(`[Admin Deletion Requests] Request ${request.id}: Found ${publicResidents.length} residents in public schema`);
          }
        }

        let eligibleSuccessors: any[] = [];
        let finalProfiles: any[] = [];
        let users: any[] = [];

        if (otherResidentIds.length > 0) {
          const { data: profiles, error: profilesError } = await dbasakanClient
            .from('profiles')
            .select('id, full_name, phone_number, role')
            .in('id', otherResidentIds);

          console.log(`[Admin Deletion Requests] Request ${request.id}: Found ${profiles?.length || 0} profiles`, { profilesError });

          // Fallback to public schema for profiles
          finalProfiles = profiles || [];
          if (finalProfiles.length === 0 && profilesError) {
            const supabase = createSupabaseAdminClient();
            const { data: publicProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, phone_number, role')
              .in('id', otherResidentIds);
            
            if (publicProfiles && publicProfiles.length > 0) {
              finalProfiles = publicProfiles;
              console.log(`[Admin Deletion Requests] Request ${request.id}: Found ${publicProfiles.length} profiles in public schema`);
            }
          }

          const { data: usersData, error: usersError } = await dbasakanClient
            .from('users')
            .select('id, email')
            .in('id', otherResidentIds);

          console.log(`[Admin Deletion Requests] Request ${request.id}: Found ${usersData?.length || 0} users`, { usersError });

          users = usersData || [];

          eligibleSuccessors = otherResidentIds.map((id: string) => {
            const profile = finalProfiles?.find((p: any) => p.id === id);
            const user = users?.find((u: any) => u.id === id);
            
            return {
              id,
              full_name: profile?.full_name || null,
              phone_number: profile?.phone_number || null,
              email: user?.email || null,
              role: profile?.role || null
            };
          });

          // Filter out syndics
          eligibleSuccessors = eligibleSuccessors.filter((s: any) => s.role !== 'syndic');
          
          console.log(`[Admin Deletion Requests] Request ${request.id}: ${eligibleSuccessors.length} eligible successors after filtering syndics`);
        } else {
          console.log(`[Admin Deletion Requests] Request ${request.id}: No other residents found in residence ${request.residence_id}`);
        }

        // Get pre-selected successor details if exists
        let selectedSuccessor = null;
        if (request.successor_user_id) {
          // Fetch the selected successor's profile and user data if not already fetched
          let selectedProfile = finalProfiles?.find((p: any) => p.id === request.successor_user_id);
          let selectedUser = users?.find((u: any) => u.id === request.successor_user_id);

          // If not found in the eligible successors list, fetch separately
          if (!selectedProfile) {
            const { data: profileData } = await dbasakanClient
              .from('profiles')
              .select('id, full_name, phone_number, role')
              .eq('id', request.successor_user_id)
              .maybeSingle();
            
            selectedProfile = profileData;
            
            // Fallback to public schema
            if (!selectedProfile) {
              const supabase = createSupabaseAdminClient();
              const { data: publicProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone_number, role')
                .eq('id', request.successor_user_id)
                .maybeSingle();
              selectedProfile = publicProfile;
            }
          }

          if (!selectedUser) {
            const { data: userData } = await dbasakanClient
              .from('users')
              .select('id, email')
              .eq('id', request.successor_user_id)
              .maybeSingle();
            
            selectedUser = userData;
          }
          
          selectedSuccessor = {
            id: request.successor_user_id,
            full_name: selectedProfile?.full_name || null,
            phone_number: selectedProfile?.phone_number || null,
            email: selectedUser?.email || null,
            role: selectedProfile?.role || null
          };
        }

        return {
          ...request,
          syndic: {
            id: request.syndic_user_id,
            full_name: syndicProfile?.full_name || null,
            email: syndicUser?.email || null,
            phone_number: syndicProfile?.phone_number || null
          },
          residence: residence ? {
            id: residence.id,
            name: residence.name,
            address: residence.address,
            city: residence.city
          } : null,
          eligibleSuccessors,
          selectedSuccessor
        };
      })
    );

    return NextResponse.json({ requests: requestsWithDetails }, { status: 200 });
  } catch (error: any) {
    console.error('[Admin Deletion Requests] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

