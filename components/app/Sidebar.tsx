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
  ChevronRight,
  Receipt
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [subscription, setSubscription] = useState<{ days: number; plan: string } | null>(null);

  useEffect(() => {
    const fetchSub = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setSubscription({
            days: data.subscriptionData?.days_remaining ?? 0,
            plan: data.planName || 'Free'
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSub();
  }, []);

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
        { href: "/app/residences", label: "Residences & Syndics", icon: Building2 },
        { href: "/app/expenses", label: "Expenses", icon: Receipt },
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
    <div className="h-full flex flex-col bg-white border-r border-gray-100 w-full shrink-0">
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

      {/* Subscription Status Card */}
      <div className="p-4 border-t border-gray-100">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-5 text-white shadow-xl transform hover:scale-[1.02] transition-transform duration-300">
          {/* Background decoration */}
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-indigo-500/20 blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="mb-6 flex items-start justify-between">
              <div className="rounded-xl bg-white/10 p-2 backdrop-blur-sm border border-white/10 shadow-inner">
                <CreditCard size={20} className="text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 bg-black/20 px-2 py-1 rounded-full backdrop-blur-md border border-white/5">
                {subscription?.plan || 'Loading...'} Plan
              </span>
            </div>
            
            <div className="mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">
                  {subscription?.days ?? 0}
                </span>
                <span className="text-sm font-medium text-white/60">days left</span>
              </div>
            </div>
            
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-medium text-white/50 mb-1.5">
                  <span>Subscription</span>
                  <span>{Math.min(((subscription?.days || 0) / 30) * 100, 100).toFixed(0)}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30 border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(((subscription?.days || 0) / 30) * 100, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
                  />
                </div>
              </div>
              
              <Link href="/app/billing">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors border border-white/10 backdrop-blur-sm group"
                >
                  <ChevronRight size={16} className="text-white group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}