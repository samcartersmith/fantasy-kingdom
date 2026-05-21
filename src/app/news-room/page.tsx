import { ComingSoonPage } from "@/components/ComingSoonPage";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function NewsRoomPage() {
  return (
    <EditorialPageShell surface="editorial" className="py-8 sm:py-12 lg:py-16">
      <ComingSoonPage
        title="News room"
        description="Curated dynasty headlines and roster-relevant updates so you know what might move values."
        relatedHref={{ href: "/tools", label: "all tools" }}
      />
    </EditorialPageShell>
  );
}
