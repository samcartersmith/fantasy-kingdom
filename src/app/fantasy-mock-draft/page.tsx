import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function FantasyMockDraftPage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="Fantasy mock draft"
        description="Practice dynasty startup and rookie drafts with configurable league settings, pick clocks, and values aligned to the trade calculator. Built for fast reps before your real draft room opens."
        relatedHref={{ href: "/draft-experts", label: "draft experts" }}
      />
    </EditorialPageShell>
  );
}
