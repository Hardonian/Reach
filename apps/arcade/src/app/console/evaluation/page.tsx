import { EvaluationEngine } from "@/components/stitch/console/pages/EvaluationEngine";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Evaluation Engine | ReadyLayer Console",
};

export default function EvaluationPage() {
  return (
    <ConsoleLayout>
      <EvaluationEngine />
    </ConsoleLayout>
  );
}
