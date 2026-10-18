export function desktopUpdateTarget(file: string, base: string | undefined) {
  if (!base || !/^(latest\.yml|ECL-Hub-Release-\d+\.\d+\.\d+\.json|ECL-Hub-Setup-\d+\.\d+\.\d+\.exe(?:\.blockmap)?)$/.test(file)) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) return null;
    return new URL(file, url).href;
  } catch { return null; }
}
