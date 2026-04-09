"use client";

import Link from "next/link";
import { useState } from "react";

type SplitLink = {
  href: string;
  label: string;
};

export default function MobileNav({
  splitOneLinks,
}: {
  splitOneLinks: SplitLink[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  return (
    <div className="relative z-[110]">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => {
          setMenuOpen((prev) => !prev);
          if (menuOpen) setSplitOpen(false);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          {menuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
          )}
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-14 z-[120] w-[min(90vw,320px)] rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-[0_0_30px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="flex flex-col gap-1 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
            <Link
              href="/"
              onClick={() => {
                setMenuOpen(false);
                setSplitOpen(false);
              }}
              className="rounded-xl px-4 py-3 transition hover:bg-white/5 hover:text-green-400"
            >
              Home
            </Link>

            <Link
              href="/teams"
              onClick={() => {
                setMenuOpen(false);
                setSplitOpen(false);
              }}
              className="rounded-xl px-4 py-3 transition hover:bg-white/5 hover:text-green-400"
            >
              Teams
            </Link>

            <Link
              href="/free-agents"
              onClick={() => {
                setMenuOpen(false);
                setSplitOpen(false);
              }}
              className="rounded-xl px-4 py-3 transition hover:bg-white/5 hover:text-green-400"
            >
              Free Agency
            </Link>

            <button
              type="button"
              onClick={() => setSplitOpen((prev) => !prev)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-white/5 hover:text-green-400"
            >
              <span>Split One</span>
              <span className="text-xs">{splitOpen ? "▲" : "▼"}</span>
            </button>

            {splitOpen && (
              <div className="mt-1 flex flex-col gap-1 pl-2">
                {splitOneLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => {
                      setSplitOpen(false);
                      setMenuOpen(false);
                    }}
                    className="rounded-xl px-4 py-3 text-xs uppercase tracking-[0.12em] text-zinc-400 transition hover:bg-white/5 hover:text-green-400"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <a
              href="https://www.youtube.com/@ECL-LoL"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white/5 hover:text-green-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8ZM9.75 15.5v-7L16 12l-6.25 3.5Z" />
              </svg>
              <span>YouTube</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}