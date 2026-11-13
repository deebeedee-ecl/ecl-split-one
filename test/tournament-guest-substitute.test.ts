import assert from "node:assert/strict";
import test from "node:test";
import { guestParticipantId, parseReport, storedProviderId } from "../lib/tournaments/match-policy";

function report() {
  return {
    fixtureId: "fixture-1",
    gameNumber: 1,
    platform: "HN1",
    leagueGameId: null,
    providerId: "opaque-provider-id",
    source: "JSON",
    payload: {
      winnerTeamId: "home",
      durationSeconds: 1800,
      playedAt: "2026-11-13T20:57:09+08:00",
      note: "Verified Lzyumi recovery.",
      players: Array.from({ length: 10 }, (_, index) => index === 4 ? {
        guestSubstitute: { riotId: "EEA#85175", displayName: "EEA" },
        teamId: "home",
        kills: 3,
        deaths: 5,
        assists: 9,
        mvp: false,
      } : {
        profileId: `profile-${index}`,
        teamId: index < 5 ? "home" : "away",
        kills: 1,
        deaths: 1,
        assists: 1,
        mvp: false,
      }),
    },
  };
}

test("manual JSON reports accept a stable guest substitute with a provider identity", () => {
  const parsed = parseReport(report());
  const guest = parsed.payload.players[4];
  assert.equal(parsed.leagueGameId, null);
  assert.equal(parsed.providerId, "opaque-provider-id");
  assert.equal(guest.profileId, guestParticipantId("HN1", "EEA#85175"));
  assert.equal(guest.riotId, "EEA#85175");
  assert.equal(guest.name, "EEA");
  assert.equal(guest.substitute, true);
  assert.equal(guest.guestSubstitute, true);
  assert.equal(parsed.payload.players[0].substitute, false);
});

test("a normalized guest report can be parsed again during admin review", () => {
  const first = parseReport(report());
  const reviewed = parseReport(first);
  assert.deepEqual(reviewed.payload.players[4], first.payload.players[4]);
});

test("guest participant keys normalize Riot ID case and spacing", () => {
  assert.equal(
    guestParticipantId("HN1", "Player Name#12345"),
    guestParticipantId("HN1", "playername#12345"),
  );
});

test("reports require an external game identity and Hub uploads reject guests", () => {
  const missing = report();
  missing.providerId = "";
  assert.throws(() => parseReport(missing), /League Game ID or verified Lzyumi provider ID/);

  const hub = report();
  hub.source = "HUB";
  assert.throws(() => parseReport(hub), /cannot introduce guest substitutes/);
});

test("stored provider identity is accepted only from the private Lzyumi envelope", () => {
  assert.equal(storedProviderId({ provider: "LZYUMI", providerGameId: "opaque-provider-id" }), "opaque-provider-id");
  assert.equal(storedProviderId({ provider: "OTHER", providerGameId: "opaque-provider-id" }), null);
  assert.equal(storedProviderId({ provider: "LZYUMI", providerGameId: "bad id" }), null);
});
