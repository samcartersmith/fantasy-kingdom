import { EditorialPageShell } from "@/components/layout/EditorialPageShell";

export default function RankingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <EditorialPageShell surface="editorial">{children}</EditorialPageShell>;
}
