import type { SignupProfilePayload } from "@/components/account/client-account";

export const CAPACITY = 30;

// Uses the same field names as an existing ECL profile. No account API is called.
export const demoProfile: Pick<SignupProfilePayload, "displayName" | "riotName" | "riotTag" | "primaryRole"> = {
  displayName: "Your Player",
  riotName: "YourPlayer",
  riotTag: "ECL",
  primaryRole: "Mid",
};

export const demoPlayer = {
  id: "demo-player",
  name: demoProfile.displayName,
  riotId: `${demoProfile.riotName}#${demoProfile.riotTag}`,
  role: demoProfile.primaryRole,
  champion: 103,
};

export const mockPlayers = [
  { name: "Moonriver", role: "Mid", champion: 103 },
  { name: "LastLight", role: "Top", champion: 266 },
  { name: "Nightswim", role: "Jungle", champion: 64 },
  { name: "DoubleTake", role: "Bot", champion: 145 },
  { name: "PaperPlanes", role: "Support", champion: 412 },
  { name: "BlueHour", role: "Mid", champion: 61 },
  { name: "SideQuest", role: "Top", champion: 24 },
  { name: "Daybreak", role: "Bot", champion: 222 },
  { name: "Afterglow", role: "Support", champion: 89 },
  { name: "GoodCompany", role: "Jungle", champion: 59 },
  { name: "NeonTiger", role: "Mid", champion: 7 },
  { name: "CloudNine", role: "Bot", champion: 81 },
  { name: "Northstar", role: "Top", champion: 164 },
  { name: "SoftReset", role: "Jungle", champion: 104 },
  { name: "Daydream", role: "Support", champion: 43 },
  { name: "SlowBurn", role: "Top", champion: 875 },
  { name: "FirstLight", role: "Bot", champion: 202 },
  { name: "Overtime", role: "Mid", champion: 134 },
  { name: "Crossfade", role: "Jungle", champion: 234 },
  { name: "HighTide", role: "Support", champion: 267 },
  { name: "WildCard", role: "Mid", champion: 4 },
  { name: "Eastbound", role: "Top", champion: 150 },
  { name: "Backbeat", role: "Bot", champion: 51 },
  { name: "Nightshift", role: "Jungle", champion: 107 },
  { name: "HalfTime", role: "Support", champion: 497 },
  { name: "LongWeekend", role: "Top", champion: 86 },
  { name: "NoRush", role: "Mid", champion: 142 },
  { name: "EchoPark", role: "Bot", champion: 498 },
  { name: "OpenWater", role: "Jungle", champion: 203 },
  { name: "TrueNorth", role: "Support", champion: 201 },
].map((player, index) => ({ ...player, id: `mock-${index + 1}` }));

export type RegistrationPlayer = (typeof mockPlayers)[number];
