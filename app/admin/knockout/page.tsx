import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MatchStage, MatchStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const bracketSlots = [
  {
    id: "playoff-1v6",
    stage: "PLAYOFFS" as const,
    title: "Opening Round",
    label: "Seed 1 vs Seed 6",
    bestOf: 3,
  },
  {
    id: "playoff-2v5",
    stage: "PLAYOFFS" as const,
    title: "Opening Round",
    label: "Seed 2 vs Seed 5",
    bestOf: 3,
  },
  {
    id: "playoff-3v4",
    stage: "PLAYOFFS" as const,
    title: "Opening Round",
    label: "Seed 3 vs Seed 4",
    bestOf: 3,
  },
  {
    id: "semifinal",
    stage: "SEMIFINALS" as const,
    title: "Semifinal",
    label: "Lower Remaining Seeds",
    bestOf: 3,
  },
  {
    id: "final",
    stage: "FINALS" as const,
    title: "Final",
    label: "Championship Final",
    bestOf: 5,
  },
];

const statusOptions = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FORFEIT", label: "Forfeit" },
  { value: "POSTPONED", label: "Postponed" },
  { value: "CANCELLED", label: "Cancelled" },
];

type SearchParams = Promise<{
  updated?: string;
}>;

function parseScore(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(String(value ?? "0"));

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }

  return Math.round(parsed);
}

function toDateTimeLocal(date?: Date | null) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function saveKnockoutSlot(formData: FormData) {
  "use server";

  const slotId = String(formData.get("slotId") || "");
  const homeTeamId = String(formData.get("homeTeamId") || "");
  const awayTeamId = String(formData.get("awayTeamId") || "");
  const winnerTeamId = String(formData.get("winnerTeamId") || "");
  const status = String(formData.get("status") || "SCHEDULED") as MatchStatus;
  const scheduledAtRaw = String(formData.get("scheduledAt") || "");
  const homeScore = parseScore(formData.get("homeScore"), "Home score");
  const awayScore = parseScore(formData.get("awayScore"), "Away score");

  const slot = bracketSlots.find((item) => item.id === slotId);

  if (!slot) {
    throw new Error("Unknown knockout slot.");
  }

  if (!homeTeamId || !awayTeamId) {
    throw new Error("Both teams are required before saving a bracket slot.");
  }

  if (homeTeamId === awayTeamId) {
    throw new Error("A team cannot play itself.");
  }

  if (!Object.values(MatchStatus).includes(status)) {
    throw new Error("Invalid match status.");
  }

  if (
    winnerTeamId &&
    winnerTeamId !== homeTeamId &&
    winnerTeamId !== awayTeamId
  ) {
    throw new Error("Winner must be one of the selected teams.");
  }

  const existingMatch = await prisma.match.findFirst({
    where: {
      matchLabel: slot.id,
      stage: slot.stage,
    },
    select: {
      id: true,
    },
  });

  const data = {
    homeTeamId,
    awayTeamId,
    stage: slot.stage as MatchStage,
    roundLabel: slot.title,
    matchLabel: slot.id,
    bestOf: slot.bestOf,
    scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : null,
    status,
    homeScore,
    awayScore,
    winnerTeamId: winnerTeamId || null,
  };

  if (existingMatch) {
    await prisma.match.update({
      where: {
        id: existingMatch.id,
      },
      data,
    });
  } else {
    await prisma.match.create({
      data,
    });
  }

  revalidatePath("/admin/knockout");
  revalidatePath("/standings");
  revalidatePath("/results");

  redirect("/admin/knockout?updated=1");
}

export default async function AdminKnockoutPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const showUpdatedBanner = resolvedSearchParams?.updated === "1";

  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    }),
    prisma.match.findMany({
      where: {
        stage: {
          in: ["PLAYOFFS", "SEMIFINALS", "FINALS"],
        },
        matchLabel: {
          in: bracketSlots.map((slot) => slot.id),
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winnerTeam: true,
      },
    }),
  ]);

  const matchesBySlot = new Map(matches.map((match) => [match.matchLabel, match]));

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

        {showUpdatedBanner && (
          <div className="mb-6 rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4 text-sm font-medium text-green-300">
            Knockout slot saved successfully.
          </div>
        )}

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em]">
            Knockout Editor
          </h1>
          <p className="mt-2 max-w-3xl text-white/60">
            Pick teams, set scores, and select the winner for each bracket slot.
            Saved slots appear on the public standings knockout view.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
          {bracketSlots.map((slot) => {
            const match = matchesBySlot.get(slot.id);
            const homeWinner = Boolean(
              match?.winnerTeamId && match.winnerTeamId === match.homeTeamId
            );
            const awayWinner = Boolean(
              match?.winnerTeamId && match.winnerTeamId === match.awayTeamId
            );

            return (
              <form
                key={slot.id}
                action={saveKnockoutSlot}
                className={`rounded-2xl border p-5 ${
                  match?.winnerTeamId
                    ? "border-green-400/25 bg-green-500/10"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <input type="hidden" name="slotId" value={slot.id} />

                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-green-400">
                      {slot.title}
                    </div>
                    <h2 className="mt-2 text-xl font-black uppercase tracking-[0.05em]">
                      {slot.label}
                    </h2>
                  </div>

                  <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/65">
                    BO{slot.bestOf}
                  </div>
                </div>

                <div className="grid gap-4">
                  <TeamSelect
                    label="Home Team"
                    name="homeTeamId"
                    teams={teams}
                    defaultValue={match?.homeTeamId ?? ""}
                    isWinner={homeWinner}
                    isEliminated={Boolean(match?.winnerTeamId && !homeWinner)}
                  />

                  <TeamSelect
                    label="Away Team"
                    name="awayTeamId"
                    teams={teams}
                    defaultValue={match?.awayTeamId ?? ""}
                    isWinner={awayWinner}
                    isEliminated={Boolean(match?.winnerTeamId && !awayWinner)}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Home Score">
                      <input
                        name="homeScore"
                        type="number"
                        min="0"
                        defaultValue={match?.homeScore ?? 0}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                      />
                    </Field>

                    <Field label="Away Score">
                      <input
                        name="awayScore"
                        type="number"
                        min="0"
                        defaultValue={match?.awayScore ?? 0}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                      />
                    </Field>
                  </div>

                  <Field label="Winner">
                    <select
                      name="winnerTeamId"
                      defaultValue={match?.winnerTeamId ?? ""}
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                    >
                      <option value="">No winner yet</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Status">
                      <select
                        name="status"
                        defaultValue={match?.status ?? "SCHEDULED"}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Scheduled At">
                      <input
                        name="scheduledAt"
                        type="datetime-local"
                        defaultValue={toDateTimeLocal(match?.scheduledAt)}
                        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50"
                      />
                    </Field>
                  </div>

                  <button
                    type="submit"
                    className="mt-2 rounded-xl bg-green-400 px-5 py-3 font-bold uppercase tracking-wide text-black transition hover:bg-green-300"
                  >
                    Save Slot
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/75">
        {label}
      </span>
      {children}
    </label>
  );
}

function TeamSelect({
  label,
  name,
  teams,
  defaultValue,
  isWinner,
  isEliminated,
}: {
  label: string;
  name: string;
  teams: { id: string; name: string; logoUrl: string | null }[];
  defaultValue: string;
  isWinner: boolean;
  isEliminated: boolean;
}) {
  return (
    <Field label={label}>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className={`w-full rounded-xl border bg-black px-4 py-3 text-white outline-none transition focus:border-green-400/50 ${
          isWinner
            ? "border-green-400/45 bg-green-500/10 text-green-200"
            : isEliminated
              ? "border-white/5 text-white/35"
              : "border-white/10"
        }`}
      >
        <option value="" disabled>
          Select team
        </option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
