import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export class DesktopReportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type DesktopIdentity = { puuid: string; name: string; tag: string };
export type DesktopOwner = { id: string; userId: string; kookId: string | null; riotName: string; riotTag: string; chinaServerId: number | null; verificationStatus: string; accountStatus: string };
export type DesktopRosterPlayer = { profileId: string | null; kookUserId: string; riotName: string | null; riotTag: string | null; side: string };
export type DesktopRoster = { createdAt: Date; players: DesktopRosterPlayer[] };
const normalize = (v: string) => v.trim().normalize("NFKC").toLowerCase();
export const desktopEnabled = () => process.env.ECL_DESKTOP_REPORTING_ENABLED === "1";
export function eligible(owner: DesktopOwner) {
  if (owner.verificationStatus !== "VERIFIED" || owner.accountStatus !== "ACTIVE" || !owner.kookId) throw new DesktopReportError("A verified, active ECL account linked to KOOK is required.", 403);
  if (owner.chinaServerId !== 1) throw new DesktopReportError("Desktop reporting pilot currently supports Ionia only.", 403);
  if (desktopEnabled() && !(process.env.ECL_DESKTOP_REPORTER_PROFILE_IDS || "").split(",").map(id => id.trim()).filter(Boolean).includes(owner.id)) throw new DesktopReportError("Your profile is not enabled for the desktop reporting pilot.", 403);
}
export function identity(value: unknown): DesktopIdentity {
  const v = value as Partial<DesktopIdentity> | null;
  if (!v || [v.puuid, v.name, v.tag].some(x => typeof x !== "string" || !x.trim() || x.length > 160)) throw new DesktopReportError("League has not provided a complete player identity.");
  return { puuid: v.puuid!.trim(), name: v.name!.trim(), tag: v.tag!.trim() };
}
function secret() {
  const key = process.env.ECL_DESKTOP_LINK_SECRET;
  if (!key || key.length < 32) throw new DesktopReportError("Desktop reporting is not configured on the server.", 503);
  return key;
}
const signature = (data: string) => createHmac("sha256", secret()).update(data).digest();
export function link(owner: DesktopOwner, value: unknown, now = Date.now()) {
  eligible(owner); const local = identity(value);
  if (normalize(local.name) !== normalize(owner.riotName) || normalize(local.tag) !== normalize(owner.riotTag)) throw new DesktopReportError("The running League account does not match your verified ECL profile.", 403);
  // This binds a consented pilot session, not attested ownership of the League PUUID.
  // Uploaded records always require separate administrator review; never award points here.
  const expiresAt = now + 10 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ owner: owner.id, user: owner.userId, kook: owner.kookId, local, expiresAt, nonce: randomUUID() })).toString("base64url");
  return { capability: `${payload}.${signature(payload).toString("base64url")}`, expiresAt };
}
export function verifyLink(owner: DesktopOwner, token: unknown, now = Date.now()) {
  eligible(owner);
  if (typeof token !== "string" || token.length > 3000) throw new DesktopReportError("Reconnect KOOK reporting in ECL Hub.", 401);
  try {
    const [payload, sig, extra] = token.split(".");
    const bytes = Buffer.from(sig || "", "base64url"), expected = signature(payload || "");
    if (extra || bytes.length !== expected.length || !timingSafeEqual(bytes, expected)) throw new Error();
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.owner !== owner.id || data.user !== owner.userId || data.kook !== owner.kookId || !Number.isFinite(data.expiresAt) || data.expiresAt <= now || data.expiresAt > now + 10 * 60 * 1000) throw new Error();
    const local = identity(data.local);
    if (normalize(local.name) !== normalize(owner.riotName) || normalize(local.tag) !== normalize(owner.riotTag)) throw new Error();
    return local;
  } catch (error) {
    if (error instanceof DesktopReportError && error.status === 503) throw error;
    throw new DesktopReportError("Reporting authorization expired or changed. Reconnect ECL Hub.", 401);
  }
}
export function requestData(raw: unknown, owner: DesktopOwner, now = Date.now()) {
  const data = raw as { source?: string; gameId?: string; ownerProfileId?: string; expiresAt?: number } | null;
  if (!data || data.source !== "desktop-request-v1" || data.ownerProfileId !== owner.id || !/^\d{5,20}$/.test(data.gameId || "") || !Number.isFinite(data.expiresAt) || data.expiresAt! <= now) throw new DesktopReportError("This report request has expired or belongs to another player.", 409);
  return { gameId: data.gameId!, expiresAt: data.expiresAt! };
}
type Participant = { participantId: number; teamId: number; championId: number; stats: Record<string, unknown> };
type PlayerIdentity = { participantId: number; player: { puuid: string; gameName: string; tagLine: string } };
export function validateDesktopMatch(raw: unknown, expectedId: string, local: DesktopIdentity, session: DesktopRoster, now = Date.now()) {
  if (!raw || typeof raw !== "object") throw new DesktopReportError("Missing match record.");
  const g = raw as Record<string, unknown>;
  const players = g.participants as Participant[], identities = g.participantIdentities as PlayerIdentity[], teams = g.teams as { teamId: number; win: unknown }[];
  if (String(g.gameId) !== expectedId || g.platformId !== "HN1" || g.gameType !== "CUSTOM_GAME" || g.gameMode !== "CLASSIC" || g.mapId !== 11 || g.endOfGameResult !== "GameComplete") throw new DesktopReportError("Expected a completed Ionia custom Summoner's Rift match with the requested Game ID.");
  const started = Number(g.gameCreation), duration = Number(g.gameDuration);
  if (!Number.isFinite(started) || !Number.isFinite(duration) || duration <= 0 || duration > 6 * 3600 || started < session.createdAt.getTime() - 10 * 60000 || started > session.createdAt.getTime() + 6 * 3600000 || started + duration * 1000 > now + 60000) throw new DesktopReportError("The match time does not fit this ready session.");
  if (!Array.isArray(players) || !Array.isArray(identities) || !Array.isArray(teams) || players.length !== 10 || identities.length !== 10 || teams.length !== 2 || session.players.length !== 10) throw new DesktopReportError("Exactly ten players and two teams are required.");
  if (players.some(p => !p || !Number.isInteger(p.participantId) || !Number.isInteger(p.championId) || p.championId <= 0) || new Set(players.map(p => p.participantId)).size !== 10 || identities.some(i => !i?.player || typeof i.player.puuid !== "string" || !i.player.puuid.trim()) || new Set(identities.map(i => i.participantId)).size !== 10 || new Set(identities.map(i => i.player.puuid)).size !== 10) throw new DesktopReportError("Player identities are missing or duplicated.");
  if (![100, 200].every(id => teams.filter(t => t?.teamId === id).length === 1 && players.filter(p => p.teamId === id).length === 5) || teams.some(t => ![true, false, "Win", "Fail"].includes(t.win as string | boolean)) || teams.filter(t => t.win === true || t.win === "Win").length !== 1) throw new DesktopReportError("Expected two teams of five and one winner.");
  const key = (name: string, tag: string) => `${normalize(name)}#${normalize(tag)}`;
  const ready = new Map(session.players.map(p => [key(p.riotName || "", p.riotTag || ""), p]));
  if (ready.size !== 10 || session.players.some(p => !p.profileId || !p.riotName || !p.riotTag || !["BLUE", "RED"].includes(p.side))) throw new DesktopReportError("The ready roster is incomplete or ambiguous.");
  let reporter = false;
  for (const p of players) {
    const i = identities.find(row => row.participantId === p.participantId)?.player;
    if (!i || typeof i.gameName !== "string" || typeof i.tagLine !== "string") throw new DesktopReportError("A match identity is incomplete.");
    const r = ready.get(key(i.gameName, i.tagLine));
    if (!r || p.teamId !== (r.side === "BLUE" ? 100 : 200)) throw new DesktopReportError("The match does not match all ten ready players and their assigned sides.");
    ready.delete(key(i.gameName, i.tagLine));
    if (i.puuid === local.puuid && key(i.gameName, i.tagLine) === key(local.name, local.tag)) reporter = true;
    for (const stat of ["kills", "deaths", "assists", "totalDamageDealtToChampions", "goldEarned", "visionScore"]) if (!p.stats || typeof p.stats[stat] !== "number" || !Number.isFinite(p.stats[stat]) || (p.stats[stat] as number) < 0) throw new DesktopReportError("The match statistics are incomplete.");
  }
  if (!reporter || ready.size) throw new DesktopReportError("The reporter must participate in the complete ready roster.");
  return { gameId: expectedId, winner: teams.find(t => t.win === true || t.win === "Win")!.teamId, players: 10, duration, started };
}
