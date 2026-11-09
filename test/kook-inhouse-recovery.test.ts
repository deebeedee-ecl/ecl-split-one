import assert from "node:assert/strict";
import test from "node:test";
import {
  activeInhouseCommandResult,
  buildInhouseMoveInstructions,
  syncInhouseProfilePlayers,
} from "../lib/kook-inhouse.ts";

test("saved inhouse teams produce retryable KOOK move instructions", () => {
  const instructions = buildInhouseMoveInstructions({
    blueChannelId: "blue-channel",
    redChannelId: "red-channel",
    players: [
      { kookUserId: "blue-player", side: "BLUE" },
      { kookUserId: "red-player", side: "RED" },
    ],
  });

  assert.deepEqual(instructions, [
    {
      kookUserId: "blue-player",
      targetChannelId: "blue-channel",
      side: "BLUE",
    },
    {
      kookUserId: "red-player",
      targetChannelId: "red-channel",
      side: "RED",
    },
  ]);
});

test("saved inhouse move recovery fails closed on an invalid side", () => {
  assert.throws(
    () =>
      buildInhouseMoveInstructions({
        blueChannelId: "blue-channel",
        redChannelId: "red-channel",
        players: [{ kookUserId: "unknown-player", side: "UNKNOWN" }],
      }),
    /Invalid persisted inhouse side/,
  );
});

test("duplicate ready recovers saved moves while duplicate inhouse stays read-only", () => {
  const session = {
    gameLabel: "IH #080",
    blueChannelId: "blue-channel",
    redChannelId: "red-channel",
    players: [
      { kookUserId: "blue-player", side: "BLUE" },
      { kookUserId: "red-player", side: "RED" },
    ],
  };

  const ready = activeInhouseCommandResult("ready", session);
  assert.equal(ready.status, "ASSIGNED_RECOVERY");
  assert.equal(ready.moveInstructions.length, 2);
  assert.match(ready.reply, /No duplicate session was created/);

  const inhouse = activeInhouseCommandResult("inhouse", session);
  assert.equal(inhouse.status, "ALREADY_ASSIGNED");
  assert.deepEqual(inhouse.moveInstructions, []);
});

test("inhouse profile synchronization uses bounded concurrency", async () => {
  let active = 0;
  let maximumActive = 0;
  const profiles = Array.from({ length: 10 }, (_, index) => ({ id: `profile-${index}` }));

  const players = await syncInhouseProfilePlayers(
    profiles,
    async (profile) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { id: `player-for-${profile.id}` };
    },
    2,
  );

  assert.equal(maximumActive, 2);
  assert.equal(players.size, 10);
  assert.equal(players.get("profile-7")?.id, "player-for-profile-7");
});
