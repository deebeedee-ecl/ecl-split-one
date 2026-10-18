import test from "node:test";
import assert from "node:assert/strict";
import { desktopUpdateTarget } from "../lib/desktop-update-host";
import { GET } from "../app/desktop-updates/windows/[file]/route";

test("updater redirects only known release files to the configured public Blob prefix", async () => {
  const base = "https://wjeuparxlihzvwlv.public.blob.vercel-storage.com/ecl/windows/";
  for (const name of ["latest.yml", "ECL-Hub-Setup-0.9.2.exe", "ECL-Hub-Setup-0.9.2.exe.blockmap", "ECL-Hub-Release-0.9.2.json"]) assert.equal(desktopUpdateTarget(name, base), base + name);
  for (const name of ["../latest.yml", "other.exe", "latest.yml?secret=1", "https://evil.example/x.exe"]) assert.equal(desktopUpdateTarget(name, base), null);
  for (const url of [undefined, "http://evil.example/", "https://user:secret@example.public.blob.vercel-storage.com/", base + "?token=secret"]) assert.equal(desktopUpdateTarget("latest.yml", url), null);
  const saved = process.env.ECL_DESKTOP_UPDATE_BLOB_BASE;
  try {
    delete process.env.ECL_DESKTOP_UPDATE_BLOB_BASE;
    assert.equal((await GET(new Request("https://eclchina.lol/desktop-updates/windows/latest.yml"), { params: Promise.resolve({ file: "latest.yml" }) })).status, 404);
    process.env.ECL_DESKTOP_UPDATE_BLOB_BASE = base;
    const response = await GET(new Request("https://eclchina.lol/desktop-updates/windows/latest.yml"), { params: Promise.resolve({ file: "latest.yml" }) });
    assert.equal(response.status, 307); assert.equal(response.headers.get("location"), base + "latest.yml"); assert.equal(response.headers.get("cache-control"), "no-store");
  } finally { if (saved === undefined) delete process.env.ECL_DESKTOP_UPDATE_BLOB_BASE; else process.env.ECL_DESKTOP_UPDATE_BLOB_BASE = saved; }
});
