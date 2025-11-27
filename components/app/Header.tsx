"use client";

import { usePathname } from "next/navigation";
import { Menu, X, Building2, Search, Bell, Settings, Plus, UserCircle, LogOut } from "lucide-react";
import UserMenu from "@/components/user/UserMenu";
import Link from "next/link";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/app") {
      return pathname === "/app" || pathname === "/app/";
    }
    return pathname?.startsWith(path);
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Logo & Mobile Menu */}
        <div className="flex items-center gap-4">
          <button 
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-all duration-200" 
              aria-label="Toggle sidebar"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
            <Link href="/app" className="flex items-center gap-2.5 group">
              <div className="bg-gray-900 p-2 rounded-xl group-hover:scale-105 transition-transform duration-200">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                SAKAN
              </h1>
            </Link>
          </div>

          {/* Center: Modern Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full group">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
              <Input
                type="search"
                placeholder="Search anything..."
                className="pl-10 w-full bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl transition-all duration-200 shadow-sm focus:shadow-md"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
        </div>
      </div>

          {/* Right: Action Buttons and User Menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Action Buttons */}
            <div className="hidden lg:flex items-center">
              <Link href="/app/payments">
                <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg shadow-gray-900/20 transition-all hover:scale-105 active:scale-95">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Payment
                </Button>
              </Link>
            </div>

            <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>

            {/* Icons */}
            <div className="flex items-center gap-1">
              <button className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all relative group">
                <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>
              <Link href="/app/profile">
                <button className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all group">
                  <Settings className="h-5 w-5 group-hover:rotate-90 transition-transform duration-500" />
                </button>
              </Link>
            </div>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" 
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-900 p-2 rounded-lg">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-gray-900">SAKAN</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="h-full overflow-y-auto bg-gray-50/50">
                <Sidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}