import { getHealthData } from "@/lib/viewmodels/health";
import { getAgentData } from "@/lib/viewmodels/agents";
import { MissionControlOverview } from "@/components/stitch/console/pages/MissionControlOverview";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "ControlPlane Mission Control Overview | ReadyLayer",
};

export default async function ConsolePage() {
  const healthRes = await getHealthData();
  const agentsRes = await getAgentData();

  return (
    <ConsoleLayout>
      <MissionControlOverview health={healthRes.data} agents={agentsRes.data} />
    </ConsoleLayout>
  );
}
