import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, Newspaper, Sparkles } from "lucide-react";

const featured = {
  label: "Patch Notes",
  date: "Sep 6, 2026",
  title: "Patch 2.0: World Cup, Coach, and Hub upgrades",
  text: "Patch 2.0 rebuilds the Hub around the ECL World Cup, improves ECL.GG stat refresh reliability, connects site messages to the KOOK admin channel, and starts moving inhouse reporting away from link-based workflows.",
};

const posts = [
  {
    type: "Tournament",
    title: "ECL World Cup hub opens",
    date: "Teams due Sep 13",
    text: "The Hub dashboard now focuses on the ECL World Cup: national rosters, no Elo requirement, team creation, team applications, standings, fixtures, and captain dashboards.",
  },
  {
    type: "Systems",
    title: "ECL.GG refresh is now server-backed",
    date: "Patch 2.0",
    text: "Profile refreshes can now run through the Vercel job path instead of relying only on a user browser. Failed refreshes are queued, retried, and visible to admins.",
  },
  {
    type: "KOOK",
    title: "Coach is becoming the bridge",
    date: "Patch 2.0",
    text: "The KOOK bot now has API routes for inhouse reporting and admin notifications. Contact messages from the website are relayed to the ECL admin channel.",
  },
  {
    type: "Hub",
    title: "Cleaner player and match views",
    date: "Patch 2.0",
    text: "The player directory moved toward a readable list layout with filters, inhouse match history was tightened for smaller screens, and champion stats gained pick, ban, win-rate, role, and minimum-game filters.",
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
                World Cup begins Sep 18. Teams should be submitted by Sep 13.
              </p>
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                Team access now follows verified Hub profiles, not manual contact IDs.
              </p>
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                Inhouse reporting is being anchored to the same data flow that works in the admin dashboard.
              </p>
              <p className="border border-[#0755C9]/45 bg-[#061C4A]/55 p-4">
                World Cup team dashboards show rosters, top champions, applications, and tournament performance stats.
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
            <p>Patch 2.0 is focused on reliability and tournament readiness.</p>
            <p>The ECL World Cup begins Sep 18, with team submissions due Sep 13.</p>
            <p>Coach, the Hub, and the admin dashboard are being tied together so match reporting and player data are easier to manage.</p>
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
