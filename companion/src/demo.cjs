const { validate, summarize } = require('./core.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
function fixture(id = '11363615233') {
  const names = ['Blue One', 'Blue Two', 'Blue Three', 'Blue Four', 'Blue Five', 'Red One', 'Red Two', 'Red Three', 'Red Four', 'Red Five'];
  return { gameId: id, gameCreation: 1792200000000, gameDuration: 1834, queueId: 0, mapId: 11, gameMode: 'CLASSIC', gameType: 'CUSTOM_GAME', endOfGameResult: 'GameComplete',
    participantIdentities: names.map((name, i) => ({ participantId: i + 1, player: { gameName: name, tagLine: 'DEMO', puuid: `sample-player-${i}` } })),
    participants: names.map((_, i) => ({ participantId: i + 1, teamId: i < 5 ? 100 : 200, championId: [59, 246, 7, 110, 412, 31, 107, 103, 222, 89][i], stats: { kills: [3, 10, 8, 9, 1, 2, 4, 5, 6, 0][i], deaths: i % 4 + 2, assists: 12 - i, totalDamageDealtToChampions: 12000 + i * 1234, goldEarned: 11000 + i * 333, totalMinionsKilled: 120 + i * 10, neutralMinionsKilled: 0, visionScore: 15 + i * 4 } })),
    teams: [{ teamId: 100, win: 'Win', towerKills: 9, dragonKills: 3, baronKills: 1 }, { teamId: 200, win: 'Fail', towerKills: 3, dragonKills: 1, baronKills: 0 }],
  };
}
async function seed(collector) {
  const raw = fixture(); const validation = validate(raw);
  const key = 'demo-match'; const file = 'demo-match.json'; const collectedAt = Date.now();
  await fs.writeFile(path.join(collector.directory, 'matches', file), JSON.stringify({ gameId: raw.gameId, raw, validation, players: summarize(raw), collectedAt }));
  collector.db = { version: 1, autoCollect: false, jobs: [], matches: [{ key, file, gameId: raw.gameId, collectedAt, queueId: 0, gameType: raw.gameType, duration: raw.gameDuration, validation }] };
  collector.status = { connected: false, player: { name: 'Sample player', tag: 'DEMO', level: 100 }, phase: 'Demo', busy: false, message: 'Sample data only. No League connection or uploads.', lastChecked: Date.now() };
}
function seedAccount(account) {
  const games = Array.from({ length: 17 }, (_, i) => ({ id: `sample-${i}`, label: `Inhouse ${17 - i}`, date: new Date(Date.now() - i * 86400000).toISOString(), isWin: i % 3 !== 1, kills: [10, 4, 8, 3][i % 4], deaths: [3, 7, 2, 5][i % 4], assists: [9, 6, 12, 14][i % 4], lpChange: i % 3 !== 1 ? 18 : -14, eloAfter: 1036 - i * 8, isMVP: i % 5 === 0, isSVP: i === 1, role: ['JGL', 'MID', 'SUP', 'ADC'][i % 4], championId: ['246', '7', '412', '110'][i % 4] }));
  const leagueGames = games.slice(0, 13).map((g, i) => ({ ...g, id: `league-sample-${i}`, queue: i % 3 ? 'solo' : 'flex', reportedAt: `10-${String(17 - i).padStart(2, '0')} 19:30:00` }));
  account.data = { configured: true, authenticated: true, profile: { displayName: 'Sample player', riotName: 'Sample', riotTag: 'DEMO', server: 'Ionia', primaryRole: 'JNG', secondaryRole: 'MID', currentRank: 'Emerald II', nationality: 'United Kingdom', bio: 'Jungle main. Here for the inhouses.', verificationStatus: 'VERIFIED', accountStatus: 'ACTIVE', avatar: 'champions/246.png', lastRankLookup: new Date().toISOString() }, games, leagueGames,
    summary: { elo: 1036, rank: 8, games: 17, wins: 11, losses: 6, averageKda: 4.21, mvps: 4, svps: 1, streak: 'W2', topChampions: [{ championId: '246', games: 7, wins: 5 }, { championId: '7', games: 5, wins: 3 }, { championId: '412', games: 3, wins: 2 }], roles: [{ role: 'JGL', games: 9, pct: 53, winRate: 67 }, { role: 'MID', games: 5, pct: 29, winRate: 60 }, { role: 'SUP', games: 3, pct: 18, winRate: 67 }] },
    leaderboard: Array.from({ length: 7 }, (_, i) => ({ rank: i + 1, name: `Sample ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf'][i]}`, elo: 1230 - i * 25, games: 20 + i, winRate: i === 6 ? null : 70 - i * 3, kda: 4.7 - i * .2, team: i === 0 ? 'Sample team' : 'FA' })), loading: false, error: '', historyError: '', ladderError: '', lastUpdated: Date.now() };
  Object.assign(account.data.profile, { soloRank: { tier: 'Emerald II', lp: 48 }, flexRank: { tier: 'Platinum III', lp: 22 }, leagueChampions: [{ championId: '246', games: 16 }, { championId: '7', games: 11 }] });
  account.data.profile.server = '\u827e\u6b27\u5c3c\u4e9a';
  account.data.profile.currentRank = '\u94c2\u91d1I';
  account.data.profile.soloRank.tier = '\u7fe1\u7fe0II';
  account.data.profile.flexRank.tier = '\u94c2\u91d1III';
  for (const row of account.data.leaderboard) Object.assign(row, { championSource: 'ecl-snapshot', championsUpdatedAt: account.data.profile.lastRankLookup, topChampions: [{ championId: '246', games: 9 }, { championId: '7', games: 5 }, { championId: '412', games: 3 }] });
}
function scoreboard(id, games) {
  const game = games.find(g => g.id === id);
  if (!game) throw new Error('Choose a sample match.');
  return { id, metricsVersion: 2, label: game.label, date: game.date, players: summarize(fixture()).map((p, i) => ({ ...p, role: ['JGL', 'MID', 'TOP', 'ADC', 'SUP'][i % 5], isWin: i < 5, isMVP: i === 1, isSVP: i === 6, vision: null })) };
}
function preview() {
  const raw = fixture('11363615233');
  return { sample: true, gameId: raw.gameId, raw, validation: validate(raw), players: summarize(raw), collectedAt: Date.now() };
}
module.exports = { fixture, seed, seedAccount, preview, scoreboard };
