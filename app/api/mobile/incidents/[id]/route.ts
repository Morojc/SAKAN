import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateIncident, deleteIncident } from '@/app/app/incidents/actions';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Mobile API: Incident by ID
 * GET /api/mobile/incidents/[id] - Get incident details
 * PATCH /api/mobile/incidents/[id] - Update incident
 * DELETE /api/mobile/incidents/[id] - Delete incident
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid incident ID' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch incident with joins
    const { data: incident, error } = await supabase
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
      .eq('id', id)
      .maybeSingle();

    if (error || !incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    // Transform incident
    const incidentWithNames = {
      ...incident,
      reporter_name: incident.reporter?.full_name || 'Unknown',
      assignee_name: incident.assignee?.full_name || null,
      residence_name: incident.residences?.name || 'Unknown',
    };

    return NextResponse.json({ success: true, data: incidentWithNames });
  } catch (error: any) {
    console.error('[Mobile API] Incident GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid incident ID' }, { status: 400 });
    }

    const body = await request.json();
    const result = await updateIncident({
      id,
      ...body,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Incident PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid incident ID' }, { status: 400 });
    }

    const result = await deleteIncident(id);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Incident DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

