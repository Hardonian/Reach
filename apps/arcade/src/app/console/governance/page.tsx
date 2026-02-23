import { GovernanceCompliance } from "@/components/stitch/console/pages/GovernanceCompliance";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Governance & Compliance | ReadyLayer Console",
};

export default function GovernancePage() {
  return (
    <ConsoleLayout>
      <GovernanceCompliance />
    </ConsoleLayout>
  );
}
