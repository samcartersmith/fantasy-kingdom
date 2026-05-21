import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function DraftExpertsPage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="Draft experts"
        description="Analyst-style draft takes, class tiers, and pick-by-pick notes for your dynasty draft room."
        relatedHref={{ href: "/tools", label: "all tools" }}
      />
    </EditorialPageShell>
  );
}
