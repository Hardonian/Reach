import { AdversarialSafetyMonitor } from "@/components/stitch/console/pages/AdversarialSafetyMonitor";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Adversarial Safety Monitor | ReadyLayer Console",
};

export default function SafetyPage() {
  return (
    <ConsoleLayout>
      <AdversarialSafetyMonitor />
    </ConsoleLayout>
  );
}
