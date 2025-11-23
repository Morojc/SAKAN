import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteAccessCode, checkAccessCodeStatus } from '@/lib/utils/access-code';

/**
 * DELETE /api/account/cancel-code
 * Cancels an access code (deletes it)
 * Used when the original syndic cancels the role change process
 */
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // First verify the code belongs to the current user
    const status = await checkAccessCodeStatus(code);
    
    if (!status.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Get the code data to verify ownership
    const { createSupabaseAdminClient } = await import('@/utils/supabase/server');
    const supabase = createSupabaseAdminClient();
    
    const { data: codeDataArray } = await supabase
      .rpc('get_access_code_by_code', { p_code: code });
    
    const codeData = Array.isArray(codeDataArray) && codeDataArray.length > 0 ? codeDataArray[0] : null;
    
    if (!codeData) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    // Verify the code belongs to the current user
    if (codeData.original_user_id !== session.user.id) {
      return NextResponse.json({ 
        error: 'This access code does not belong to you' 
      }, { status: 403 });
    }

    // Check if code has already been used
    if (codeData.code_used) {
      return NextResponse.json({ 
        error: 'Cannot cancel: This code has already been used' 
      }, { status: 400 });
    }

    // Delete the code
    await deleteAccessCode(code);
    
    return NextResponse.json({ 
      success: true,
      message: 'Access code cancelled successfully. The role change process has been cancelled.'
    });
  } catch (error: any) {
    console.error('Error cancelling code:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

