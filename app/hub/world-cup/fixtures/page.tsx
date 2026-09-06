import Link from "next/link";
import { CalendarDays, Swords } from "lucide-react";
import { HubShell } from "../../_components/HubShell";
import { prisma } from "@/lib/prisma";
import { WorldCupNav } from "../WorldCupNav";

export const dynamic = "force-dynamic";

export default async function WorldCupFixturesPage() {
  const teams = await prisma.teamRegistration.findMany({
    where: { status: "approved" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      teamName: true,
    },
  });

  return (
    <HubShell active="world-cup" eyebrow="World Cup" title="Fixtures" description="" theme="blue" hideHeader>
      <header className="mb-5 border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#36D7FF]">
          World Cup
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
          Fixtures
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C9DFEB]">
          Matches will appear here once admins seed and publish the World Cup bracket.
        </p>
      </header>
      <WorldCupNav active="fixtures" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden border border-[#0797F2]/30 bg-[#061C4A]/92">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_10rem] border-b border-[#36D7FF]/12 bg-[#020817]/42 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#77CFFF]">
            <span>Date</span>
            <span>Match</span>
            <span>Status</span>
          </div>
          <div className="p-8 text-sm font-semibold text-[#C9DFEB]">
            Fixtures are not published yet. The bracket opens Sep 18th.
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-5">
            <div className="flex items-center gap-3 text-[#77CFFF]">
              <CalendarDays size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                Key Dates
              </h2>
            </div>
            <div className="mt-4 space-y-3 text-sm font-bold text-[#C9DFEB]">
              <p>Team submission deadline: Sep 13th</p>
              <p>World Cup begins: Sep 18th</p>
            </div>
          </section>
          <section className="border border-[#0797F2]/30 bg-[#020817]/55 p-5">
            <div className="flex items-center gap-3 text-[#77CFFF]">
              <Swords size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                Approved Teams
              </h2>
            </div>
            <div className="mt-4 space-y-2">
              {teams.slice(0, 6).map((team) => (
                <Link
                  key={team.id}
                  href={`/hub/world-cup/team/${team.id}`}
                  className="block truncate border border-[#36D7FF]/14 bg-[#061C4A]/70 px-3 py-2 text-sm font-black text-white transition hover:border-[#36D7FF]/35"
                >
                  {team.teamName}
                </Link>
              ))}
              {teams.length === 0 && (
                <p className="text-sm font-semibold text-[#C9DFEB]">
                  No approved teams yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </HubShell>
  );
}
