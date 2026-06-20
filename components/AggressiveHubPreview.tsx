"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  Award,
  BarChart3,
  Gauge,
  Home,
  Search,
  Settings,
  Trophy,
  UserCircle,
} from "lucide-react";

const navIcons = [Home, Gauge, UserCircle, Trophy, Award, Search, Settings];

export default function AggressiveHubPreview() {
  return (
    <div className="relative isolate overflow-hidden border border-white/[0.08] bg-[#0b0c0f] p-3 text-white shadow-2xl shadow-black/40">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,transparent_58%,rgba(255,23,40,0.18)_58%,rgba(255,23,40,0.18)_60%,transparent_60%),radial-gradient(circle_at_82%_12%,rgba(255,23,40,0.2),transparent_34%)]" />
      <div className="relative z-10 grid min-h-[38rem] grid-cols-[4.4rem_minmax(0,1fr)] gap-3">
        <aside className="flex flex-col items-center border border-white/[0.08] bg-[#101115] py-4">
          <Image
            src="/ecl-logo.png"
            alt="ECL"
            width={70}
            height={70}
            className="h-11 w-11 object-contain"
          />

          <nav className="mt-8 flex flex-1 flex-col items-center gap-5">
            {navIcons.map((Icon, index) => (
              <span
                key={index}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  index === 2
                    ? "bg-[#ff1728] text-white shadow-[0_14px_34px_rgba(255,23,40,0.35)]"
                    : "text-[#8f96a3]"
                }`}
              >
                <Icon size={18} />
              </span>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 border border-white/[0.08] bg-[#111216]/95 p-4">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff1728]">
                Player Identity
              </p>
              <h2 className="mt-1 text-4xl font-black uppercase leading-none text-[#f2f2f2]">
                My Profile
              </h2>
              <p className="mt-2 text-xs font-semibold text-[#a9adb4]">
                Profile, ranks, champion pool, inhouse records, and account status.
              </p>
            </div>
            <span className="bg-[#ff1728] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]">
              Beta
            </span>
          </header>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="overflow-hidden border border-white/[0.08] bg-[#191a1f]">
              <div className="h-20 bg-[linear-gradient(100deg,#0f1014_0%,#26282f_42%,#581017_70%,#ff1728_100%)]" />
              <div className="-mt-7 flex items-end gap-4 px-5 pb-5">
                <div className="flex h-20 w-20 items-center justify-center border-4 border-[#191a1f] bg-[#24262d] text-2xl font-black">
                  RR
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="min-w-0 truncate text-xl font-black text-white sm:text-2xl">
                      RiftRunner
                    </h3>
                    <span className="h-3 w-5 rounded-sm bg-[#169b62]" />
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#a9adb4]">
                    Riot ID: RiftRunner#ECL / Ionia
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>Mid</Pill>
                    <Pill>Support</Pill>
                    <Pill>Solo/Duo Emerald III</Pill>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-white/[0.08] bg-[#191a1f] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a9adb4]">
                Inhouse Record
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="ELO" value="1842" />
                <Metric label="Rank" value="#12" red />
                <Metric label="W/L" value="18-11" />
                <Metric label="MVPs" value="5" />
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <Panel title="Inhouse Stats" icon={<BarChart3 size={18} />}>
              <div className="space-y-2">
                {["Top", "Jungle", "Mid", "ADC", "Support"].map((role, index) => (
                  <div key={role} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2">
                    <span className="text-[10px] font-black text-[#d7dcff]">{role}</span>
                    <span className="h-1.5 bg-white/10">
                      <span
                        className="block h-full bg-[#ff1728]"
                        style={{ width: `${[12, 18, 54, 6, 10][index]}%` }}
                      />
                    </span>
                    <span className="text-right text-[10px] font-black text-[#ff1728]">
                      {[12, 18, 54, 6, 10][index]}%
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Awards" icon={<Award size={18} />}>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                <Metric label="MVP" value="5" red />
                <Metric label="SVP" value="3" />
              </div>
            </Panel>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Panel title="Most Played Champions" icon={<Search size={18} />}>
              <div className="flex gap-2">
                {[103, 7, 134, 39, 157].map((id) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={id}
                    src={`/lol/champions/${id}.png`}
                    alt=""
                    className="h-9 w-9 bg-black object-cover"
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Recent Games" icon={<Gauge size={18} />}>
              <div className="flex gap-2">
                {["W", "L", "W", "W", "L"].map((result, index) => (
                  <span
                    key={`${result}-${index}`}
                    className={`flex h-8 w-8 items-center justify-center text-xs font-black ${
                      result === "W" ? "bg-[#ff1728]" : "bg-white/10"
                    }`}
                  >
                    {result}
                  </span>
                ))}
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-[#d7dcff]">
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  red = false,
}: {
  label: string;
  value: string;
  red?: boolean;
}) {
  return (
    <div className="bg-white/[0.05] p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#a9adb4]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-black ${red ? "text-[#ff1728]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-white/[0.08] bg-[#191a1f] p-4">
      <div className="mb-3 flex items-center gap-2 text-[#ff1728]">
        {icon}
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}
