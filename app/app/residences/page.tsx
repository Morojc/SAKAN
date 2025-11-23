import { Suspense } from 'react';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { auth } from '@/lib/auth';
import { Building2, UserCog } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Server component to fetch residences with their syndics
 */
async function ResidencesData() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const supabase = createSupabaseAdminClient();

    // Get current user's profile to get their residence_id
    const { data: currentUserProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, residence_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[ResidencesPage] Error fetching user profile:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!currentUserProfile) {
      throw new Error('User profile not found');
    }

    const userResidenceId = currentUserProfile.residence_id;

    // Build query - filter by user's residence_id if they have one
    let residencesQuery = supabase
      .from('residences')
      .select('id, name, address, city, created_at')
      .order('name', { ascending: true });

    // All users (including syndics) only see their own residence
    if (userResidenceId) {
      residencesQuery = residencesQuery.eq('id', userResidenceId);
      console.log('[ResidencesPage] Showing residence with id =', userResidenceId);
    }

    const { data: residences, error: residencesError } = await residencesQuery;

    if (residencesError) {
      console.error('[ResidencesPage] Error fetching residences:', residencesError);
      throw new Error(`Failed to fetch residences: ${residencesError.message}`);
    }

    if (!residences || residences.length === 0) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No residences found.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // For each residence, fetch the syndic(s) associated with it
    const residencesWithSyndics = await Promise.all(
      residences.map(async (residence) => {
        // Fetch all syndics for this residence
        const { data: syndics, error: syndicsError } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            apartment_number,
            phone_number,
            role,
            created_at
          `)
          .eq('residence_id', residence.id)
          .eq('role', 'syndic')
          .order('full_name', { ascending: true });

        if (syndicsError) {
          console.error(`[ResidencesPage] Error fetching syndics for residence ${residence.id}:`, syndicsError);
        }

        // Fetch user emails separately (since the join might not work)
        const syndicIds = syndics?.map(s => s.id).filter(Boolean) || [];
        let userEmails: { id: string; email: string | null }[] = [];
        
        if (syndicIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, email')
            .in('id', syndicIds);
          
          userEmails = usersData || [];
        }

        // Combine syndics with their emails and mark current user
        const syndicsWithEmails = (syndics || []).map(syndic => {
          const userEmail = userEmails.find(u => u.id === syndic.id)?.email || null;
          const isCurrentUser = syndic.id === userId;
          return {
            ...syndic,
            email: userEmail,
            isCurrentUser,
          };
        });

        return {
          ...residence,
          syndics: syndicsWithEmails,
          syndicCount: syndicsWithEmails.length,
        };
      })
    );

    return (
      <div className="space-y-6">
        {residencesWithSyndics.map((residence) => (
          <Card key={residence.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {residence.name}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {residence.address}
                    {residence.city && `, ${residence.city}`}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="ml-4">
                  {residence.syndicCount} Syndic{residence.syndicCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {residence.syndics.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Syndic{residence.syndics.length !== 1 ? 's' : ''}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {residence.syndics.map((syndic) => (
                      <div
                        key={syndic.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          syndic.isCurrentUser
                            ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/10'
                            : 'bg-card hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold flex items-center gap-2">
                              {syndic.full_name}
                              {syndic.isCurrentUser && (
                                <Badge variant="default" className="text-xs">
                                  Vous
                                </Badge>
                              )}
                            </h4>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Syndic
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {syndic.apartment_number && (
                            <p>
                              <span className="font-medium">Appartement:</span> {syndic.apartment_number}
                            </p>
                          )}
                          {syndic.phone_number && (
                            <p>
                              <span className="font-medium">Téléphone:</span> {syndic.phone_number}
                            </p>
                          )}
                          {syndic.email && (
                            <p>
                              <span className="font-medium">Email:</span>{' '}
                              <a
                                href={`mailto:${syndic.email}`}
                                className="text-primary hover:underline"
                              >
                                {syndic.email}
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCog className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun syndic assigné à cette résidence</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  } catch (error: any) {
    console.error('[ResidencesPage] Fatal error:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
              <h2 className="font-semibold mb-2">Error Loading Residences</h2>
              <p>{error.message || 'Failed to load residences data'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

/**
 * Residences Page
 * Displays all residences with their associated syndics
 */
export default function ResidencesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Residences & Syndics</h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble de toutes les résidences et leurs syndics
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <ResidencesData />
      </Suspense>
    </div>
  );
}

