import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "ECL | Expat China League Ranked Inhouses",
  description:
    "ECL China is a ranked inhouse community platform for League of Legends players in China, with player profiles, ELO, champion stats, match history, and tournament archives.",
  verification: {
    google: "nkyMLTgWGpE-gL8zv51ouuhkLdqQCdh56cm7HnoFlXU",
  },
};

const competitiveLinks = [
  { href: "/tournaments", label: "Past Tournaments" },
];

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
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
        <header className="relative z-[100] border-b border-[#1f1f1f] bg-[#050505]/95 shadow-lg shadow-black/40 backdrop-blur-sm">
          <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Link
                href="/"
                className="group flex min-w-0 items-center gap-3 sm:gap-4"
              >
                <Image
                  src="/ecl-logo.png"
                  alt="ECL Logo Expat China League"
                  width={95}
                  height={95}
                  className="h-14 w-14 shrink-0 object-contain transition duration-300 group-hover:scale-105 sm:h-16 sm:w-16"
                  priority
                />

                <div className="min-w-0 leading-none">
                  <p className="truncate text-sm font-black text-white transition duration-300 group-hover:text-stone-200 sm:text-base">
                    Home
                  </p>
                </div>
              </Link>
            </div>

            <nav className="hidden items-center gap-1 text-sm font-semibold tracking-normal text-stone-300 md:flex">
              <Link
                href="/hub"
                className="rounded-md px-3 py-2 transition duration-200 hover:bg-white/10 hover:text-white"
              >
                Hub
              </Link>

              <Link
                href="/news"
                className="rounded-md px-3 py-2 transition duration-200 hover:bg-white/10 hover:text-white"
              >
                News
              </Link>

              <Link
                href="/how-to-play"
                className="rounded-md px-3 py-2 transition duration-200 hover:bg-white/10 hover:text-white"
              >
                How to Play
              </Link>

              <div className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md px-3 py-2 transition duration-200 hover:bg-white/10 hover:text-white"
                >
                  Competitive
                  <span className="text-[0.65rem]">v</span>
                </button>

                <div className="invisible absolute right-0 top-full z-50 mt-3 w-56 rounded-lg border border-white/10 bg-[#151412]/95 p-2 opacity-0 shadow-xl shadow-stone-950/35 backdrop-blur-md transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  {competitiveLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-stone-300 transition duration-200 hover:bg-white/10 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href="/login"
                className="rounded-md border border-[#1f1f1f] bg-transparent px-4 py-2 text-sm font-black tracking-normal text-white transition duration-200 hover:border-[#b11226] hover:bg-[#b11226]/10"
              >
                Log in
              </Link>

              <Link
                href="/signup"
                className="rounded-md border border-[#b11226] bg-[#b11226] px-4 py-2 text-sm font-black tracking-normal text-white transition duration-200 hover:border-[#d11a2a] hover:bg-[#d11a2a]"
              >
                Sign up
              </Link>
            </nav>

            <div className="md:hidden">
              <MobileNav competitiveLinks={competitiveLinks} />
            </div>
          </div>
        </header>

        <div className="overflow-x-hidden">{children}</div>

        <footer className="border-t border-[#1f1f1f] bg-[#050505]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm font-semibold text-stone-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>2026 Expat China League</p>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <Link
                href="/rules"
                className="transition duration-200 hover:text-white"
              >
                Terms & Conditions
              </Link>
              <Link
                href="/admin"
                prefetch={false}
                className="transition duration-200 hover:text-white"
              >
                Admin Login
              </Link>
              <Link
                href="/contact"
                className="transition duration-200 hover:text-white"
              >
                Contact Us
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
