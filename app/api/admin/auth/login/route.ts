import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'

export const dynamic = 'force-dynamic'

// Secret key for JWT (should be in env)
const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function POST(request: NextRequest) {
  try {
    const { email, password, accessHash } = await request.json()

    // Validate input
    if (!email || !password || !accessHash) {
      return NextResponse.json(
        { success: false, error: 'Données requises manquantes' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // First, verify the access hash matches the email
    const { data: adminCheck } = await supabase
      .from('admins')
      .select('id, email, access_hash')
      .eq('email', email)
      .eq('access_hash', accessHash)
      .eq('is_active', true)
      .maybeSingle()

    if (!adminCheck) {
      console.error('[Admin Login] Invalid access hash or email')
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    // Now verify password using the database function
    const { data: adminData, error } = await supabase
      .rpc('verify_admin_password', {
        p_email: email,
        p_password: password,
      })

    if (error || !adminData || (Array.isArray(adminData) && adminData.length === 0)) {
      console.error('[Admin Login] Authentication failed:', error)
      return NextResponse.json(
        { success: false, error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Handle both single result and array results
    const admin: any = Array.isArray(adminData) ? adminData[0] : adminData

    // Check if admin is active
    if (!admin || !admin.is_active) {
      return NextResponse.json(
        { success: false, error: 'Compte administrateur désactivé' },
        { status: 403 }
      )
    }

    // Check if user has an active NextAuth session (prevent dual authentication)
    const cookieStore = await cookies()
    const nextAuthSessionToken = cookieStore.get('next-auth.session-token')?.value || 
                                  cookieStore.get('__Secure-next-auth.session-token')?.value
    
    if (nextAuthSessionToken) {
      // Verify the session exists in database
      const { data: nextAuthSession } = await supabase
        .from('sessions')
        .select('id, expires')
        .eq('sessionToken', nextAuthSessionToken)
        .maybeSingle()
      
      // If session exists and is not expired, reject admin login
      if (nextAuthSession && new Date(nextAuthSession.expires) > new Date()) {
        console.log('[Admin Login] Rejected: User has active NextAuth session')
        return NextResponse.json(
          { 
            success: false, 
            error: 'Vous êtes déjà connecté en tant qu\'utilisateur. Veuillez vous déconnecter avant de vous connecter en tant qu\'administrateur.' 
          },
          { status: 403 }
        )
      }
    }

    // Generate session token
    const sessionToken = crypto.randomUUID()

    // Create JWT token
    const token = await new SignJWT({
      adminId: admin.admin_id,
      email: admin.email,
      fullName: admin.full_name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // Token expires in 7 days
      .sign(JWT_SECRET)

    // Store session in database
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    const { error: sessionError } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: admin.admin_id,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
      })

    if (sessionError) {
      console.error('[Admin Login] Error creating session:', sessionError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la création de la session' },
        { status: 500 }
      )
    }

    // Update last login time
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.admin_id)

    // Set cookie with session token (reuse cookieStore from above)
    cookieStore.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    console.log('[Admin Login] Login successful:', admin.email)

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.admin_id,
        email: admin.email,
        fullName: admin.full_name,
      },
    })
  } catch (error: any) {
    console.error('[Admin Login] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

