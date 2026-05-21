import { HomeEditorialHero } from "@/components/home/HomeEditorialHero";
import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function HomePage() {
  return (
    <EditorialPageShell surface="home">
      <HomeEditorialHero />
    </EditorialPageShell>
  );
}
