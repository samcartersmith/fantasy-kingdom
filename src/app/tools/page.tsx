import { EditorialPageShell } from "@/components/layout/EditorialPageShell";
import { ToolsHub } from "@/components/tools/ToolsHub";

export default function ToolsPage() {
  return (
    <EditorialPageShell surface="editorial">
      <ToolsHub />
    </EditorialPageShell>
  );
}
