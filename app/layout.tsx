import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import MobileNav from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "ECL Spring Split",
  description: "ECL tournament portal",
};

const splitOneLinks = [
  { href: "/schedule", label: "Schedule" },
  { href: "/format", label: "Format" },
  { href: "/results", label: "Results" },
  { href: "/player-stats", label: "Player Stats" },
  { href: "/standings", label: "Standings" },
  { href: "/rules", label: "Rules" },
  { href: "/contact", label: "Contact" },
];

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden bg-black text-white">
        <header className="relative z-[100] border-b border-white/10 bg-black/90 backdrop-blur-sm">
          <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="group flex min-w-0 items-center gap-3 sm:gap-4"
            >
              <Image
                src="/ecl-logo.png"
                alt="ECL Logo"
                width={95}
                height={95}
                className="h-12 w-12 shrink-0 drop-shadow-[0_0_12px_rgba(74,222,128,0.18)] transition duration-300 group-hover:scale-105 sm:h-[72px] sm:w-[72px]"
                priority
              />

              <div className="min-w-0 leading-none">
                <p className="truncate text-[0.5rem] font-semibold uppercase tracking-[0.28em] text-green-400/90 sm:text-[0.65rem] sm:tracking-[0.45em]">
                  Expat China League
                </p>
                <span className="block truncate bg-gradient-to-r from-white via-zinc-200 to-green-400 bg-clip-text text-lg font-black uppercase tracking-[0.14em] text-transparent drop-shadow-[0_0_12px_rgba(74,222,128,0.12)] transition duration-300 group-hover:from-green-300 group-hover:via-white group-hover:to-green-500 sm:text-2xl sm:tracking-[0.28em]">
                  Spring Split
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300 md:flex">
              <Link
                href="/"
                className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
              >
                Home
              </Link>

              <Link
                href="/teams"
                className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
              >
                Teams
              </Link>

              <Link
                href="/free-agents"
                className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
              >
                Free Agency
              </Link>

              <div className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
                >
                  Split One
                  <span className="text-[0.65rem]">▼</span>
                </button>

                <div className="invisible absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 opacity-0 shadow-[0_0_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  {splitOneLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <a
                href="https://www.youtube.com/@ECL-LoL"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ECL YouTube Channel"
                className="rounded-md p-2 text-zinc-300 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-6 w-6"
                >
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8ZM9.75 15.5v-7L16 12l-6.25 3.5Z" />
                </svg>
              </a>
            </nav>

            <div className="md:hidden">
              <MobileNav splitOneLinks={splitOneLinks} />
            </div>
          </div>
        </header>

        <main className="overflow-x-hidden">{children}</main>
      </body>
    </html>
  );
}