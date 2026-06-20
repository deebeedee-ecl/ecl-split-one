import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Medal,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
} from "lucide-react";
import AggressiveHubPreview from "@/components/AggressiveHubPreview";

const howItWorks = [
  "Link your player profile",
  "Join inhouses through KOOK",
  "Play games with the community",
  "Report results after the lobby",
  "Track profiles, ranks, and match records",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="relative isolate overflow-hidden border-b border-[#1f1f1f] bg-[#050505]">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_34%),radial-gradient(circle_at_72%_18%,rgba(209,26,42,0.2),transparent_26%)]" />
        <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />
        <div className="absolute left-0 top-0 h-full w-1/3 bg-[linear-gradient(100deg,rgba(177,18,38,0.28),transparent)] [clip-path:polygon(0_0,74%_0,36%_100%,0_100%)]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.56fr_0.44fr] lg:items-center lg:py-16">
          <div className="max-w-2xl">
            <h1 className="flex max-w-4xl flex-col items-start text-[clamp(4.8rem,10.8vw,9.8rem)] font-black uppercase leading-[0.78] tracking-normal text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              <span className="block">Expat</span>
              <span className="block text-[#b11226]">China</span>
              <span className="block">League</span>
            </h1>

            <div className="mt-6 h-1 w-28 bg-[#b11226] [clip-path:polygon(0_0,100%_0,86%_100%,0_100%)]" />

            <p className="mt-7 max-w-xl text-lg leading-8 text-[#9ca3af]">
              Ranked inhouses, player stats, tournaments and community League
              of Legends in China.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/hub"
                className="inline-flex items-center justify-center gap-2 bg-[#b11226] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#d11a2a] [clip-path:polygon(0_0,94%_0,100%_28%,100%_100%,6%_100%,0_72%)]"
              >
                Enter the Hub
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/how-to-play"
                className="inline-flex items-center justify-center gap-2 border border-[#1f1f1f] bg-[#0d0d0d] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#b11226]"
              >
                Guide to playing in China
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[32rem] items-center justify-center overflow-visible lg:min-h-[48rem]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_52%)]" />
            <div className="relative w-full max-w-[92rem] lg:translate-x-24">
              <Image
                src="/ecl-logo.png"
                alt="ECL logo"
                width={900}
                height={900}
                className="mx-auto aspect-square w-full max-w-[88rem] scale-[2.2] object-contain opacity-90 mix-blend-screen drop-shadow-[0_0_46px_rgba(255,255,255,0.16)]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
              How It Works
            </p>
            <h2 className="mt-4 text-5xl font-black uppercase leading-none text-white [font-family:Impact,Anton,Arial_Black,Arial,sans-serif]">
              Play.
              <br />
              Report.
              <br />
              Climb.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#9ca3af]">
              ECL turns community inhouses into a ranked season. Players join
              through KOOK, lobbies are balanced by ELO, and each result feeds a
              player-first stat hub.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {howItWorks.map((step, index) => (
              <div
                key={step}
                className="group relative overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] p-5 transition hover:border-[#b11226]"
              >
                <div className="absolute right-0 top-0 h-full w-16 bg-[#b11226]/10 [clip-path:polygon(45%_0,100%_0,100%_100%,0_100%)]" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center bg-[#b11226] text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <p className="font-black uppercase tracking-[0.04em] text-white">
                    {step}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.48fr_0.52fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
              The Hub
            </p>
            <h2 className="mt-4 text-5xl font-black uppercase leading-none text-white [font-family:Impact,Anton,Arial_Black,Arial,sans-serif]">
              Your ECL
              <br />
              stat centre.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#9ca3af]">
              The beta Hub now connects ECL accounts, public player profiles,
              China-server profile lookup, solo and flex rank context,
              champion pools, match history spaces, contact messages, and the
              KOOK-ready inhouse flow.
            </p>
            <Link
              href="/hub"
              className="mt-8 inline-flex items-center justify-center gap-2 bg-[#b11226] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#d11a2a] [clip-path:polygon(0_0,94%_0,100%_28%,100%_100%,6%_100%,0_72%)]"
            >
              View the Hub
              <ArrowRight size={18} />
            </Link>
          </div>

          <AggressiveHubPreview />
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#080808]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-3">
          {[
            {
              icon: Swords,
              title: "Ranked Inhouses",
              text: "The KOOK bot command creates a lobby, players join, teams are auto-balanced by ELO, and the captain reports the result after the game.",
            },
            {
              icon: BarChart3,
              title: "Player Progression",
              text: "Every profile can show ELO, win/loss record, champion pool, MVPs, weekly awards, recent form, and match history.",
            },
            {
              icon: Search,
              title: "ecl.gg Lookup",
              text: "China server profile lookup is already feeding profile data, ranked context, recent games, and champion information into the beta Hub.",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="border border-[#1f1f1f] bg-[#0d0d0d] p-6"
              >
                <Icon className="text-[#b11226]" size={30} />
                <h2 className="mt-6 text-3xl font-black uppercase leading-none text-white">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-6 text-[#9ca3af]">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
            <div className="flex items-start gap-4">
              <Medal className="mt-1 text-[#b11226]" size={28} />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[#9ca3af]">
                  Account System
                </p>
                <h2 className="mt-3 text-4xl font-black uppercase leading-none text-white [font-family:Impact,Anton,Arial_Black,Arial,sans-serif]">
                  Public profiles.
                  <br />
                  Private account details.
                </h2>
                <p className="mt-5 text-base leading-7 text-[#9ca3af]">
                  Players can sign up, verify email, manage account settings,
                  upload profile images, link Riot identity, and keep private
                  verification details separate from the public profile view.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-[#1f1f1f] bg-[#0d0d0d] p-6">
            <ShieldCheck className="text-[#b11226]" size={28} />
            <h2 className="mt-5 text-4xl font-black uppercase leading-none text-white [font-family:Impact,Anton,Arial_Black,Arial,sans-serif]">
              Teams stay historical.
            </h2>
            <p className="mt-5 text-sm leading-6 text-[#9ca3af]">
              Teams belong to tournament rosters, historical memberships, and
              past archives. The core identity is the player ladder.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#080808]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
                Past Tournaments
              </p>
              <h2 className="mt-3 text-5xl font-black uppercase leading-none text-white [font-family:Impact,Anton,Arial_Black,Arial,sans-serif]">
                Archive, not the whole identity.
              </h2>
            </div>
            <Link
              href="/tournaments"
              className="hidden items-center gap-2 border border-[#1f1f1f] bg-[#0d0d0d] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:border-[#b11226] sm:inline-flex"
            >
              Open Archive
              <ArrowRight size={17} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {["Winter Cup", "Split One", "Future Events"].map((event) => (
              <div
                key={event}
                className="border border-[#1f1f1f] bg-[#0d0d0d] p-5"
              >
                <CheckCircle2 className="text-[#b11226]" size={22} />
                <h3 className="mt-5 text-2xl font-black uppercase text-white">
                  {event}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#9ca3af]">
                  Tournament context, rosters, brackets, results, and
                  historical player storylines live here.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
