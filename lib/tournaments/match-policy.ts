export class TournamentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Schedule = { state: "PROPOSED" | "CONFIRMED"; at: string; byTeam: string; revision: number; channelId?: string; actor: string };
export type MatchPlayer = { profileId: string; teamId: string; name: string; riotId: string; champion?: string; items?: number[]; damage?: number; gold?: number; position?: string; kills?: number; deaths?: number; assists?: number; mvp: boolean };
export type MatchPayload = { winnerTeamId: string; durationSeconds: number; playedAt: string; players: MatchPlayer[]; note: string; statsComplete: boolean };
export type ReportInput = { fixtureId: string; gameNumber: number; platform: string; leagueGameId: string | null; source: "MANUAL" | "JSON" | "HUB"; payload: MatchPayload; raw?: unknown; evidence?: { name: string; dataUrl: string }; replacesId?: string };
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TournamentError("Expected an object.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || value.length > max) throw new TournamentError(`Expected text of at most ${max} characters.`);
  return value.trim();
}
export function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new TournamentError(`Expected an integer between ${min} and ${max}.`);
  return value;
}
export function instant(value: unknown): string {
  const s = text(value, 40);
  const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.exec(s);
  if (!parts || !Number.isFinite(Date.parse(s)) || Number(parts[2])<1 || Number(parts[2])>12 || Number(parts[3])<1 || Number(parts[3])>new Date(Date.UTC(Number(parts[1]),Number(parts[2]),0)).getUTCDate() || Number(parts[4])>23 || Number(parts[5])>59) throw new TournamentError("Choose a valid date/time with an explicit time zone (China time is UTC+8).");
  return new Date(s).toISOString();
}
export function parseReport(value: unknown): ReportInput {
  const b = object(value), p = object(b.payload);
  if (!["MANUAL", "JSON", "HUB"].includes(String(b.source))) throw new TournamentError("Choose a report source.");
  if (!Array.isArray(p.players) || p.players.length !== 10) throw new TournamentError("Select all ten actual players, including any floaters.");
  const players = p.players.map(v => {
    const row = object(v);
    const stats = [row.kills, row.deaths, row.assists];
    if(row.items!==undefined&&(!Array.isArray(row.items)||row.items.length>7))throw new TournamentError('Items must contain at most seven item IDs.');
    if (stats.some(v => v !== undefined && v !== null) && !stats.every(v => typeof v === "number")) throw new TournamentError("Enter all three K/D/A values for a player, or leave all three blank.");
    return { profileId: text(row.profileId, 100), teamId: text(row.teamId, 150), name: "", riotId: "", mvp: row.mvp === true,
      ...(stats.every(v => typeof v === "number") ? { kills: integer(row.kills, 0, 200), deaths: integer(row.deaths, 0, 200), assists: integer(row.assists, 0, 300) } : {}),
      ...(row.champion ? { champion: text(row.champion, 80) } : {}),
      ...(Array.isArray(row.items)?{items:row.items.map(id=>integer(id,0,100000))}:{}),
      ...(row.damage!==undefined?{damage:integer(row.damage,0,10000000)}:{}),
      ...(row.gold!==undefined?{gold:integer(row.gold,0,10000000)}:{}),
      ...(row.position?{position:text(row.position,30)}:{}) };
  });
  if (new Set(players.map(p => p.profileId)).size !== 10) throw new TournamentError("A player cannot appear twice in one game.");
  if (players.filter(p => p.mvp).length > 1) throw new TournamentError("Choose at most one MVP.");
  const winnerTeamId = text(p.winnerTeamId, 150);
  if (players.some(p => p.mvp && p.teamId !== winnerTeamId)) throw new TournamentError("The MVP must be on the winning team.");
  const platform = text(b.platform ?? "HN1", 12).toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(platform)) throw new TournamentError("Invalid League platform.");
  const leagueGameId = b.leagueGameId ? text(b.leagueGameId, 20) : null;
  if (leagueGameId && !/^\d{5,20}$/.test(leagueGameId)) throw new TournamentError("Game ID must contain 5–20 digits.");
  let evidence: ReportInput["evidence"];
  if (b.evidence) {
    const e = object(b.evidence), dataUrl = text(e.dataUrl, 2_100_000);
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) throw new TournamentError("Evidence must be a PNG, JPEG or WebP screenshot under 1.5 MB.");
    evidence = { name: text(e.name, 100), dataUrl };
  }
  return { fixtureId: text(b.fixtureId, 150), gameNumber: integer(b.gameNumber ?? 1, 1, 5), platform, leagueGameId, source: b.source as ReportInput["source"],
    payload: { winnerTeamId, durationSeconds: integer(p.durationSeconds, 60, 14400), playedAt: instant(p.playedAt), players, note: text(p.note ?? "", 2000), statsComplete: players.every(p => p.kills !== undefined) },
    ...(b.raw !== undefined ? { raw: b.raw } : {}), ...(evidence ? { evidence } : {}), ...(b.replacesId ? { replacesId: text(b.replacesId, 100) } : {}) };
}

export function calculateTables(teams: { id: string; name: string }[], fixtures: { id: string; stage: string; bestOf: number; homeTeamId: string; awayTeamId: string }[], reports: { fixtureId: string; payload: unknown }[]) {
  const standings = teams.map(t => ({ ...t, played: 0, wins: 0, losses: 0, winTimeSeconds: 0, tied: false }));
  const stats = new Map<string, { profileId: string; name: string; teamId: string; games: number; statGames: number; kills: number; deaths: number; assists: number; mvps: number; kda: number | null }>();
  for (const report of reports) {
    const p = report.payload as MatchPayload;
    for (const row of p.players) {
      const v = stats.get(row.profileId) ?? { profileId: row.profileId, name: row.name, teamId: row.teamId, games: 0, statGames: 0, kills: 0, deaths: 0, assists: 0, mvps: 0, kda: null };
      if(v.teamId!==row.teamId)v.teamId='FLOATER';
      v.games++; if (row.mvp) v.mvps++;
      if (row.kills !== undefined && row.deaths !== undefined && row.assists !== undefined) { v.statGames++; v.kills += row.kills; v.deaths += row.deaths; v.assists += row.assists; }
      stats.set(row.profileId, v);
    }
  }
  for (const fixture of fixtures.filter(f => f.stage === "ROUND_ROBIN")) {
    const games = reports.filter(r => r.fixtureId === fixture.id).map(r => r.payload as MatchPayload);
    const needed = Math.ceil(fixture.bestOf / 2);
    const winner = [fixture.homeTeamId, fixture.awayTeamId].find(id => games.filter(g => g.winnerTeamId === id).length >= needed);
    if (!winner) continue;
    for (const team of standings.filter(t => [fixture.homeTeamId, fixture.awayTeamId].includes(t.id))) {
      team.played++; if (team.id === winner) { team.wins++; team.winTimeSeconds += games.filter(g => g.winnerTeamId === winner).reduce((n, g) => n + g.durationSeconds, 0); } else team.losses++;
    }
  }
  standings.sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  for (const row of standings) row.tied = standings.some(t => t.id !== row.id && t.wins === row.wins && row.played > 0 && t.played > 0);
  const players = [...stats.values()].map(v => ({ ...v, kda: v.statGames ? Math.round((v.kills + v.assists) / Math.max(1, v.deaths) * 100) / 100 : null }));
  return { standings, players, leaders: {
    kda: players.filter(p => p.statGames).sort((a, b) => (b.kda ?? 0) - (a.kda ?? 0) || b.statGames - a.statGames || a.name.localeCompare(b.name)).slice(0, 3),
    assists: players.filter(p => p.statGames).sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name)).slice(0, 3),
    mvps: players.filter(p => p.mvps).sort((a, b) => b.mvps - a.mvps || a.name.localeCompare(b.name)).slice(0, 3),
  } };
}
