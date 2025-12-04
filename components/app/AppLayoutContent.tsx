'use client';

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSidebar } from "./SidebarProvider";
import { motion } from "framer-motion";

export function AppLayoutContentClient({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? '0px' : '256px',
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden lg:block bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden"
      >
        <div className={`w-64 h-full ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <Sidebar />
        </div>
      </motion.aside>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

