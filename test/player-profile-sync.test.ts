import assert from "node:assert/strict";
import test from "node:test";
import { syncPlayerForProfile } from "../lib/player-profile-sync.ts";

type SyncDatabase = NonNullable<Parameters<typeof syncPlayerForProfile>[1]>;

test("profile sync skips a redundant player update", async () => {
  const existing = {
    id: "player-1",
    name: "Kasper",
    riotName: "Kasper",
    riotTag: "82130",
    email: "kasper@example.test",
    teamId: null,
    elo: 1220,
    winStreak: 0,
    lossStreak: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  let updateCalls = 0;
  const database = {
    player: {
      findFirst: async () => existing,
      update: async () => {
        updateCalls += 1;
        return existing;
      },
      create: async () => existing,
    },
  } as unknown as SyncDatabase;

  const result = await syncPlayerForProfile(
    {
      displayName: "Kasper",
      email: "kasper@example.test",
      riotName: "Kasper",
      riotTag: "#82130",
    },
    database,
  );

  assert.equal(result, existing);
  assert.equal(updateCalls, 0);
});

test("profile sync still updates changed identity fields", async () => {
  const existing = {
    id: "player-1",
    name: "Old name",
    riotName: "Kasper",
    riotTag: "82130",
    email: "kasper@example.test",
    teamId: null,
    elo: 1220,
    winStreak: 0,
    lossStreak: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  let updateData: unknown = null;
  const database = {
    player: {
      findFirst: async () => existing,
      update: async ({ data }: { data: unknown }) => {
        updateData = data;
        return { ...existing, ...(data as object) };
      },
      create: async () => existing,
    },
  } as unknown as SyncDatabase;

  await syncPlayerForProfile(
    {
      displayName: "Kasper",
      email: "kasper@example.test",
      riotName: "Kasper",
      riotTag: "82130",
    },
    database,
  );

  assert.deepEqual(updateData, {
    name: "Kasper",
    riotName: "Kasper",
    riotTag: "82130",
    email: "kasper@example.test",
  });
});
