import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildKnockoutBracket } from "@/lib/knockout-bracket";
import { syncKnockoutBracketToSchedule } from "@/lib/knockout-schedule";

export const dynamic = "force-dynamic";

function TeamName({
  team,
}: {
  team: { name: string; seed?: number } | null;
}) {
  if (!team) {
    return <span className="text-white/35">TBD</span>;
  }

  return (
    <span>
      {team.name}
      {team.seed ? (
        <span className="ml-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
          Seed {team.seed}
        </span>
      ) : null}
    </span>
  );
}

async function syncKnockoutSchedule() {
  "use server";

  const result = await syncKnockoutBracketToSchedule(prisma);

  revalidatePath("/admin");
  revalidatePath("/admin/knockout");
  revalidatePath("/admin/matches");
  revalidatePath("/api/matches");
  revalidatePath("/results");
  revalidatePath("/schedule");
  revalidatePath("/standings");

  redirect(
    `/admin/knockout?synced=1&created=${result.created}&updated=${result.updated}&skipped=${result.skipped}`
  );
}

export default async function AdminKnockoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    synced?: string;
    created?: string;
    updated?: string;
    skipped?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showSyncBanner = resolvedSearchParams?.synced === "1";

  const storedMatches = await prisma.match.findMany({
    where: {
      stage: {
        in: ["PLAYOFFS", "SEMIFINALS", "FINALS"],
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      winnerTeam: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });

  const bracketMatches = buildKnockoutBracket(storedMatches);
  const scheduledKnockoutCount = storedMatches.filter(
    (match) => match.status === "SCHEDULED"
  ).length;

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
          >
            Back to Dashboard
          </Link>

          <Link
            href="/standings"
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/60 transition hover:text-green-400"
          >
            View Standings
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em]">
            Knockout Display
          </h1>
          <p className="mt-2 max-w-3xl text-white/60">
            Knockout pairings are seeded from the locked regular season
            standings. Sync the resolved slots into the match schedule so KOOK
            can pick them up without needing a date or time.
          </p>

          {showSyncBanner && (
            <div className="mt-5 max-w-4xl rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4 text-sm font-medium text-green-300">
              Knockout schedule synced. Created {resolvedSearchParams?.created ?? 0},
              updated {resolvedSearchParams?.updated ?? 0}, skipped{" "}
              {resolvedSearchParams?.skipped ?? 0} placeholder slots.
            </div>
          )}

          <div className="mt-5 flex max-w-4xl flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm leading-6 text-white/65 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="font-semibold text-white">
                {scheduledKnockoutCount}
              </span>{" "}
              knockout match records are currently scheduled. Placeholder
              semifinal/final slots are skipped until their teams are known.
            </div>
            <form action={syncKnockoutSchedule}>
              <button
                type="submit"
                className="rounded-xl bg-green-400 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-black transition hover:bg-green-300"
              >
                Sync to Schedule
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
          {bracketMatches.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-green-400">
                    {slot.stageLabel}
                  </div>
                  <h2 className="mt-2 text-xl font-black uppercase tracking-[0.05em]">
                    {slot.slotLabel}
                  </h2>
                </div>

                <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/65">
                  BO{slot.bestOf}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Home
                  </div>
                  <div className="font-bold text-white">
                    <TeamName team={slot.homeTeam} />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Away
                  </div>
                  <div className="font-bold text-white">
                    <TeamName team={slot.awayTeam} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      Score
                    </div>
                    <div className="font-bold text-white">
                      {slot.homeScore ?? "-"} - {slot.awayScore ?? "-"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      Status
                    </div>
                    <div className="font-bold text-white">{slot.status}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Winner
                  </div>
                  <div className="font-bold text-white">
                    {slot.winnerName || "TBD"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
