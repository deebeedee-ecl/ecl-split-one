const invisibleControlPattern = /[\p{Cc}\p{Cf}]/gu;
const riotKeySpacingPattern = /[\s\p{Zs}\u1160\uFFA0]+/gu;

export function normalizeRiotPart(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(invisibleControlPattern, "")
    .trim();
}

export function normalizeRiotTag(value: string | null | undefined) {
  return normalizeRiotPart(value).replace(/^#+/, "").trim();
}

export function riotIdKey(
  riotName: string | null | undefined,
  riotTag: string | null | undefined,
) {
  const name = riotNameKey(riotName);
  const tag = normalizeRiotTag(riotTag)
    .replace(riotKeySpacingPattern, "")
    .toLocaleLowerCase();

  return name && tag ? `${name}#${tag}` : null;
}

export function riotNameKey(riotName: string | null | undefined) {
  return normalizeRiotPart(riotName)
    .replace(riotKeySpacingPattern, "")
    .toLocaleLowerCase();
}

export function formatRiotId(
  riotName: string | null | undefined,
  riotTag: string | null | undefined,
) {
  const name = normalizeRiotPart(riotName);
  const tag = normalizeRiotTag(riotTag);

  if (!name) return null;
  return tag ? `${name}#${tag}` : name;
}

export function splitRiotId(value: string | null | undefined) {
  const normalized = normalizeRiotPart(value);
  const hashIndex = normalized.lastIndexOf("#");

  if (hashIndex === -1) {
    return { riotName: normalized, riotTag: "" };
  }

  return {
    riotName: normalizeRiotPart(normalized.slice(0, hashIndex)),
    riotTag: normalizeRiotTag(normalized.slice(hashIndex + 1)),
  };
}
