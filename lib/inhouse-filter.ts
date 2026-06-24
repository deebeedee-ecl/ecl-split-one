import type { Prisma } from "@prisma/client";

export const INHOUSE_MATCH_FILTER: Prisma.MatchGamePlayerStatWhereInput = {
  matchGame: {
    match: {
      OR: [
        { roundLabel: { startsWith: "IH" } },
        { roundLabel: "Ranked Inhouse" },
      ],
    },
  },
};
