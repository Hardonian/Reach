import { RunnerOrchestration } from "@/components/stitch/console/pages/RunnerOrchestration";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Runner Orchestration | ReadyLayer Console",
};

export default function RunnersPage() {
  return (
    <ConsoleLayout>
      <RunnerOrchestration />
    </ConsoleLayout>
  );
}
