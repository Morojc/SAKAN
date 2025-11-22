"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  AlertCircle, 
  Megaphone, 
  UserCircle,
  Building2,
  FileText,
  Calendar,
  Settings,
  BarChart3,
  MessageSquare,
  LogOut,
  ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";

export function Sidebar() {
  const pathname = usePathname();

  const navigationItems = [
    { 
      category: "Main",
      items: [
        { href: "/app", label: "Overview", icon: LayoutDashboard },
        { href: "/app/residents", label: "Residents", icon: Users },
        { href: "/app/payments", label: "Payments", icon: CreditCard },
      ]
    },
    {
      category: "Management",
      items: [
        { href: "/app/incidents", label: "Incidents", icon: AlertCircle },
        { href: "/app/announcements", label: "Announcements", icon: Megaphone },
        { href: "/app/calendar", label: "Calendar", icon: Calendar },
      ]
    },
    {
      category: "System",
      items: [
        { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/app/settings", label: "Settings", icon: Settings },
      ]
    }
  ];

  const isActive = (href: string) => {
    if (href === "/app") {
      return pathname === "/app" || pathname === "/app/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-100 w-64 shrink-0">
      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-8 overflow-y-auto custom-scrollbar">
        {navigationItems.map((section, idx) => (
          <div key={section.category} className="space-y-2">
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {section.category}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block relative group"
                  >
                    {active && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-gray-900 rounded-xl"
                        transition={{ type: "spring", duration: 0.6 }}
                      />
                    )}
                    <span className={`
                      relative flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200
                      ${active ? "text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}
                    `}>
                      <span className="flex items-center gap-3">
                        <Icon size={20} className={active ? "text-white" : "text-gray-500 group-hover:text-gray-900"} />
                        <span className="font-medium text-sm">{item.label}</span>
                      </span>
                      {active && <ChevronRight size={16} className="text-gray-400" />}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <Link href="/app/profile">
          <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white shadow-lg">
                <span className="font-bold text-sm">S</span>
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold text-gray-900">Syndic Account</div>
              <div className="text-xs text-gray-500">Manage your building</div>
            </div>
            <Settings size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        </Link>
      </div>
    </div>
  );
}