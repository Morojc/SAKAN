import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // Get current user's residence_id
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('residence_id')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile?.residence_id) {
      return NextResponse.json({ error: 'User profile or residence not found' }, { status: 404 });
    }

    // Get all residents in the same residence, excluding the current user
    // And excluding users who are already syndics (though usually there's only one)
    const { data: residents, error: residentsError } = await supabase
      .from('profiles')
      .select('id, full_name, apartment_number') // Email is in users table, not profiles
      .eq('residence_id', userProfile.residence_id)
      .neq('id', userId)
      .neq('role', 'syndic') // Only allow selecting non-syndics
      .order('full_name');

    if (residentsError) {
      console.error('Error fetching residents:', residentsError);
      return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
    }

    // If no residents found, return empty array
    if (!residents || residents.length === 0) {
      return NextResponse.json({ residents: [] });
    }

    // Fetch emails from the users table for these profiles
    const userIds = residents.map(r => r.id);
    
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);
        
      if (!usersError && usersData) {
        // Merge email data
        const residentsWithEmail = residents.map(resident => {
          const user = usersData.find(u => u.id === resident.id);
          return {
            ...resident,
            email: user?.email || null
          };
        });
        
        return NextResponse.json({ residents: residentsWithEmail });
      } else if (usersError) {
        console.error('Error fetching user emails:', usersError);
        // Return residents without email if users query fails
        const residentsWithoutEmail = residents.map(resident => ({
          ...resident,
          email: null
        }));
        return NextResponse.json({ residents: residentsWithoutEmail });
      }
    }

    // Fallback: return residents without email
    const residentsWithoutEmail = residents.map(resident => ({
      ...resident,
      email: null
    }));
    return NextResponse.json({ residents: residentsWithoutEmail });
  } catch (error: any) {
    console.error('Error in replacement-residents API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

