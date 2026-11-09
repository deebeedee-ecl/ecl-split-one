import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ECL | Expat China League Ranked Inhouses",
  description:
    "ECL China is a ranked inhouse community platform for League of Legends players in China, with player profiles, ELO, champion stats, match history, and tournament archives.",
  verification: {
    google: "nkyMLTgWGpE-gL8zv51ouuhkLdqQCdh56cm7HnoFlXU",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;800&family=Teko:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="overflow-x-hidden bg-[#050505] text-white"
      >
        {children}
      </body>
    </html>
  );
}
