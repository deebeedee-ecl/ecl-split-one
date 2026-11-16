import type { LzyumiPlayerDetail } from "@/lib/lzyumi";
import {
  normalizeRiotTag,
  riotIdKey,
  riotNameKey,
  splitRiotId,
} from "@/lib/riot-id";

export type ExpectedInhouseIdentity = {
  riotName: string | null;
  riotTag: string | null;
  chinaServerId: number | null;
  openId: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function detailAreaId(player: LzyumiPlayerDetail) {
  const areaId = Number(player.translateAreaId ?? player.areaId ?? player.area);
  return Number.isFinite(areaId) && areaId > 0 ? areaId : null;
}

function detailRiotKeys(player: LzyumiPlayerDetail) {
  return [player.nickNameStr, player.nickName]
    .map(splitRiotId)
    .map((parts) => riotIdKey(parts.riotName, parts.riotTag))
    .filter((value): value is string => Boolean(value));
}

function detailRiotNameKeys(player: LzyumiPlayerDetail) {
  return [player.nickNameStr, player.nickName]
    .map(splitRiotId)
    .map((parts) => riotNameKey(parts.riotName))
    .filter((value): value is string => Boolean(value));
}

function uniqueMatch(
  players: LzyumiPlayerDetail[],
  predicate: (player: LzyumiPlayerDetail) => boolean,
) {
  const matches = players.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

export function findInhouseDetailPlayer(
  expected: ExpectedInhouseIdentity,
  detailPlayers: LzyumiPlayerDetail[],
) {
  const expectedOpenId = clean(expected.openId);
  if (expectedOpenId) {
    const expectedAreaId = Number(expected.chinaServerId);
    if (!Number.isFinite(expectedAreaId) || expectedAreaId <= 0) return null;

    // openId + China server is the durable provider identity. A Riot ID may
    // change after !ready, so a stale session snapshot must not hide a stable
    // provider match. Ambiguous duplicate identities still fail closed.
    return uniqueMatch(
      detailPlayers,
      (player) => clean(player.openIdNow) === expectedOpenId && detailAreaId(player) === expectedAreaId,
    );
  }

  const riotKey = riotIdKey(expected.riotName, expected.riotTag);
  if (riotKey) {
    return uniqueMatch(detailPlayers, (player) => detailRiotKeys(player).includes(riotKey));
  }

  if (normalizeRiotTag(expected.riotTag)) return null;

  const nameKey = riotNameKey(expected.riotName);
  if (!nameKey) return null;
  return uniqueMatch(detailPlayers, (player) => detailRiotNameKeys(player).includes(nameKey));
}
