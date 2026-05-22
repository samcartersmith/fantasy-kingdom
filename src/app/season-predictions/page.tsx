import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function SeasonPredictionsPage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="Season predictions"
        description="Projected standings, playoff probability, and roster strength trends using Sleeper rosters and our value model. Tune for superflex, league size, and scoring before the season kicks off."
        relatedHref={{ href: "/rankings", label: "rankings" }}
      />
    </EditorialPageShell>
  );
}
