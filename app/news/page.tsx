import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, Newspaper, Sparkles } from "lucide-react";

const featured = {
  label: "Patch Notes",
  date: "Jun 15, 2026",
  title: "ECL Hub beta is opening",
  text: "The first Hub release brings player profiles, ranked ladder views, champion intelligence, and inhouse match history into one home for the community.",
};

const posts = [
  {
    type: "Event",
    title: "Ranked inhouse test nights",
    date: "Beta window",
    text: "Queue tests will help tune ELO ranges, role demand, reporting flow, and KOOK bot commands.",
  },
  {
    type: "Patch Notes",
    title: "Champion and objective icons added",
    date: "Jun 15, 2026",
    text: "CommunityDragon assets are now available for champion pools, match reports, and objective summaries.",
  },
  {
    type: "Announcement",
    title: "Player profiles enter beta",
    date: "Jun 15, 2026",
    text: "Profiles include banners, avatars, titles, role identity, champion pools, awards, and analytics cards.",
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
            <p>Hub patch notes and feature changes.</p>
            <p>Inhouse event dates and queue tests.</p>
            <p>Tournament announcements and community updates.</p>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
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
