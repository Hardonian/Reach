'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

interface ConsoleLayoutProps {
  children: React.ReactNode;
}

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navItems = [
    { href: ROUTES.CONSOLE.HOME, label: 'Dashboard', icon: 'dashboard' },
    { href: ROUTES.CONSOLE.AGENTS.HOME, label: 'Agents', icon: 'smart_toy' },
    { href: ROUTES.CONSOLE.RUNNERS, label: 'Runners', icon: 'executor' },
    { href: ROUTES.CONSOLE.TRACES, label: 'Traces', icon: 'analytics' },
    { href: ROUTES.CONSOLE.EVALUATION.HOME, label: 'Evaluation', icon: 'rule' },
    { href: ROUTES.CONSOLE.GOVERNANCE.HOME, label: 'Governance', icon: 'gavel' },
    { href: ROUTES.CONSOLE.DATASETS, label: 'Datasets', icon: 'database' },
    { href: ROUTES.CONSOLE.COST.HOME, label: 'Cost', icon: 'payments' },
    { href: ROUTES.CONSOLE.ALERTS, label: 'Alerts', icon: 'notifications' },
    { href: ROUTES.CONSOLE.ECOSYSTEM.HOME, label: 'Ecosystem', icon: 'hub' },
  ];

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622] text-slate-900 dark:text-slate-100 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-[#2e3545] bg-white dark:bg-[#111318] hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-200 dark:border-[#2e3545] flex items-center gap-3">
          <div className="size-8 rounded bg-[#135bec] flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-xl">grid_view</span>
          </div>
          <span className="font-bold text-lg tracking-tight">ControlPlane</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-[#135bec]/10 text-[#135bec] font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a1f2e] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#2e3545]">
          <Link
            href={ROUTES.CONSOLE.PROFILE}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1f2e] transition-colors"
          >
            <div className="size-8 rounded-full bg-linear-to-br from-[#135bec] to-purple-600 flex items-center justify-center text-white text-xs font-bold">JD</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate leading-none">John Doe</p>
              <p className="text-[10px] text-slate-500 mt-1">reach-alpha-org</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 dark:border-[#2e3545] bg-white/80 dark:bg-[#111318]/80 backdrop-blur-md px-6 py-3">
          <div className="flex items-center gap-4">
             <div className="lg:hidden size-8 rounded bg-[#135bec] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-xl">grid_view</span>
              </div>
              <div className="relative group flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">search</span>
                <input 
                  type="text" 
                  placeholder="Search console..." 
                  className="bg-slate-100 dark:bg-[#1a1f2e] border-none rounded-lg pl-10 pr-4 py-1.5 text-sm w-64 focus:ring-1 focus:ring-[#135bec] transition-all"
                />
              </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors relative">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-[#111318]"></span>
            </button>
            <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[22px]">help</span>
            </button>
            <div className="h-6 w-px bg-slate-200 dark:border-[#2e3545]"></div>
            <button className="bg-[#135bec] text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-[#135bec]/90 transition-colors">
              Support
            </button>
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
