import Image from "next/image";

const teams = {
  mfg: {
    name: "Make France Great Again",
    tag: "MFG",
    logo: "/logos/mfg.png",
  },
  niu: {
    name: "NiuNiuPower",
    tag: "NIU",
    logo: "/logos/niu.png",
  },
  fla: {
    name: "Flanmingos",
    tag: "FLA",
    logo: "/logos/fla.png",
  },
  biy: {
    name: "Bean In Your Mum",
    tag: "BIY",
    logo: "/logos/biy.png",
  },
  eb: {
    name: "Exiled Bunzz",
    tag: "EB",
    logo: "/logos/eb.png",
  },
  zaf: {
    name: "Zycope And Friends",
    tag: "ZAF",
    logo: "/logos/zaf.png",
  },
};

const weeklyFixtures = [
  {
    week: "Week 1",
    window: "20 April – 26 April",
    matches: [
      { home: teams.mfg, away: teams.eb },
      { home: teams.mfg, away: teams.zaf },
      { home: teams.niu, away: teams.fla },
      { home: teams.biy, away: teams.eb },
      { home: teams.biy, away: teams.zaf },
    ],
  },
  {
    week: "Week 2",
    window: "27 April – 3 May",
    matches: [
      { home: teams.niu, away: teams.zaf },
      { home: teams.niu, away: teams.eb },
      { home: teams.fla, away: teams.eb },
      { home: teams.mfg, away: teams.biy },
      { home: teams.mfg, away: teams.fla },
    ],
  },
  {
    week: "Week 3",
    window: "4 May – 10 May",
    matches: [
      { home: teams.mfg, away: teams.niu },
      { home: teams.fla, away: teams.biy },
      { home: teams.eb, away: teams.zaf },
      { home: teams.niu, away: teams.biy },
      { home: teams.fla, away: teams.zaf },
    ],
  },
];

function TeamSide({
  name,
  tag,
  logo,
  align = "left",
}: {
  name: string;
  tag: string;
  logo: string;
  align?: "left" | "right";
}) {
  const isRight = align === "right";

  return (
    <div
      className={`flex min-w-0 items-center gap-4 ${
        isRight ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {!isRight && (
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950 to-black p-2 shadow-[0_0_18px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
          <Image
            src={logo}
            alt={`${tag} logo`}
            width={64}
            height={64}
            className="relative h-11 w-11 object-contain sm:h-14 sm:w-14"
          />
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
          {tag}
        </p>
        <p className="mt-1 truncate text-xs uppercase tracking-[0.22em] text-zinc-400 sm:text-sm">
          {name}
        </p>
      </div>

      {isRight && (
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950 to-black p-2 shadow-[0_0_18px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
          <Image
            src={logo}
            alt={`${tag} logo`}
            width={64}
            height={64}
            className="relative h-11 w-11 object-contain sm:h-14 sm:w-14"
          />
        </div>
      )}
    </div>
  );
}

function MatchCard({
  home,
  away,
}: {
  home: { name: string; tag: string; logo: string };
  away: { name: string; tag: string; logo: string };
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-black via-black to-zinc-950 p-6 shadow-[0_0_30px_rgba(0,0,0,0.22)] transition duration-300 hover:border-green-400/30 hover:shadow-[0_0_40px_rgba(34,197,94,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.05),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_22%)] opacity-80" />

      <div className="relative mb-6 flex items-center justify-end">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
          BO2
        </span>
      </div>

      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
        <TeamSide name={home.name} tag={home.tag} logo={home.logo} />

        <div className="flex items-center justify-center">
          <div className="rounded-full border border-green-400/20 bg-green-500/10 px-8 py-4 text-lg font-black uppercase tracking-[0.26em] text-green-300">
            VS
          </div>
        </div>

        <TeamSide
          name={away.name}
          tag={away.tag}
          logo={away.logo}
          align="right"
        />
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Expat China League
          </p>

          <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
            Schedule
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
            ECL Spring Split runs from{" "}
            <span className="font-bold text-white">20 April</span> to{" "}
            <span className="font-bold text-white">20 May</span>. Each team plays
            multiple regular season BO2 series before advancing into the single
            elimination stage.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Season Start
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">20 April</h2>
            <p className="mt-3 text-zinc-300">
              Opening week of the Spring Split.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Regular Season
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">BO2</h2>
            <p className="mt-3 text-zinc-300">
              Teams face multiple opponents across the opening weeks.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Match Window
            </p>
            <h2 className="mt-4 text-3xl font-black uppercase">18:00 to 23:00</h2>
            <p className="mt-3 text-zinc-300">
              Weekly series should be arranged within the official evening window.
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-[2rem] border border-white/10 bg-zinc-950 p-8 shadow-[0_0_30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
                Weekly Fixtures
              </p>

              <h2 className="mt-4 text-3xl font-black uppercase">
                Official Matchups
              </h2>

              <p className="mt-4 max-w-3xl text-zinc-300">
                This page shows the official fixture poster for the regular
                season. Results and final scores are tracked separately on the{" "}
                <span className="font-bold text-white">Results</span> page.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">
              Fixture Overview
            </div>
          </div>

          <div className="mt-10 space-y-10">
            {weeklyFixtures.map((week) => (
              <div key={week.week}>
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-green-400">
                      {week.week}
                    </p>
                    <h3 className="mt-2 text-2xl font-black uppercase text-white">
                      {week.window}
                    </h3>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">
                    {week.matches.length} Series
                  </div>
                </div>

                <div className="space-y-5">
                  {week.matches.map((match, index) => (
                    <MatchCard
                      key={`${week.week}-${index}`}
                      home={match.home}
                      away={match.away}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-[2rem] border border-white/10 bg-gradient-to-b from-zinc-950 to-black p-8 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Notes
          </p>

          <h2 className="mt-4 text-3xl font-black uppercase">
            Important Information
          </h2>

          <div className="mt-6 space-y-4 text-zinc-300">
            <p>
              Each regular season fixture is a BO2 series, meaning both teams
              play two games in that matchup.
            </p>
            <p>
              This schedule page is for fixture visibility only. Final scorelines
              and completed results are shown on the Results page.
            </p>
            <p>
              The recommended official scheduling window is between 18:00 and
              23:00 China time.
            </p>
            <p>
              Exact day and start time should be arranged directly between
              captains through the KOOK scheduling system.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}