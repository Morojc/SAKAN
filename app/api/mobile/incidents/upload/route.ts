import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadIncidentPhoto } from '@/app/app/incidents/actions';

/**
 * Mobile API: Upload incident photo
 * POST /api/mobile/incidents/upload
 */

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Create FormData for the server action
    const actionFormData = new FormData();
    actionFormData.append('file', file);

    const result = await uploadIncidentPhoto(actionFormData);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Mobile API] Incident upload POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

