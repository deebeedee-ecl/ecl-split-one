import Link from "next/link";
import { ShieldCheck, Trophy } from "lucide-react";
import { HubShell } from "../../_components/HubShell";
import { prisma } from "@/lib/prisma";
import { countryNameLabel } from "@/lib/world-cup-countries";
import { WorldCupNav } from "../WorldCupNav";
import { WorldCupFlag } from "../WorldCupFlag";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  teamCountry?: string;
  teamCountryCode?: string;
  teamCountryFlag?: string;
  nationality?: string;
  countryCode?: string;
  countryFlag?: string;
};

function teamCountryLabel(players: TeamPlayer[]) {
  const first = players.find(
    (player) =>
      player.teamCountry ||
      player.teamCountryCode ||
      player.teamCountryFlag ||
      player.nationality ||
      player.countryCode ||
      player.countryFlag,
  );

  return countryNameLabel({
    countryName: first?.teamCountry || first?.nationality,
    countryCode: first?.teamCountryCode || first?.countryCode,
  });
}

function teamCountryCode(players: TeamPlayer[]) {
  const first = players.find(
    (player) =>
      player.teamCountryCode ||
      player.countryCode,
  );

  return first?.teamCountryCode || first?.countryCode || "";
}

export default async function WorldCupStandingsPage() {
  const teams = await prisma.teamRegistration.findMany({
    where: { status: "approved" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      teamName: true,
      players: true,
    },
  });

  return (
    <HubShell active="world-cup" eyebrow="World Cup" title="Standings" description="" theme="blue" hideHeader>
      <header className="mb-5 border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#36D7FF]">
          World Cup
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
          Standings
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C9DFEB]">
          Approved teams are staged here before the bracket begins on Sep 18th.
        </p>
      </header>
      <WorldCupNav active="standings" />

      <section className="overflow-hidden border border-[#0797F2]/30 bg-[#061C4A]/92">
        <div className="grid grid-cols-[4rem_minmax(0,1fr)_10rem_8rem_8rem] border-b border-[#36D7FF]/12 bg-[#020817]/42 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#77CFFF]">
          <span>#</span>
          <span>Team</span>
          <span>Record</span>
          <span>Map Diff</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-[#36D7FF]/10">
          {teams.map((team, index) => (
            <Link
              key={team.id}
              href={`/hub/world-cup/team/${team.id}`}
              className="grid min-h-16 grid-cols-[4rem_minmax(0,1fr)_10rem_8rem_8rem] items-center px-4 py-3 text-sm font-bold text-[#C9DFEB] transition hover:bg-[#0797F2]/10"
            >
              <span className="text-lg font-black text-white">#{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-base font-black text-white">{team.teamName}</span>
                <span className="mt-1 block truncate text-xs text-[#77CFFF]">
                  <WorldCupFlag
                    code={teamCountryCode(Array.isArray(team.players) ? (team.players as TeamPlayer[]) : [])}
                    label={teamCountryLabel(Array.isArray(team.players) ? (team.players as TeamPlayer[]) : [])}
                  />
                </span>
              </span>
              <span>0-0</span>
              <span>0</span>
              <span>Ready</span>
            </Link>
          ))}
          {teams.length === 0 && (
            <div className="p-8 text-sm font-semibold text-[#C9DFEB]">
              Approved teams will appear here once admins lock them in.
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <Info title="Format" text="Double elimination. Standings will reflect bracket progress once fixtures are live." icon={<Trophy size={18} />} />
        <Info title="Admin Locked" text="Only approved teams appear here, keeping the public board clean while signups are pending." icon={<ShieldCheck size={18} />} />
      </section>
    </HubShell>
  );
}

function Info({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) {
  return (
    <section className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-5">
      <div className="flex items-center gap-3 text-[#77CFFF]">
        {icon}
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">{title}</h2>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#C9DFEB]">{text}</p>
    </section>
  );
}
