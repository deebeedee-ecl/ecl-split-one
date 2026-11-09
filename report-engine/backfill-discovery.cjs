"use strict";

const INVISIBLE_CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/gu;
const RIOT_KEY_SPACING_PATTERN = /[\s\p{Zs}\u1160\uFFA0]+/gu;
const LZYUMI_INHOUSE_LABEL = "\u65b0\u6a21\u5f0f";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value) {
  return clean(value).normalize("NFKC").replace(INVISIBLE_CONTROL_PATTERN, "").toLowerCase();
}

function splitRiotId(value) {
  const raw = clean(value);
  const index = raw.lastIndexOf("#");
  if (index < 0) return { riotName: raw, riotTag: "" };
  return {
    riotName: raw.slice(0, index).trim(),
    riotTag: raw.slice(index + 1).trim(),
  };
}

function riotNameKey(value) {
  return normalize(value).replace(RIOT_KEY_SPACING_PATTERN, "");
}

function riotIdKey(name, tag) {
  const normalizedName = riotNameKey(name);
  const normalizedTag = normalize(tag).replace(/^#+/, "").replace(RIOT_KEY_SPACING_PATTERN, "");
  return normalizedName && normalizedTag ? `${normalizedName}#${normalizedTag}` : "";
}

function normalizeDiscoveryPlayers(input) {
  const rows = Array.isArray(input) ? input : input?.players;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TypeError("The discovery player file must contain a non-empty array or a { players: [] } object.");
  }

  const seen = new Set();
  const players = [];
  for (const row of rows) {
    const source = typeof row === "string" ? { riotId: row } : row;
    if (!source || typeof source !== "object") continue;
    const parsed = splitRiotId(source.riotId || "");
    const riotName = clean(source.riotName) || parsed.riotName;
    const riotTag = clean(source.riotTag).replace(/^#+/, "") || parsed.riotTag;
    const key = riotIdKey(riotName, riotTag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    players.push({
      displayName: clean(source.displayName) || `${riotName}#${riotTag}`,
      riotName,
      riotTag,
      openId: clean(source.openId),
      chinaServerId: Number(source.chinaServerId || source.areaId || 1) || 1,
    });
  }

  if (players.length === 0) {
    throw new TypeError("No valid full Riot IDs (Name#Tag) were found in the discovery player file.");
  }
  return players;
}

function parseLzyumiGameTime(game, referenceDate) {
  const raw = `${game?.titleTime || ""} ${game?.title || ""}`;
  const match = raw.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const referenceChina = new Date(reference.getTime() + 8 * 60 * 60 * 1000);
  const candidate = new Date(Date.UTC(
    referenceChina.getUTCFullYear(),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[3]) - 8,
    Number(match[4]),
    Number(match[5] || 0),
  ));
  if (!Number.isFinite(candidate.getTime())) return null;

  if (candidate.getTime() - reference.getTime() > 180 * 24 * 60 * 60 * 1000) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() - 1);
  }
  return candidate;
}

function detailPlayerKeys(player) {
  return [player?.nickNameStr, player?.nickName]
    .map(splitRiotId)
    .map((parts) => riotIdKey(parts.riotName, parts.riotTag))
    .filter(Boolean);
}

function matchKnownPlayers(knownPlayers, detail) {
  const detailPlayers = Array.isArray(detail?.data?.wgBattleDetailInfo)
    ? detail.data.wgBattleDetailInfo
    : [];
  const detailKeys = new Set(detailPlayers.flatMap(detailPlayerKeys));
  const matched = knownPlayers.filter((player) => detailKeys.has(riotIdKey(player.riotName, player.riotTag)));
  return {
    count: matched.length,
    matched: matched.map((player) => player.displayName),
    participants: detailPlayers.map((player) => clean(player.nickNameStr || player.nickName)).filter(Boolean),
  };
}

function fieldValues(record, names) {
  if (!record || typeof record !== "object") return [];
  return names.map((name) => record[name]).filter((value) => value !== undefined && value !== null);
}

function customGameEvidence(game, detail) {
  const data = detail?.data || {};
  const typeValues = fieldValues(data, ["gameType", "game_type", "queueType", "queue_type"])
    .map((value) => String(value));
  const modeValues = fieldValues(data, ["gameMode", "game_mode"])
    .map((value) => String(value));
  const mapValues = fieldValues(data, ["mapId", "map_id", "mapIdNow"])
    .map((value) => String(value));
  const completionValues = fieldValues(data, ["endOfGameResult", "end_of_game_result"])
    .map((value) => String(value));
  const title = clean(game?.title);

  const explicitCustom = typeValues.some((value) => normalize(value).includes("custom"));
  const explicitNonCustom = typeValues.length > 0 && !explicitCustom;
  const lzyumiLabel = title.includes(LZYUMI_INHOUSE_LABEL);
  return {
    explicitCustom,
    explicitNonCustom,
    lzyumiLabel,
    // Trust the structured game type when Lzyumi exposes it. The localized
    // title label is only a fallback for older/incomplete history responses.
    isCustomCandidate: explicitCustom || (!explicitNonCustom && lzyumiLabel),
    gameType: typeValues.join(" | ") || null,
    gameMode: modeValues.join(" | ") || null,
    mapId: mapValues.join(" | ") || null,
    endOfGameResult: completionValues.join(" | ") || null,
  };
}

function gameDurationSeconds(game) {
  const title = clean(game?.title);
  const match = title.match(/\u7528\u65f6(\d+)\u5206(?:(\d+)\u79d2)?/u);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2] || 0);
}

function findExcludedGame(game, gameTime, excludedGames = []) {
  const gameId = clean(game?.gameId);
  const durationSeconds = gameDurationSeconds(game);

  return excludedGames.find((excluded) => {
    if (!excluded || typeof excluded !== "object") return false;
    if (clean(excluded.providerGameId) && clean(excluded.providerGameId) === gameId) return true;

    const playedAt = new Date(excluded.playedAt);
    if (!gameTime || !Number.isFinite(playedAt.getTime())) return false;
    const sameTime = Math.abs(gameTime.getTime() - playedAt.getTime()) <= 2_000;
    const expectedDuration = Number(excluded.durationSeconds);
    const sameDuration = Number.isFinite(expectedDuration) && durationSeconds === expectedDuration;
    return sameTime && sameDuration;
  }) || null;
}

function classifyCandidate({
  game,
  detail,
  knownPlayers,
  since,
  until,
  knownGameIds = new Set(),
  excludedGames = [],
}) {
  const gameId = clean(game?.gameId);
  const gameTime = parseLzyumiGameTime(game, since);
  const roster = matchKnownPlayers(knownPlayers, detail);
  const evidence = customGameEvidence(game, detail);
  const inDateRange = Boolean(gameTime && gameTime >= since && gameTime <= until);
  const explicitlyKnown = knownGameIds.has(gameId);
  const excludedGame = findExcludedGame(game, gameTime, excludedGames);

  let reviewStatus = "EXCLUDE";
  const reasons = [];
  if (!gameTime) reasons.push("provider time could not be parsed");
  if (gameTime && !inDateRange) reasons.push("outside requested date range");
  if (!evidence.isCustomCandidate) reasons.push("custom-game marker not exposed by provider");
  if (roster.count < 8) reasons.push(`only ${roster.count}/10 participants are on the supplied ECL list`);

  if (excludedGame) {
    reviewStatus = "EXCLUDE_TOURNAMENT";
    reasons.push(excludedGame.reason || `${excludedGame.competition || "Tournament"} match`);
  } else if (inDateRange && roster.count >= 10 && evidence.isCustomCandidate) {
    reviewStatus = "HIGH_CONFIDENCE";
  } else if (inDateRange && (roster.count >= 8 || explicitlyKnown)) {
    reviewStatus = "REVIEW";
  }

  return {
    gameId,
    gameTime: gameTime?.toISOString() || null,
    title: clean(game?.title) || null,
    titleTime: clean(game?.titleTime) || null,
    knownGameId: explicitlyKnown,
    excludedCompetition: excludedGame?.competition || null,
    excludedMatchCode: excludedGame?.matchCode || null,
    reviewStatus,
    reasons,
    rosterMatchCount: roster.count,
    matchedPlayers: roster.matched,
    participants: roster.participants,
    ...evidence,
    raw: { game, detail },
  };
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function candidatesCsv(candidates) {
  const headings = [
    "gameId", "gameTime", "reviewStatus", "knownGameId", "rosterMatchCount",
    "gameType", "gameMode", "mapId", "endOfGameResult", "title", "participants", "reasons",
  ];
  const rows = candidates.map((candidate) => headings.map((heading) => csvCell(candidate[heading])).join(","));
  return `${headings.join(",")}\n${rows.join("\n")}\n`;
}

module.exports = {
  candidatesCsv,
  classifyCandidate,
  customGameEvidence,
  findExcludedGame,
  gameDurationSeconds,
  matchKnownPlayers,
  normalizeDiscoveryPlayers,
  parseLzyumiGameTime,
  riotIdKey,
  splitRiotId,
};

