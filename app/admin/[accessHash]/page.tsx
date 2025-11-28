import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

export const metadata = {
  title: 'Admin Login - SAKAN',
  description: 'Connexion administrateur SAKAN',
}

interface PageProps {
  params: Promise<{
    accessHash: string
  }>
}

export default async function AdminAccessPage({ params }: PageProps) {
  const { accessHash } = await params
  
  console.log('[Admin Access Page] ========================================')
  console.log('[Admin Access Page] Looking for access_hash:', accessHash)
  console.log('[Admin Access Page] URL param received:', accessHash)
  
  // Verify access hash exists
  const supabase = createSupabaseAdminClient()
  
  // First, check if ANY admins exist
  const { data: allAdmins, error: listError } = await supabase
    .from('admins')
    .select('id, email, access_hash, is_active')
    .limit(10)
  
  console.log('[Admin Access Page] All admins in database:', JSON.stringify(allAdmins, null, 2))
  console.log('[Admin Access Page] List error:', listError)
  
  // Now check for the specific hash
  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, email, is_active, access_hash')
    .eq('access_hash', accessHash)
    .eq('is_active', true)
    .maybeSingle()

  console.log('[Admin Access Page] Query for hash result:', JSON.stringify({ admin, error }, null, 2))
  console.log('[Admin Access Page] ========================================')

  if (error) {
    console.error('[Admin Access Page] Database error:', error)
    redirect('/404')
  }

  // If hash doesn't exist or admin is inactive, redirect to 404
  if (!admin) {
    console.log('[Admin Access Page] No admin found with hash:', accessHash)
    redirect('/404')
  }

  console.log('[Admin Access Page] ✅ Admin verified! Rendering login form...')
  console.log('[Admin Access Page] Admin email:', admin.email)
  console.log('[Admin Access Page] About to return JSX')

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SAKAN Admin</h1>
          <p className="text-gray-600 mt-2">Panneau d'administration</p>
        </div>

        {/* Login Form */}
        <AdminLoginForm accessHash={accessHash} adminEmail={admin.email} />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2024 SAKAN. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  )
}

