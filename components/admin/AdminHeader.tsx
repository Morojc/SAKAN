'use client'

import { useState } from 'react'
import { Menu, Bell, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface AdminHeaderProps {
  admin: {
    id: string
    email: string
    full_name: string
    is_active: boolean
  }
}

export function AdminHeader({ admin }: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left Section - Mobile Menu & Title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Administration SAKAN</h1>
            <p className="text-sm text-gray-500">Gestion des syndics et résidences</p>
          </div>
        </div>

        {/* Right Section - Notifications & Profile */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </Button>

          {/* Admin Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-indigo-600 text-white">
                    {getInitials(admin.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{admin.full_name}</p>
                  <p className="text-xs text-gray-500">Administrateur</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{admin.full_name}</p>
                  <p className="text-xs text-gray-500">{admin.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={async () => {
                  await fetch('/api/admin/auth/logout', { method: 'POST' })
                  window.location.href = '/' // Redirect to home page
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

