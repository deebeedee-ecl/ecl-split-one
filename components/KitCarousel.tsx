"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const teams = [
  { tag: "Make France Great Again", kit: "/kit/mfg.png" },
  { tag: "NiuNiu", kit: "/kit/niu.png" },
  { tag: "Flanmingos", kit: "/kit/fla.png" },
  { tag: "Bean In Your Mum", kit: "/kit/biy.png" },
  { tag: "Exiled Bunzz", kit: "/kit/eb.png" },
  { tag: "Zycope & Friends", kit: "/kit/zaf.png" },
];

export default function KitCarousel() {
  const [index, setIndex] = useState(0);

  const next = () => {
    setIndex((prev) => (prev + 1) % teams.length);
  };

  const prev = () => {
    setIndex((prev) => (prev - 1 + teams.length) % teams.length);
  };

  const team = teams[index];

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(74,222,128,0.08),transparent_70%)] blur-2xl" />

      <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-8 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
        
        {/* 🖼 FRAME */}
        <div className="mx-auto w-fit rounded-[1.5rem] border border-white/10 p-[2px] bg-gradient-to-b from-white/10 to-transparent">
          <div className="rounded-[1.4rem] bg-black p-6">
            <Image
              src={team.kit}
              alt={`${team.tag} kit`}
              width={260}
              height={260}
              className="h-auto w-[220px] object-contain transition duration-500"
            />
          </div>
        </div>

        {/* TAG */}
        <p className="mt-6 text-center text-2xl font-black uppercase tracking-[0.2em] text-white">
          {team.tag}
        </p>

        {/* VIEW TEAMS */}
        <div className="mt-4 flex justify-center">
          <Link
            href="/teams"
            className="rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
          >
            View Teams
          </Link>
        </div>

        {/* 🔥 PREMIUM CONTROLS */}
        <div className="mt-8 flex items-center justify-center gap-6">
          
          {/* LEFT */}
          <button
            onClick={prev}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md transition duration-300 hover:scale-110 hover:border-green-400/40 hover:bg-white/10"
          >
            {/* glow */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(74,222,128,0.2),transparent_70%)] opacity-0 blur-md transition group-hover:opacity-100" />
            
            <span className="relative text-lg font-bold text-zinc-300 transition group-hover:text-white">
              ←
            </span>
          </button>

          {/* RIGHT */}
          <button
            onClick={next}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md transition duration-300 hover:scale-110 hover:border-green-400/40 hover:bg-white/10"
          >
            {/* glow */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(74,222,128,0.2),transparent_70%)] opacity-0 blur-md transition group-hover:opacity-100" />
            
            <span className="relative text-lg font-bold text-zinc-300 transition group-hover:text-white">
              →
            </span>
          </button>

        </div>
      </div>
    </div>
  );
}