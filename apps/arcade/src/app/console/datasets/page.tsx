import { DatasetManagement } from "@/components/stitch/console/pages/DatasetManagement";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";

export const metadata = {
  title: "Dataset & RAG Management | ReadyLayer Console",
};

export default function DatasetsPage() {
  return (
    <ConsoleLayout>
      <DatasetManagement />
    </ConsoleLayout>
  );
}
