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
      {
        home: teams.mfg,
        away: teams.eb,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.mfg,
        away: teams.zaf,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.niu,
        away: teams.fla,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.biy,
        away: teams.eb,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.biy,
        away: teams.zaf,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
    ],
  },
  {
    week: "Week 2",
    window: "27 April – 3 May",
    matches: [
      {
        home: teams.niu,
        away: teams.zaf,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.niu,
        away: teams.eb,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.fla,
        away: teams.eb,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.mfg,
        away: teams.biy,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.mfg,
        away: teams.fla,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
    ],
  },
  {
    week: "Week 3",
    window: "4 May – 10 May",
    matches: [
      {
        home: teams.mfg,
        away: teams.niu,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.fla,
        away: teams.biy,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.eb,
        away: teams.zaf,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.niu,
        away: teams.biy,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
      {
        home: teams.fla,
        away: teams.zaf,
        status: "To Be Scheduled",
        scoreHome: null,
        scoreAway: null,
      },
    ],
  },
];

function TeamBadge({
  tag,
  logo,
  align = "left",
}: {
  tag: string;
  logo: string;
  align?: "left" | "right";
}) {
  const wrapper =
    align === "right"
      ? "flex min-w-0 items-center justify-end gap-4 text-right"
      : "flex min-w-0 items-center gap-4";

  return (
    <div className={wrapper}>
      {align === "right" ? (
        <>
          <div className="min-w-0">
            <p className="truncate text-3xl font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.08)] sm:text-4xl">
              {tag}
            </p>
          </div>

          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-gradient-to-b from-zinc-950 to-black p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20">
            <div className="absolute inset-0 rounded-[1.35rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
            <Image
              src={logo}
              alt={`${tag} logo`}
              width={64}
              height={64}
              className="relative h-11 w-11 object-contain sm:h-14 sm:w-14"
            />
          </div>
        </>
      ) : (
        <>
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-gradient-to-b from-zinc-950 to-black p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20">
            <div className="absolute inset-0 rounded-[1.35rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_50%)]" />
            <Image
              src={logo}
              alt={`${tag} logo`}
              width={64}
              height={64}
              className="relative h-11 w-11 object-contain sm:h-14 sm:w-14"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-3xl font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.08)] sm:text-4xl">
              {tag}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function MatchCenter({
  scoreHome,
  scoreAway,
}: {
  scoreHome: number | null;
  scoreAway: number | null;
}) {
  const hasScore = scoreHome !== null && scoreAway !== null;

  return (
    <div className="flex items-center justify-center">
      <div
        className={`rounded-full px-5 py-3 text-base font-black uppercase tracking-[0.24em] shadow-[0_0_18px_rgba(0,0,0,0.2)] ${
          hasScore
            ? "border border-white/15 bg-white/10 text-white"
            : "border border-green-400/20 bg-green-500/10 text-green-300"
        }`}
      >
        {hasScore ? `${scoreHome} - ${scoreAway}` : "VS"}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles =
    status === "Completed"
      ? "border-green-400/20 bg-green-500/10 text-green-300"
      : status === "Scheduled"
        ? "border-blue-400/20 bg-blue-500/10 text-blue-300"
        : "border-amber-400/20 bg-amber-500/10 text-amber-300";

  return (
    <span
      className={`rounded-full border px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] ${styles}`}
    >
      {status}
    </span>
  );
}

function MatchRow({
  home,
  away,
  status,
  scoreHome,
  scoreAway,
}: {
  home: { name: string; tag: string; logo: string };
  away: { name: string; tag: string; logo: string };
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-black via-black to-zinc-950 p-6 shadow-[0_0_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-green-400/30 hover:shadow-[0_0_40px_rgba(34,197,94,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.06),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_24%)] opacity-70" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <TeamBadge tag={home.tag} logo={home.logo} />

          <MatchCenter scoreHome={scoreHome} scoreAway={scoreAway} />

          <TeamBadge tag={away.tag} logo={away.logo} align="right" />
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <span className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
            BO2
          </span>
          <StatusBadge status={status} />
        </div>
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
                Fixtures are listed by week. Before a match is played, the center
                shows <span className="font-bold text-white">VS</span>. After the
                BO2 is completed, that changes to the final series score.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">
              Score-ready layout
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
                    <MatchRow
                      key={`${week.week}-${index}`}
                      home={match.home}
                      away={match.away}
                      status={match.status}
                      scoreHome={match.scoreHome}
                      scoreAway={match.scoreAway}
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
              play two games in that matchup. 'Home' team chooses Red/Blue side.
            </p>
            <p>
              Before results are entered, fixtures display as VS. Once completed,
              scores like 2 - 0 or 1 - 1 can be shown in the center.
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