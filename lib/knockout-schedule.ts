import { MatchStatus, PrismaClient } from "@prisma/client";
import { buildKnockoutBracket } from "@/lib/knockout-bracket";

type SyncKnockoutScheduleResult = {
  created: number;
  updated: number;
  skipped: number;
};

export async function syncKnockoutBracketToSchedule(
  prisma: PrismaClient
): Promise<SyncKnockoutScheduleResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
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
  const resolvedBracket = buildKnockoutBracket(storedMatches);

  for (const slot of resolvedBracket) {
    const homeTeamId = slot.homeTeam?.teamId;
    const awayTeamId = slot.awayTeam?.teamId;

    if (!homeTeamId || !awayTeamId) {
      skipped += 1;
      continue;
    }

    const existingMatch = await prisma.match.findFirst({
      where: {
        matchLabel: slot.id,
        stage: slot.stage,
      },
    });

    const data = {
      homeTeamId,
      awayTeamId,
      stage: slot.stage,
      roundLabel: slot.stageLabel,
      matchLabel: slot.id,
      bestOf: slot.bestOf,
      scheduledAt: null,
      status: MatchStatus.SCHEDULED,
      notes: "Synced from knockout bracket for KOOK scheduling.",
    };

    if (existingMatch) {
      await prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          ...data,
          scheduledAt: existingMatch.scheduledAt,
          homeScore: existingMatch.homeScore,
          awayScore: existingMatch.awayScore,
          winnerTeamId: existingMatch.winnerTeamId,
          status:
            existingMatch.status === MatchStatus.CANCELLED
              ? MatchStatus.SCHEDULED
              : existingMatch.status,
          notes: existingMatch.notes ?? data.notes,
        },
      });
      updated += 1;
    } else {
      await prisma.match.create({
        data,
      });
      created += 1;
    }
  }

  return { created, updated, skipped };
}
