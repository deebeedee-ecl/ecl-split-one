import type { Prisma } from "@prisma/client";

export function isInhouseRoundLabel(roundLabel: string | null | undefined) {
  return typeof roundLabel === "string"
    && (roundLabel.startsWith("IH")
      || roundLabel.startsWith("Manual IH")
      || roundLabel === "Ranked Inhouse");
}

export const INHOUSE_MATCH_FILTER: Prisma.MatchGamePlayerStatWhereInput = {
  matchGame: {
    match: {
      OR: [
        { roundLabel: { startsWith: "IH" } },
        // Compatibility for manual imports created before their label prefix
        // was aligned with the canonical IH prefix.
        { roundLabel: { startsWith: "Manual IH" } },
        { roundLabel: "Ranked Inhouse" },
      ],
    },
  },
};
