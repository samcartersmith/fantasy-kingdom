import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function ContenderCurvePage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="The contender curve"
        description="Plot when your roster is likely to peak, fade, or reload so you can time trades and picks. Compare win-now windows against age, draft capital, and positional depth from your connected leagues."
        relatedHref={{ href: "/leagues", label: "team evaluation" }}
      />
    </EditorialPageShell>
  );
}
