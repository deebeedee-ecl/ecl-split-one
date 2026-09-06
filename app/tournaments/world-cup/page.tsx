import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Globe2, ShieldCheck, Trophy, Users } from "lucide-react";

const pillars = [
  {
    icon: Users,
    title: "Find A Roster",
    text: "Build around national identity. Each squad has six slots, with up to two imports allowed.",
  },
  {
    icon: ShieldCheck,
    title: "No Elo Requirement",
    text: "The World Cup is not gated by ladder position. Bring commitment, communication, and national pride.",
  },
  {
    icon: Trophy,
    title: "A World To Win",
    text: "A double elimination knockout bracket decides the ECL world champions.",
  },
];

const dates = [
  { label: "Team Deadline", value: "Sep 13th" },
  { label: "Tournament Begins", value: "Sep 18th" },
  { label: "Format", value: "Double Elimination" },
];

export default function WorldCupInfoPage() {
  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden border-b border-[#0797F2]/30">
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,23,0.98)_0%,rgba(6,28,74,0.88)_42%,rgba(7,85,201,0.38)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(0deg,#020817,transparent)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,#77CFFF_1px,transparent_1px),linear-gradient(#77CFFF_1px,transparent_1px)] [background-size:82px_82px]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-between px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-4xl">
            <Image
              src="/ecl-logo.png"
              alt="ECL"
              width={188}
              height={132}
              className="h-20 w-auto object-contain md:h-24"
              priority
            />
            <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-[#77CFFF]">
              Upcoming Tournament
            </p>
            <h1 className="mt-4 text-[clamp(4rem,11vw,9rem)] font-black uppercase leading-[0.82] tracking-normal text-[#F5F5F2] [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              World Cup
            </h1>
            <p className="mt-7 max-w-2xl text-2xl font-black uppercase leading-8 text-white">
              A world to win.
            </p>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#C9DFEB]">
              The ECL World Cup is a national-roster tournament for the Hub:
              teams form around country identity, admins approve final squads,
              and the bracket plays out through a double elimination format.
            </p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {dates.map((item) => (
              <div key={item.label} className="border border-[#36D7FF]/28 bg-[#061C4A]/72 p-5 backdrop-blur-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#77CFFF]">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-black uppercase text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#0797F2]/24 bg-[#061C4A]">
        <div className="mx-auto grid max-w-7xl gap-0 px-4 py-14 sm:px-6 lg:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.title}
                className="border border-[#36D7FF]/20 bg-[#020817]/42 p-6 lg:border-r-0 lg:last:border-r"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#77CFFF]/45 bg-[#0755C9]/20 text-white">
                  <Icon size={23} />
                </div>
                <h2 className="mt-5 text-2xl font-black uppercase tracking-normal text-white">
                  {pillar.title}
                </h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#C9DFEB]">
                  {pillar.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-[#020817]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#36D7FF]">
              Tournament Brief
            </p>
            <h2 className="mt-4 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              National rosters.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-[#C9DFEB]">
              Captains create teams, players apply through the Hub, and ECL
              admins approve the final roster before teams appear publicly.
            </p>
          </div>

          <div className="grid gap-4">
            <InfoRow icon={<Globe2 size={18} />} title="Roster Identity" text="Countrymen and countrywomen first, with limited import flexibility for final squads." />
            <InfoRow icon={<CalendarDays size={18} />} title="Submission Window" text="Teams should be submitted by Sep 13th so admins have time to review and lock rosters." />
            <InfoRow icon={<Trophy size={18} />} title="Tournament Play" text="Fixtures, standings, and reporting tools will move into the Hub once the bracket opens." />
          </div>
        </div>
      </section>

      <section className="border-t border-[#0797F2]/24 bg-[#061C4A]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#77CFFF]">
              Player Hub
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase text-white">
              Ready to build or join a roster?
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/hub/world-cup/create-team"
              className="inline-flex min-h-11 items-center gap-2 bg-[#0755C9] px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0797F2]"
            >
              Create Team
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/hub/world-cup/find-team"
              className="inline-flex min-h-11 items-center gap-2 border border-[#77CFFF]/35 px-5 text-xs font-black uppercase tracking-[0.12em] text-[#F5F5F2] transition hover:border-white hover:bg-[#0797F2]/18"
            >
              Find Team
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="grid gap-4 border border-[#36D7FF]/20 bg-[#061C4A]/62 p-5 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#77CFFF]/35 bg-[#0755C9]/18 text-[#77CFFF]">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-black uppercase text-white">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-7 text-[#C9DFEB]">{text}</p>
      </div>
    </article>
  );
}
