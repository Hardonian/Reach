import { MasterNavigation } from '@/components/stitch/console/pages/MasterNavigation';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Master Navigation | Reach Console',
};

export default function NavPage() {
  return (
    <ConsoleLayout>
      <MasterNavigation />
    </ConsoleLayout>
  );
}
