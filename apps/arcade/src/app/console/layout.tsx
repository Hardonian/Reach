import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/cloud-auth';
import { ROUTES } from '@/lib/routes';

export default async function ConsoleRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuth();

  if (!auth) {
    // Redirect to login if not authenticated
    // Adding callback URL for better UX
    const callbackUrl = encodeURIComponent('/console');
    redirect(`${ROUTES.LOGIN}?callbackUrl=${callbackUrl}`);
  }

  // RBAC check: Only 'admin' or 'owner' can access console by default
  // Some routes might be more permissive, but the core console is for privileged users.
  if (auth.role !== 'admin' && auth.role !== 'owner') {
     // If user is a 'member' or 'viewer', they might have limited access 
     // but for now let's enforce admin/owner for the main console shell
     // redirect(ROUTES.HOME); 
     // For now, let's allow members if they have a tenant context
  }

  return <>{children}</>;
}
