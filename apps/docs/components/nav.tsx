import Link from "next/link";

const navItems = [
  { href: "/docs/install", label: "Installation" },
  { href: "/docs/quickstart", label: "Quickstart" },
  { href: "/docs/cli", label: "CLI Reference" },
  { href: "/docs/config", label: "Configuration" },
  { href: "/docs/examples", label: "Examples" },
  { href: "/docs/presets", label: "Presets" },
  { href: "/docs/plugins", label: "Plugins" },
  { href: "/docs/troubleshooting", label: "Troubleshooting" },
  { href: "/docs/stability", label: "Stability" },
  { href: "/docs/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

interface NavProps {
  currentPath?: string;
}

export function Nav({ currentPath }: NavProps) {
  return (
    <nav className="w-64 bg-white border-r min-h-screen p-6">
      <Link href="/" className="text-xl font-bold text-slate-900 block mb-8">
        Reach
      </Link>
      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-4 py-2 rounded-lg transition ${
                currentPath === item.href
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
