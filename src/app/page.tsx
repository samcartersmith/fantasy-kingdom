import { HomeEditorialHero } from "@/components/home/HomeEditorialHero";

export default function HomePage() {
  return (
    <div className="home-page relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
      <div className="mx-auto w-full max-w-[min(90rem,calc(100vw-2rem))] px-4 sm:px-6 lg:px-8">
        <HomeEditorialHero />
      </div>
    </div>
  );
}
