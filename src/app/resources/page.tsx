import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function ResourcesPage() {
  return (
    <div className="editorial-page relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
      <div className="mx-auto w-full max-w-[min(90rem,calc(100vw-2rem))] px-4 sm:px-6 lg:px-8">
        <ComingSoonPage
          title="Resources"
          description="Guides, methodology deep dives, and data refresh notes will live here. For now, trade scoring methodology is documented on the trade calculator page."
          relatedHref={{ href: "/trade#methodology", label: "trade methodology" }}
        />
      </div>
    </div>
  );
}
