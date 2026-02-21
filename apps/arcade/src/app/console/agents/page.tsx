import { AgentRegistry } from '@/components/stitch/console/pages/AgentRegistry';
import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';

export const metadata = {
  title: 'Agent Registry | Reach Console',
};

export default function AgentsPage() {
  return (
    <ConsoleLayout>
      <AgentRegistry />
    </ConsoleLayout>
  );
}
