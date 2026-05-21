import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function LeagueDataWizardPage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="League data wizard"
        description="A guided flow to import league settings, roster slots, and scoring context for sharper valuations."
        relatedHref={{ href: "/tools", label: "all tools" }}
      />
    </EditorialPageShell>
  );
}
