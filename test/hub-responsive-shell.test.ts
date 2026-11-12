import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("Hub shell reflows its navigation and page header before the desktop breakpoint", async () => {
  const [shell, logout] = await Promise.all([
    source("app/(hub)/hub/_components/HubShell.tsx"),
    source("app/(hub)/hub/_components/HubLogoutButton.tsx"),
  ]);

  assert.match(shell, /aria-label="Hub navigation"/);
  assert.match(shell, /overflow-x-auto[\s\S]*lg:flex-col/);
  assert.match(shell, /flex-col[\s\S]*lg:flex-row/);
  assert.match(shell, /text-3xl[\s\S]*lg:text-5xl/);
  assert.match(shell, /hidden w-64[\s\S]*lg:block/);
  assert.match(shell, /focus-visible:outline-2/);
  assert.match(logout, /hidden w-64[\s\S]*lg:block/);
  assert.match(logout, /focus-visible:outline-2/);
});

test("confirmed wide Inhouses content is responsive or contained by a keyboard scroller", async () => {
  const inhouses = await source("app/(hub)/hub/inhouses/InhouseMatchHistoryClient.tsx");

  assert.match(inhouses, /aria-label="Full inhouse match archive"/);
  assert.match(inhouses, /tabIndex=\{0\}/);
  assert.match(inhouses, /overflow-x-auto[\s\S]*min-w-\[58rem\]/);
  assert.match(inhouses, /grid-cols-\[minmax\(0,1fr\)_5rem_minmax\(0,1fr\)\]/);
  assert.match(inhouses, /md:grid-cols-\[minmax\(7rem,1fr\)/);
});

test("profile and settings cards allow narrow content to shrink and wrap", async () => {
  const [settings, profile] = await Promise.all([
    source("components/account/AccountDashboard.tsx"),
    source("components/account/PlayerProfileView.tsx"),
  ]);

  assert.match(settings, /flex min-w-0 flex-col items-start/);
  assert.match(settings, /min-w-0 w-full max-w-full text-xs/);
  assert.match(profile, /break-words text-3xl/);
  assert.match(profile, /flex flex-col items-start gap-3 sm:flex-row/);
});
