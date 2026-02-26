"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/cloud", label: "Overview", icon: "⊞" },
  { href: "/cloud/projects", label: "Projects", icon: "📁" },
  { href: "/cloud/workflows", label: "Workflows", icon: "⚡" },
  { href: "/cloud/runs", label: "Runs", icon: "▶" },
  { href: "/cloud/audit", label: "Audit Log", icon: "📋" },
];

export default function CloudLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-56" : "w-14"} transition-all duration-200 border-r border-border flex flex-col shrink-0`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          {sidebarOpen && (
            <span className="text-sm font-semibold text-accent">ReadyLayer Cloud</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white p-1 rounded"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? "←" : "→"}
          </button>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/cloud" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/10 text-accent border-r-2 border-accent"
                    : "text-gray-400 hover:text-white hover:bg-surface/50"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          {sidebarOpen && (
            <button
              onClick={async () => {
                await fetch("/api/v1/auth/logout", { method: "POST" });
                window.location.href = "/cloud/login";
              }}
              className="text-xs text-gray-500 hover:text-red-400"
            >
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
