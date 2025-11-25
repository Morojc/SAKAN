import { GET as AuthGET, POST as AuthPOST } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

/**
 * Wrapped GET handler with error handling
 * Ensures JSON responses even on errors
 */
export async function GET(request: NextRequest) {
  try {
    return await AuthGET(request)
  } catch (error: any) {
    console.error('[NextAuth Route] GET error:', error)
    
    // Handle redirects (authentication required)
    if (error.message === 'NEXT_REDIRECT') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Return JSON error instead of HTML
    return NextResponse.json(
      {
        error: 'Authentication error',
        message: error.message || 'An error occurred during authentication',
      },
      { status: 500 }
    )
  }
}

/**
 * Wrapped POST handler with error handling
 * Ensures JSON responses even on errors
 */
export async function POST(request: NextRequest) {
  try {
    return await AuthPOST(request)
  } catch (error: any) {
    console.error('[NextAuth Route] POST error:', error)
    
    // Handle redirects (authentication required)
    if (error.message === 'NEXT_REDIRECT') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Return JSON error instead of HTML
    return NextResponse.json(
      {
        error: 'Authentication error',
        message: error.message || 'An error occurred during authentication',
      },
      { status: 500 }
    )
  }
} 