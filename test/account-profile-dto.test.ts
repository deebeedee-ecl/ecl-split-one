import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  accountPlayerProfileSelect,
  accountSettingsProfileSelect,
  toPlayerProfileDto,
  toSettingsProfileDto,
} from "../lib/account-profile-dto";
import { LZYUMI_SNAPSHOT_VERSION } from "../lib/lzyumi-snapshot";

const fetchedAt = "2026-11-12T00:00:00.000Z";

test("profile DTO keeps only rendered snapshot fields and excludes provider identity evidence", () => {
  const source = {
    id: "synthetic-profile",
    displayName: "Synthetic Player",
    riotName: "Synthetic",
    riotTag: "1234",
    chinaServerId: 1,
    chinaServerName: "Ionia",
    primaryRole: "MID",
    secondaryRole: "SUP",
    currentRank: "Gold I",
    nationality: "CN",
    timezone: "Asia/Shanghai",
    bio: "Test profile",
    avatarStyle: "crest",
    avatarUrl: "",
    bannerUrl: "",
    dashboardTheme: "crimson",
    championPool: { main: ["1"], learning: ["2"], ignored: "private" },
    privacySettings: { showWechat: false, showEmail: false, showRiotId: true },
    verificationStatus: "VERIFIED",
    accountStatus: "ACTIVE",
    lzyumiLastLookupAt: new Date(fetchedAt),
    lzyumiRawProfile: {
      _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
      _eclFetchedAt: fetchedAt,
      battleInfo: {
        openId: "must-not-leave-server",
        mapOneInfoList: [{ type: "Solo", tier: "Gold I", winPoint: 32, secret: "drop" }],
      },
      data: [{ championId: 1, isWin: 1, providerInternal: "drop" }],
      rawProviderEnvelope: "drop",
    },
    lzyumiRecentStat: {
      _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
      _eclFetchedAt: fetchedAt,
      data: { recentState: { kda: 4.2, common_use_champions: [{ key: 1, value: 3 }] } },
      privateRecentPayload: "drop",
    },
    lzyumiRankedGames: {
      _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
      _eclFetchedAt: fetchedAt,
      soloGames: [{ championId: 1, isWin: 1, providerInternal: "drop" }],
      flexGames: [],
    },
    kookVerifications: [{ code: "ECL-SYNTHETIC", status: "PENDING", expiresAt: fetchedAt }],
    openId: "must-not-leave-server",
    email: "private@example.invalid",
  };

  const dto = toPlayerProfileDto(source);
  const serialized = JSON.stringify(dto);

  assert.equal(dto.currentRank, "Gold I");
  assert.equal(dto.lzyumiLastLookupAt, fetchedAt);
  assert.doesNotMatch(serialized, /must-not-leave-server|private@example|rawProviderEnvelope|providerInternal|privateRecentPayload|secret/);
  assert.deepEqual(JSON.parse(JSON.stringify(dto.lzyumiRawProfile)), {
    _eclSnapshotVersion: LZYUMI_SNAPSHOT_VERSION,
    _eclFetchedAt: fetchedAt,
    data: [{ championId: 1, isWin: 1 }],
    battleInfo: {
      mapOneInfoList: [{ type: "Solo", tier: "Gold I", winPoint: 32 }],
    },
  });
});

test("settings DTO and database projection exclude raw provider snapshots and openId", () => {
  assert.equal("openId" in accountSettingsProfileSelect, false);
  assert.equal("lzyumiRawProfile" in accountSettingsProfileSelect, false);
  assert.equal("lzyumiRecentStat" in accountSettingsProfileSelect, false);
  assert.equal("lzyumiRankedGames" in accountSettingsProfileSelect, false);
  assert.equal("openId" in accountPlayerProfileSelect, false);

  const source = {
    id: "synthetic-profile",
    displayName: "Synthetic Player",
    riotName: "Synthetic",
    riotTag: "1234",
    chinaServerId: 1,
    chinaServerName: "Ionia",
    kookUsername: "synthetic",
    kookId: "synthetic-kook-id",
    wechatId: "synthetic-wechat",
    primaryRole: "MID",
    secondaryRole: "SUP",
    nationality: "CN",
    timezone: "Asia/Shanghai",
    bio: "Test profile",
    avatarStyle: "crest",
    avatarUrl: "",
    bannerUrl: "",
    dashboardTheme: "crimson",
    championPool: { main: ["1"], learning: [] },
    privacySettings: { showWechat: false, showEmail: false, showRiotId: true },
    verificationStatus: "VERIFIED",
    accountStatus: "ACTIVE",
    kookVerifications: [],
    openId: "must-not-leave-server",
    lzyumiRawProfile: { private: true },
  };

  const serialized = JSON.stringify(toSettingsProfileDto(source));
  assert.doesNotMatch(serialized, /must-not-leave-server|lzyumi|private/);
});

test("profile radar starts ResponsiveContainer with valid dimensions", async () => {
  const source = await readFile("components/account/PlayerProfileView.tsx", "utf8");
  assert.match(source, /initialDimension=\{\{ width: 320, height: 224 \}\}/);
  assert.match(source, /minWidth=\{1\}/);
  assert.match(source, /minHeight=\{224\}/);
});

test("narrow profile views still reject unauthenticated requests before database access", async () => {
  const { GET } = await import("../app/api/account/profile/route");
  const response = await GET(
    new Request("http://localhost/api/account/profile?view=profile"),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Not authenticated" });
});
