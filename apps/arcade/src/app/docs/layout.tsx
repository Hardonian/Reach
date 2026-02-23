import Link from "next/link";

import { sidebarItems } from "@/lib/docs/nav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="section-container flex gap-8 py-8">
      {/* Documentation Sidebar */}
      <aside className="w-64 hidden lg:block shrink-0">
        <nav className="sticky top-24 space-y-8">
          {sidebarItems.map((section) => (
            <div key={section.title}>
              <h5 className="text-white font-semibold mb-3 px-4 text-sm uppercase tracking-wider">
                {section.title}
              </h5>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 max-w-4xl">
        <article className="prose prose-invert prose-accent max-w-none">
          {children}
        </article>
      </main>
    </div>
  );
}
