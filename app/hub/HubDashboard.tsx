"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Globe2,
  ShieldCheck,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { HubShell } from "./_components/HubShell";
import { WorldCupNav } from "./world-cup/WorldCupNav";

const tournamentRules = [
  {
    icon: Users,
    title: "Find a roster",
    detail: "Countrymen/women. 2 imports allowed.",
  },
  {
    icon: Globe2,
    title: "No Elo requirement",
    detail: "Just national pride.",
  },
  {
    icon: Trophy,
    title: "You have a world to win",
    detail: "Double elimination. One champion.",
  },
];

const timeline = [
  "Teams submitted by Sep 13th",
  "World Cup begins Sep 18th",
  "Double elimination bracket",
];

export default function HubDashboard() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.28;
    audio.muted = muted;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          setAudioReady(true);
          setAudioBlocked(false);
        })
        .catch(() => {
          setAudioReady(false);
          setAudioBlocked(true);
        });
    }
  }, [muted]);

  function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioReady && !muted) {
      audio.muted = false;
      audio
        .play()
        .then(() => {
          setAudioReady(true);
          setAudioBlocked(false);
        })
        .catch(() => {
          setAudioReady(false);
          setAudioBlocked(true);
        });
      return;
    }

    const nextMuted = !muted;
    audio.muted = nextMuted;
    setMuted(nextMuted);

    if (!nextMuted) {
      audio
        .play()
        .then(() => {
          setAudioReady(true);
          setAudioBlocked(false);
        })
        .catch(() => {
          setAudioReady(false);
          setAudioBlocked(true);
        });
    }
  }

  return (
    <HubShell
      active="dashboard"
      eyebrow="World Cup"
      title="ECL World Cup"
      description="Double elimination knockout tournament to decide the ECL world champions."
      hideHeader
      theme="blue"
    >
      <audio
        ref={audioRef}
        src="/worlds-2022-champ-select-bitten-bullet.mp3"
        autoPlay
        loop
        preload="auto"
      />
      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="relative min-h-[28rem] overflow-hidden border border-[#0797F2]/35 bg-[#020817] shadow-[0_24px_90px_rgba(0,0,0,0.5),0_0_54px_rgba(54,215,255,0.16)] lg:min-h-[31rem]">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/ecl-earth.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,23,0.96)_0%,rgba(6,28,74,0.82)_34%,rgba(7,85,201,0.34)_68%,rgba(2,8,23,0.72)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,rgba(2,8,23,0.98),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(45,107,255,0.24),transparent_34%)]" />

          <div className="relative flex min-h-[28rem] flex-col justify-between p-5 sm:p-7 lg:min-h-[31rem] lg:p-10">
            <button
              type="button"
              onClick={toggleAudio}
              className="absolute right-5 top-5 z-10 inline-flex h-12 w-12 items-center justify-center border border-[#36D7FF]/35 bg-[#061C4A]/70 text-white shadow-[0_0_24px_rgba(54,215,255,0.22)] backdrop-blur-sm transition hover:border-white/45 hover:bg-[#0755C9]/70"
              aria-label={muted || audioBlocked ? "Play World Cup music" : "Mute World Cup music"}
              title={muted || audioBlocked ? "Play World Cup music" : "Mute World Cup music"}
            >
              {muted || audioBlocked ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <div className="max-w-2xl">
              <Image
                src="/ecl-logo.png"
                alt="ECL"
                width={184}
                height={128}
                className="h-20 w-auto object-contain md:h-24"
                priority
              />
              <h2 className="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.98] tracking-normal text-white sm:text-5xl lg:text-6xl 2xl:text-7xl">
                World Cup
              </h2>
              <p className="mt-5 max-w-xl text-xl font-black uppercase leading-8 text-[#F5F5F2]">
                A world to win.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="border border-[#36D7FF]/30 bg-[#0755C9]/18 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#C9DFEB]">
                  Begins Sep 18th
                </span>
                <span className="border border-[#36D7FF]/30 bg-[#0755C9]/18 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#C9DFEB]">
                  Teams submitted by Sep 13th
                </span>
              </div>
              <p className="mt-4 max-w-lg text-sm font-semibold leading-6 text-[#c5c9d6]">
                Build a national roster, enter the double elimination bracket,
                and fight through the lower bracket if the first run goes wrong.
              </p>
            </div>

            <div aria-hidden="true" />
          </div>
        </div>

        <aside className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_44px_rgba(54,215,255,0.12)] lg:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#36D7FF]">
            Tournament Brief
          </p>
          <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-normal text-white">
            National rosters.
          </h2>
          <p className="mt-5 text-sm font-semibold leading-6 text-[#C9DFEB]">
            The World Cup is built around country identity first. Teams can be
            created now, players can apply for a roster, and approved squads
            will become visible once admins lock them in.
          </p>

          <div className="mt-7 space-y-3">
            {timeline.map((item, index) => (
              <div
                key={item}
                className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 border border-[#36D7FF]/18 bg-[#020817]/42 px-4 py-3"
              >
                <span className="text-sm font-black text-[#77CFFF]">
                  {index + 1}
                </span>
                <p className="text-sm font-bold leading-5 text-[#f2f2f2]">
                  {item}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 border border-[#36D7FF]/35 bg-[#0755C9]/14 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#77CFFF]" />
              <p className="text-xs font-bold leading-5 text-[#C9DFEB]">
                Players must be registered and verified in the Hub before their
                profiles and champion data can power tournament scouting.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <WorldCupNav active="dashboard" />

      <section className="mt-5 grid gap-0 overflow-hidden border border-[#0797F2]/30 bg-[#061C4A] md:grid-cols-3">
        {tournamentRules.map((rule, index) => {
          const Icon = rule.icon;

          return (
            <div
              key={rule.title}
              className="relative min-h-[8rem] px-6 py-6 text-center md:border-r md:border-[#36D7FF]/22 md:last:border-r-0"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#C9DFEB]/45 bg-[#0755C9]/18 text-white shadow-[0_0_28px_rgba(54,215,255,0.18)]">
                <Icon size={24} />
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-white">
                {index + 1}. {rule.title}
              </p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#aeb5da]">
                {rule.detail.split(". ")[0]}
                {rule.detail.includes(". ") && (
                  <>
                    .{" "}
                    <span className="text-[#77CFFF]">
                      {rule.detail.split(". ").slice(1).join(". ")}
                    </span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </section>
    </HubShell>
  );
}
