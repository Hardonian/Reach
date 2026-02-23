"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";

const sidebarItems = [
  {
    section: "Account",
    items: [
      { href: ROUTES.SETTINGS.PROFILE, label: "Profile", icon: "person" },
      { href: ROUTES.SETTINGS.API_KEYS, label: "API Keys", icon: "vpn_key" },
      {
        href: ROUTES.SETTINGS.ADVANCED.SECURITY,
        label: "Security",
        icon: "shield",
      },
      { href: ROUTES.SETTINGS.BILLING, label: "Billing", icon: "credit_card" },
    ],
  },
  {
    section: "Advanced",
    items: [
      {
        href: ROUTES.SETTINGS.ADVANCED.WEBHOOKS,
        label: "Webhooks",
        icon: "webhook",
      },
      {
        href: ROUTES.SETTINGS.ADVANCED.RELEASE_GATES,
        label: "Release Gates",
        icon: "verified",
      },
      {
        href: ROUTES.SETTINGS.ADVANCED.ALERTS,
        label: "Alerts",
        icon: "notifications_active",
      },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface/50 py-6 px-3">
        {sidebarItems.map((group) => (
          <div key={group.section} className="mb-6">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {group.section}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent/20 text-accent"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
