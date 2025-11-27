'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileCheck, Building2, Users, Settings, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  admin: {
    id: string
    email: string
    full_name: string
  }
}

const navigation = [
  {
    name: 'Tableau de bord',
    href: '/admin',
    icon: Home,
  },
  {
    name: 'Documents à vérifier',
    href: '/admin/documents',
    icon: FileCheck,
    badge: 'pending',
  },
  {
    name: 'Résidences',
    href: '/admin/residences',
    icon: Building2,
  },
  {
    name: 'Syndics',
    href: '/admin/syndics',
    icon: Users,
  },
  {
    name: 'Demandes de suppression',
    href: '/admin/deletion-requests',
    icon: Trash2,
    badge: 'pending',
  },
  {
    name: 'Paramètres',
    href: '/admin/settings',
    icon: Settings,
  },
]

export function AdminSidebar({ admin }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">S</span>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">SAKAN Admin</h2>
          <p className="text-xs text-gray-500">Panneau d'administration</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                  Nouveau
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Admin Info */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Connecté en tant que
        </div>
        <div className="text-sm font-medium text-gray-900 truncate">
          {admin.full_name}
        </div>
      </div>
    </div>
  )
}

