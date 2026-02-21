import { BillingChargeback } from '@/components/stitch/console/pages/BillingChargeback';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Billing & Chargeback | ReadyLayer Console',
};

export default function BillingPage() {
  return (
    <ConsoleLayout>
      <BillingChargeback />
    </ConsoleLayout>
  );
}
