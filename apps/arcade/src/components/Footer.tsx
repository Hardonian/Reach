import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { BRAND_NAME } from '@/lib/brand';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="section-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center logo-gradient">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="font-bold text-xl text-gradient">{BRAND_NAME}</span>
            </div>
            <p className="text-gray-400 text-sm max-w-sm">
              Ship reliable AI agents. Run a readiness check in minutes.
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Free to start · No credit card · OSS-friendly
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href={ROUTES.PLAYGROUND} className="hover:text-white transition-colors">Playground</Link></li>
              <li><Link href={ROUTES.STUDIO} className="hover:text-white transition-colors">Studio</Link></li>
              <li><Link href={ROUTES.TEMPLATES} className="hover:text-white transition-colors">Templates</Link></li>
              <li><Link href={ROUTES.DOCS} className="hover:text-white transition-colors">Docs</Link></li>
              <li><Link href={ROUTES.PRICING} className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href={ROUTES.MARKETPLACE} className="hover:text-white transition-colors">Marketplace</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href={ROUTES.SUPPORT} className="hover:text-white transition-colors">Support</Link></li>
              <li><Link href="/support/status" className="hover:text-white transition-colors">Status</Link></li>
              <li><Link href={ROUTES.CHANGELOG} className="hover:text-white transition-colors">Changelog</Link></li>
              <li><Link href={ROUTES.SECURITY} className="hover:text-white transition-colors">Security</Link></li>
              <li><Link href={ROUTES.FAQ} className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href={ROUTES.CONTACT} className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p suppressHydrationWarning>&copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href={ROUTES.LEGAL.PRIVACY} className="hover:text-white transition-colors">Privacy</Link>
            <Link href={ROUTES.LEGAL.TERMS} className="hover:text-white transition-colors">Terms</Link>
            <Link href={ROUTES.LEGAL.COOKIES} className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
