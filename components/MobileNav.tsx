"use client";

import Link from "next/link";
import { useState } from "react";

type NavLink = {
  href: string;
  label: string;
};

export default function MobileNav({
  competitiveLinks,
}: {
  competitiveLinks: NavLink[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [competitiveOpen, setCompetitiveOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
    setCompetitiveOpen(false);
  }

  return (
    <div className="relative z-[110]">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => {
          setMenuOpen((prev) => !prev);
          if (menuOpen) setCompetitiveOpen(false);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#1f1f1f] bg-[#0d0d0d] text-stone-100 transition hover:border-[#b11226]"
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
              d="M6 18 18 6M6 6l12 12"
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
        <div className="absolute right-0 top-14 z-[120] w-[min(90vw,320px)] rounded-lg border border-[#1f1f1f] bg-[#050505]/95 p-3 shadow-xl shadow-black/45 backdrop-blur-md">
          <div className="flex flex-col gap-1 text-sm font-semibold tracking-normal text-stone-300">
            <Link
              href="/"
              onClick={closeMenu}
              className="rounded-md px-4 py-3 transition hover:bg-white/10 hover:text-white"
            >
              Home
            </Link>

            <Link
              href="/hub"
              onClick={closeMenu}
              className="rounded-md px-4 py-3 transition hover:bg-white/10 hover:text-white"
            >
              Hub
            </Link>

            <Link
              href="/news"
              onClick={closeMenu}
              className="rounded-md px-4 py-3 transition hover:bg-white/10 hover:text-white"
            >
              News
            </Link>

            <Link
              href="/how-to-play"
              onClick={closeMenu}
              className="rounded-md px-4 py-3 transition hover:bg-white/10 hover:text-white"
            >
              How to Play
            </Link>

            <button
              type="button"
              onClick={() => setCompetitiveOpen((prev) => !prev)}
              className="flex items-center justify-between rounded-md px-4 py-3 text-left transition hover:bg-white/10 hover:text-white"
            >
              <span>Tournaments</span>
              <span className="text-xs">{competitiveOpen ? "Up" : "Down"}</span>
            </button>

            {competitiveOpen && (
              <div className="mt-1 flex flex-col gap-1 pl-2">
                {competitiveLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="rounded-md px-4 py-3 text-sm tracking-normal text-stone-400 transition hover:bg-white/10 hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            <Link
              href="/login"
              onClick={closeMenu}
              className="mt-2 rounded-md border border-[#1f1f1f] px-4 py-3 text-center font-black text-white transition hover:border-[#b11226] hover:bg-[#b11226]/10"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              onClick={closeMenu}
              className="rounded-md bg-[#b11226] px-4 py-3 text-center font-black text-white transition hover:bg-[#d11a2a]"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
