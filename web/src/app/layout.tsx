import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "European Soy Sauce Price Tracker",
  description:
    "Track and compare soy sauce prices across European online shops — powered by real scrape data.",
  openGraph: {
    title: "European Soy Sauce Price Tracker",
    description: "Price trend analysis for soy sauce across European shops.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <Nav />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
