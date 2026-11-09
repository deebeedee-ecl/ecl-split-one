import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath: string) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("Hub routes have a dedicated layout boundary without public chrome", async () => {
  const [rootLayout, publicLayout, hubLayout] = await Promise.all([
    read("app/layout.tsx"),
    read("app/(public)/layout.tsx"),
    read("app/(hub)/layout.tsx"),
  ]);

  assert.doesNotMatch(rootLayout, /<header|<footer|MobileNav/);
  assert.match(publicLayout, /<header/);
  assert.match(publicLayout, /<footer/);
  assert.match(publicLayout, /MobileNav/);
  assert.doesNotMatch(hubLayout, /<header|<footer|MobileNav|PublicLayout/);
});

test("the public Hub introduction stays outside the Hub application layout", async () => {
  await Promise.all([
    access(path.join(repositoryRoot, "app/(public)/hub/page.tsx")),
    access(path.join(repositoryRoot, "app/(hub)/hub/dashboard/page.tsx")),
  ]);
});
