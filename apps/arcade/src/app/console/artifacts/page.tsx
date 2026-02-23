import { ArtifactRegistry } from "@/components/stitch/console/pages/ArtifactRegistry";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Artifact Registry | ReadyLayer Console",
};

export default function ArtifactsPage() {
  return (
    <ConsoleLayout>
      <ArtifactRegistry />
    </ConsoleLayout>
  );
}
