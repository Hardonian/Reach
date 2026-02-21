import { GovernanceCompliance } from '@/components/stitch/console/pages/GovernanceCompliance';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Governance & Compliance | Reach Console',
};

export default function GovernancePage() {
  return (
    <ConsoleLayout>
      <GovernanceCompliance />
    </ConsoleLayout>
  );
}
