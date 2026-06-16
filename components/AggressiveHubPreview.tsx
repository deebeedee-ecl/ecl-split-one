"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, BarChart3, Swords, Trophy, User } from "lucide-react";

const previewCards = [
  {
    label: "Player Profile",
    title: "deebeedee",
    stat: "1,612 ELO",
    detail: "18-11 record / Mid-Support",
    icon: User,
    position: "lg:left-0 lg:top-8",
  },
  {
    label: "Match History",
    title: "IH-0241",
    stat: "Win / 31:42",
    detail: "Captain report and player stats",
    icon: Swords,
    position: "lg:right-0 lg:top-0",
  },
  {
    label: "Champion Stats",
    title: "Champion Pool",
    stat: "Ahri / Rell / Kai'Sa",
    detail: "Picks, win rate, MVP games",
    icon: Trophy,
    position: "lg:left-8 lg:bottom-0",
  },
  {
    label: "Leaderboard",
    title: "Inhouse Ladder",
    stat: "#12 deebeedee",
    detail: "Recent form: W W L W W",
    icon: BarChart3,
    position: "lg:right-10 lg:bottom-8",
  },
];

const statChips = ["ELO", "Profile", "Matches", "Champions", "Search"];

export default function AggressiveHubPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative isolate overflow-hidden rounded-lg border border-stone-800 bg-stone-950 p-5 text-white shadow-2xl shadow-stone-950/25">
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
      <motion.div
        aria-hidden
        className="absolute left-[-20%] top-[-35%] h-72 w-72 rounded-full border border-white/20"
        animate={
          reduceMotion
            ? undefined
            : { rotate: 360, scale: [1, 1.08, 1], opacity: [0.45, 0.8, 0.45] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-[-18%] right-[-14%] h-56 w-56 rounded-full border border-white/15"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
            Hub Preview
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-normal">
            Command Centre
          </h2>
        </div>
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-md border border-white/15 bg-white/10"
          animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Activity size={24} />
        </motion.div>
      </div>

      <div className="relative z-10 mt-6 min-h-[31rem] lg:min-h-[28rem]">
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-[46%] hidden h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-red-300/10 bg-[radial-gradient(circle_at_center,rgba(127,29,29,0.62),rgba(69,10,10,0.28)_48%,rgba(0,0,0,0)_72%)] shadow-[0_0_80px_rgba(127,29,29,0.28)] lg:block"
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.42, 0.72, 0.42],
                  rotate: [0, 4, -4, 0],
                  scale: [0.96, 1.04, 0.96],
                }
          }
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="grid gap-3 lg:block">
          {previewCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.label}
                className={`rounded-lg border border-white/15 bg-white/10 p-4 shadow-xl shadow-black/20 backdrop-blur lg:absolute lg:w-56 ${card.position}`}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.12, duration: 0.5 }}
                whileHover={{
                  y: -6,
                  borderColor: "rgba(255,255,255,0.4)",
                  backgroundColor: "rgba(255,255,255,0.16)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-stone-400">
                      {card.label}
                    </p>
                    <h3 className="mt-2 text-lg font-black">{card.title}</h3>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-stone-950">
                    <Icon size={18} />
                  </div>
                </div>
                <p className="mt-4 rounded-md bg-white px-3 py-2 text-sm font-black text-stone-950">
                  {card.stat}
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  {card.detail}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {statChips.map((chip, index) => (
          <motion.span
            key={chip}
            className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-stone-300"
            animate={
              reduceMotion
                ? undefined
                : { opacity: index % 2 === 0 ? [0.55, 1, 0.55] : [1, 0.55, 1] }
            }
            transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.1 }}
          >
            {chip}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
