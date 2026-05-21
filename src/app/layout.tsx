import type { Metadata } from "next";
import { IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fantasy Kingdom — Dynasty tools",
  description: "Dynasty fantasy football tools. Trade calculator today; rankings and leagues next.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh flex flex-col antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="dash-scrollbar flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 outline-none"
        >
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
