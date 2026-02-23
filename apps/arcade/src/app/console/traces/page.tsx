import { TraceExplorer } from "@/components/stitch/console/pages/TraceExplorer";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Trace Explorer | ReadyLayer Console",
};

export default function TracesPage() {
  return (
    <ConsoleLayout>
      <TraceExplorer />
    </ConsoleLayout>
  );
}
