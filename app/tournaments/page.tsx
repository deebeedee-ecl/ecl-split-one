import Link from "next/link";
import { ArrowRight, CalendarClock, Trophy } from "lucide-react";

const tournaments = [
  {
    title: "Winter Cup",
    label: "Archived",
    description:
      "Group stage, double elimination path, player leaders, team cards, logos, and workbook stats.",
    href: "/tournaments/winter-cup",
    accent: "from-[#b11226]/24",
  },
  {
    title: "Split One",
    label: "Archived",
    description:
      "League table, knockout bracket, ELO leaderboard, team-by-team stat pages, and match results.",
    href: "/tournaments/split-one",
    accent: "from-emerald-500/20",
  },
];

export default function TournamentsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] bg-[#050505]">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.2),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(209,26,42,0.2),transparent_28%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
            Tournament history
          </p>
          <h1 className="mt-5 max-w-4xl text-[clamp(4rem,9vw,8rem)] font-black uppercase leading-[0.82] text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
            Past
            <span className="block text-[#b11226]">Tournaments</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#9ca3af]">
            ECL tournament archives live here as historical records. Ranked
            inhouses are the future, but past cups still carry rosters,
            brackets, match results, awards, and team storylines.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-3">
          {tournaments.map((event, index) => (
            <Link
              key={event.title}
              href={event.href}
              className="group relative min-h-[22rem] overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] p-6 transition hover:border-[#b11226]"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${event.accent} to-transparent opacity-90`}
              />
              <div className="absolute right-0 top-0 h-full w-24 bg-[#b11226]/10 [clip-path:polygon(45%_0,100%_0,100%_100%,0_100%)]" />

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center bg-[#b11226] text-lg font-black">
                    {index + 1}
                  </div>
                  <span className="border border-[#1f1f1f] bg-black/40 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#9ca3af]">
                    {event.label}
                  </span>
                </div>

                <div className="mt-12">
                  <Trophy className="text-[#b11226]" size={30} />
                  <h2 className="mt-5 text-4xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
                    {event.title}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-[#9ca3af]">
                    {event.description}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-8 text-sm font-black uppercase tracking-[0.12em] text-white">
                  Open Archive
                  <ArrowRight
                    size={18}
                    className="transition group-hover:translate-x-1"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-16 sm:px-6 lg:grid-cols-[0.45fr_0.55fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
              Archive note
            </p>
            <h2 className="mt-4 text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              History only.
            </h2>
          </div>
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
            <CalendarClock className="text-[#b11226]" size={28} />
            <p className="mt-5 text-base leading-7 text-[#9ca3af]">
              These pages are static archive views. They should not recalculate
              ELO, mutate Supabase, or change live records. The goal is to make
              old events readable while the Hub becomes the main ECL stat
              centre.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
