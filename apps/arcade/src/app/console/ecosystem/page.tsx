import { EcosystemCoordination } from '@/components/stitch/console/pages/EcosystemCoordination';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Ecosystem Coordination | Reach Console',
};

export default function EcosystemPage() {
  return (
    <ConsoleLayout>
      <EcosystemCoordination />
    </ConsoleLayout>
  );
}
