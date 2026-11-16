import assert from "node:assert/strict";
import test from "node:test";
import { findInhouseDetailPlayer } from "@/lib/inhouse-roster-identity";
import type { LzyumiPlayerDetail } from "@/lib/lzyumi";

const detailPlayers: LzyumiPlayerDetail[] = [
  {
    nickNameStr: "Current Name#NEW",
    openIdNow: "stable-open-id",
    translateAreaId: 1,
  },
  {
    nickNameStr: "Fallback Player#TAG",
    openIdNow: "fallback-open-id",
    translateAreaId: 1,
  },
];

test("matches a renamed inhouse player by stable openId and China server", () => {
  const match = findInhouseDetailPlayer({
    riotName: "Stale Name",
    riotTag: "OLD",
    chinaServerId: 1,
    openId: "stable-open-id",
  }, detailPlayers);

  assert.equal(match, detailPlayers[0]);
});

test("fails closed for stable openId or server drift", () => {
  assert.equal(findInhouseDetailPlayer({
    riotName: "Current Name",
    riotTag: "NEW",
    chinaServerId: 1,
    openId: "different-open-id",
  }, detailPlayers), null);

  assert.equal(findInhouseDetailPlayer({
    riotName: "Current Name",
    riotTag: "NEW",
    chinaServerId: 14,
    openId: "stable-open-id",
  }, detailPlayers), null);
});

test("uses exact Riot ID only when no stable openId is stored", () => {
  assert.equal(findInhouseDetailPlayer({
    riotName: "Fallback Player",
    riotTag: "TAG",
    chinaServerId: 1,
    openId: null,
  }, detailPlayers), detailPlayers[1]);

  assert.equal(findInhouseDetailPlayer({
    riotName: "Fallback Player",
    riotTag: "WRONG",
    chinaServerId: 1,
    openId: null,
  }, detailPlayers), null);
});

test("rejects ambiguous bare-name and duplicate stable identity matches", () => {
  const ambiguous = [
    ...detailPlayers,
    { nickNameStr: "Fallback Player#OTHER", openIdNow: "other", translateAreaId: 1 },
  ];
  assert.equal(findInhouseDetailPlayer({
    riotName: "Fallback Player",
    riotTag: null,
    chinaServerId: 1,
    openId: null,
  }, ambiguous), null);

  assert.equal(findInhouseDetailPlayer({
    riotName: "Current Name",
    riotTag: "NEW",
    chinaServerId: 1,
    openId: "stable-open-id",
  }, [...detailPlayers, { ...detailPlayers[0] }]), null);
});
