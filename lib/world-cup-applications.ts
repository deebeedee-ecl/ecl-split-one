export type WorldCupApplicationMeta = {
  isWorldCup: boolean;
  requestedTeam: string;
  requestedTeamId: string;
  nationality: string;
  nationalityCode: string;
  pitch: string;
  captainDecision: string;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function findLine(notes: string, label: string) {
  const prefix = `${label}:`;
  return (
    notes
      .split(/\r?\n/)
      .find((line) => line.trim().toLowerCase().startsWith(prefix.toLowerCase()))
      ?.replace(new RegExp(`^${label}:\\s*`, "i"), "")
      .trim() || ""
  );
}

export function parseWorldCupApplication(notes?: string | null): WorldCupApplicationMeta {
  const cleanNotes = clean(notes);

  return {
    isWorldCup: cleanNotes.toLowerCase().includes("world cup team application"),
    requestedTeam: findLine(cleanNotes, "Requested team"),
    requestedTeamId: findLine(cleanNotes, "Requested team ID"),
    nationality: findLine(cleanNotes, "Nationality"),
    nationalityCode: findLine(cleanNotes, "Nationality code"),
    pitch: findLine(cleanNotes, "Player pitch") || findLine(cleanNotes, "Player note"),
    captainDecision: findLine(cleanNotes, "Captain decision"),
  };
}

export function notesWithCaptainDecision(notes: string | null | undefined, decision: "Accepted" | "Rejected") {
  const lines = clean(notes)
    .split(/\r?\n/)
    .filter((line) => !line.trim().toLowerCase().startsWith("captain decision:"));

  return [...lines, `Captain decision: ${decision}`].filter(Boolean).join("\n");
}
