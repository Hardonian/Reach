import { IntegrationsHub } from '@/components/stitch/console/pages/IntegrationsHub';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Integrations | Reach Console',
};

export default function IntegrationsPage() {
  return (
    <ConsoleLayout>
      <IntegrationsHub />
    </ConsoleLayout>
  );
}
