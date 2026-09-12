import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, Newspaper, Sparkles } from "lucide-react";

const featured = {
  label: "Patch Notes",
  date: "Sep 12, 2026",
  title: "Patch 2.1: Pure KOOK reporting and ranked LP tuning",
  text: "Patch 2.1 completes the ranked inhouse report loop through KOOK, moves Lzyumi lookups to the always-on Report Engine, tunes LP gains and decay, cleans up Split One archive data, and adds Arabia to the World Cup country list.",
};

const posts = [
  {
    type: "KOOK",
    title: "Report Engine is live",
    date: "Patch 2.1",
    text: "Players can use !report after an inhouse, confirm with !yes, and let Coach submit the match without opening the website. The Report Engine now finds recent Lzyumi games and match details from the HK worker.",
  },
  {
    type: "Ranked IH",
    title: "LP rules updated",
    date: "Patch 2.1",
    text: "Wins now get +5 LP, W3+ streaks gain bonus LP, Thursday and Friday first wins can double positive LP, and inactivity decay starts after seven days but cannot decay a player below 600 LP.",
  },
  {
    type: "Archive",
    title: "Split One data cleaned",
    date: "Patch 2.1",
    text: "Past tournament pages were checked in production mode. Split One archive data is now scoped to Split One teams and matches so ranked inhouse stats no longer mix into the tournament archive.",
  },
  {
    type: "World Cup",
    title: "Arabia added",
    date: "Patch 2.1",
    text: "Arabia is now available in the World Cup country and flag list, with a matching flag asset for team and player identity pages.",
  },
  {
    type: "Tournament",
    title: "ECL World Cup hub opens",
    date: "Teams due Sep 13",
    text: "The Hub dashboard now focuses on the ECL World Cup: national rosters, no Elo requirement, team creation, team applications, standings, fixtures, and captain dashboards.",
  },
  {
    type: "Systems",
    title: "Patch 2.0: ECL.GG refresh became server-backed",
    date: "Patch 2.0",
    text: "Profile refreshes can now run through the Vercel job path instead of relying only on a user browser. Failed refreshes are queued, retried, and visible to admins.",
  },
];

export default function NewsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] px-4 py-20 sm:px-6">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.2),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(177,18,38,0.18),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

        <div className="relative mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-[#b11226]">
            League Updates
          </p>
          <h1 className="mt-3 text-6xl font-black uppercase leading-none [font-family:Anton,Impact,Arial_Black,Arial,sans-serif] md:text-8xl">
            News
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#9ca3af]">
            Patch notes, Hub development updates, event announcements, ranked
            inhouse news, and community notices live here.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="relative overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] p-7">
          <div className="absolute right-0 top-0 h-full w-32 bg-[#b11226]/15 [clip-path:polygon(42%_0,100%_0,100%_100%,0_100%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-3 text-sm font-black uppercase tracking-[0.14em] text-[#9ca3af]">
              <span className="inline-flex items-center gap-2 text-[#b11226]">
                <Sparkles size={17} />
                {featured.label}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={17} />
                {featured.date}
              </span>
            </div>
            <h2 className="mt-6 max-w-3xl text-5xl font-black uppercase leading-none text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              {featured.title}
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#9ca3af]">
              {featured.text}
            </p>
            <div className="mt-6 grid gap-3 text-sm font-semibold leading-6 text-[#c9d4e7] md:grid-cols-2">
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                KOOK reporting now runs through the Ubuntu Report Engine and returns a readable confirmation message.
              </p>
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                Ranked LP gains now include a flat win bonus, streak bonuses, and Thursday/Friday first-win double LP.
              </p>
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                Inactivity decay starts after seven days and cannot decay a player below 600 LP.
              </p>
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                Split One archive pages were checked and scoped so ranked inhouse stats stay out of tournament history.
              </p>
            </div>
            <Link
              href="/hub/dashboard"
              className="mt-8 inline-flex items-center gap-2 bg-[#b11226] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#d11a2a]"
            >
              View Hub
              <ArrowRight size={17} />
            </Link>
          </div>
        </article>

        <aside className="border border-[#1f1f1f] bg-[#0d0d0d] p-7">
          <Megaphone className="text-[#b11226]" size={28} />
          <h2 className="mt-5 text-3xl font-black uppercase leading-none text-white">
            What appears here?
          </h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-[#9ca3af]">
            <p>Patch 2.1 is focused on ranked inhouse quality of life.</p>
            <p>Coach can now carry the report flow from !report to !yes through the Report Engine.</p>
            <p>LP rules, inactive players, tournament archives, and World Cup flags all received cleanup passes.</p>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {posts.map((post) => (
            <article key={post.title} className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
              <Newspaper className="text-[#b11226]" size={24} />
              <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#b11226]">
                {post.type}
              </p>
              <h3 className="mt-3 text-2xl font-black uppercase leading-tight text-white">
                {post.title}
              </h3>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#6b7280]">
                {post.date}
              </p>
              <p className="mt-4 text-sm leading-6 text-[#9ca3af]">{post.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
