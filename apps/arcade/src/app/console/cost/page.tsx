import { CostOptimization } from '@/components/stitch/console/pages/CostOptimization';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Cost & Optimization | ReadyLayer Console',
};

export default function CostPage() {
  return (
    <ConsoleLayout>
      <CostOptimization />
    </ConsoleLayout>
  );
}
