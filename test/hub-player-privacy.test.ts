import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Hub player surfaces apply the Riot ID privacy projection before client rendering", async () => {
  const [directory, worldCupDirectory, detail] = await Promise.all([
    readFile("app/(hub)/hub/players/page.tsx", "utf8"),
    readFile("app/(hub)/hub/world-cup/players/page.tsx", "utf8"),
    readFile("app/(hub)/hub/players/[slug]/page.tsx", "utf8"),
  ]);

  for (const source of [directory, worldCupDirectory]) {
    assert.match(source, /privacySettings: true/);
    assert.match(source, /riotId: publicRiotId\(profile\)/);
  }

  assert.match(detail, /toPublicPlayerProfileDto\(profile\)/);
  assert.match(detail, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(detail, /unstable_cache|revalidate\s*=/);
});
