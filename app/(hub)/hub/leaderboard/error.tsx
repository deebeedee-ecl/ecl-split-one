"use client";

import { HubShell } from "../_components/HubShell";
import LadderUnavailable from "./LadderUnavailable";

export default function RankedLadderError({ unstable_retry }: { unstable_retry?: () => void }) {
  return (
    <HubShell active="ladder" eyebrow="Ranked Inhouse" title="Ranked Ladder" description="ECL ranked inhouse standings.">
      <LadderUnavailable retry={unstable_retry} />
    </HubShell>
  );
}
