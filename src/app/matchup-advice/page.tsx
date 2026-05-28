import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function MatchupAdvicePage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="Matchup advice"
        description="Start/sit and lineup help for your weekly Sleeper matchup. Compare projected output, positional leverage, and opponent weaknesses before lock."
        relatedHref={{ href: "/leagues", label: "team evaluation" }}
      />
    </EditorialPageShell>
  );
}
