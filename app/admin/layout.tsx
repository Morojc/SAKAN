import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { getAdminUser } from "@/lib/admin-auth"

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get current pathname to check if we're on the login page
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  
  // Login pages use pattern: /admin/[12-char-hash]
  const isLoginPage = /^\/admin\/[a-z0-9]{12}$/.test(pathname)
  
  // Check hash diagnostic page
  const isCheckHashPage = pathname === '/admin/check-hash'
  
  // If on login page or check-hash page, render children without auth check
  if (isLoginPage || isCheckHashPage) {
    return <>{children}</>
  }
  
  // For all other admin routes, check if admin is authenticated
  const admin = await getAdminUser()

  if (!admin) {
    // Not authenticated - redirect to 404 (they need the unique hash URL)
    redirect('/404')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <AdminSidebar admin={admin} />
      </aside>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader admin={admin} />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}

