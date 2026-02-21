import { AlertsCenter } from '@/components/stitch/console/pages/AlertsCenter';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Alerts | ReadyLayer Console',
};

export default function AlertsPage() {
  return (
    <ConsoleLayout>
      <AlertsCenter />
    </ConsoleLayout>
  );
}
