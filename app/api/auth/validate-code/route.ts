import { NextResponse } from 'next/server';
import { validateAccessCode } from '@/lib/utils/access-code';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ valid: false, message: 'Code is required' }, { status: 400 });
  }

  try {
    const result = await validateAccessCode(code);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating code:', error);
    return NextResponse.json({ valid: false, message: 'Internal server error' }, { status: 500 });
  }
}

