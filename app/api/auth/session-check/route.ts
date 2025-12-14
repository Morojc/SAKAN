import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Session check endpoint
 * Used to verify if user is still authenticated without triggering full page reload
 */
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      }
    })
  } catch (error) {
    console.error('[Session Check] Error:', error)
    return NextResponse.json(
      { authenticated: false, error: 'Session check failed' },
      { status: 500 }
    )
  }
}

