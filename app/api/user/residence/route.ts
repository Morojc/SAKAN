import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/user/residence - Get the user's residence ID
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get user's residence from profile_residences
    const { data: profileResidence, error } = await supabase
      .from('profile_residences')
      .select(`
        residence_id,
        role,
        residence:residences(id, name)
      `)
      .eq('profile_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !profileResidence) {
      return NextResponse.json(
        { success: false, error: 'No residence found for this user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        residence_id: profileResidence.residence_id,
        role: profileResidence.role,
        residence: profileResidence.residence,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/user/residence] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

