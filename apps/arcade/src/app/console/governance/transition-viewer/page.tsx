import { ConsoleLayout } from '@/components/stitch/console/ConsoleLayout';
import { SemanticGovernancePanel } from '@/components/stitch/console/pages/SemanticGovernancePanels';

export default function Page() {
  return <ConsoleLayout><SemanticGovernancePanel mode='transition' /></ConsoleLayout>;
}
