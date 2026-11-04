import type { TournamentData } from './match-types';

type View = Pick<TournamentData, 'teams' | 'fixtures' | 'reports' | 'standings'>;
type Fixture = View['fixtures'][number];
const hub = 'https://eclchina.lol/hub/split-ii';

export const splitTwoHelp = [
  'ECL Split II / Coach',
  '!split2 standings — current table',
  '!split2 fixtures — remaining round-robin fixtures',
  '!split2 fixtures all — full draw, including scores',
  '!split2 results — published results',
  '!split2 report — how to report a game',
  '!split2 schedule FIXTURE YYYY-MM-DD HH:mm — propose China time',
  '!split2 confirm FIXTURE REVISION — opposing captain confirms',
  '!split2 cancel FIXTURE REVISION — cancel a proposal',
  'Use the RR code shown beside a fixture. Captains schedule their own games; admins can override.',
  'Tournament reports require admin review and never award inhouse LP.',
].join('\n');

export function splitTwoReportHelp(code = 'FIXTURE') {
  return [
    'ECL Split II / Report a game',
    `!split2 report ${code} NUMERIC_GAME_ID [GAME_NUMBER]`,
    'A player who played the match can request collection, then open Split II in the desktop Hub and connect tournament reporting.',
    'If the client cannot retrieve the game, ask an admin to import the match data or enter a manual report:',
    'https://eclchina.lol/admin/split-ii',
    'An admin can report without having played. A saved report must be approved before results and standings change.',
    'Tournament reports never award inhouse LP.',
  ].join('\n');
}

export function fixtureFinished(fixture: Fixture) {
  return Math.max(fixture.homeScore, fixture.awayScore) >= Math.ceil(fixture.bestOf / 2);
}

export function completedFixtureReply(fixture: Fixture, view: View) {
  const name = (id: string) => view.teams.find(t => t.id === id)?.name ?? 'Unknown team';
  return [
    `${fixture.code} / Already reported`,
    `${name(fixture.homeTeamId)} ${fixture.homeScore}–${fixture.awayScore} ${name(fixture.awayTeamId)}`,
    `View the published match details: ${hub}`,
    'Ask an admin for a correction if this result is wrong. No new collection request was created.',
  ].join('\n');
}

/** Public tournament copy only. No account resolution, collection or notification calls. */
export function splitTwoReadReply(action: string, args: string[], view: View): string | null {
  const name = (id: string) => view.teams.find(t => t.id === id)?.name ?? 'Unknown team';
  if (action === 'standings' || action === 'table') {
    const table = [...view.standings].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
    return [
      'ECL Split II / Standings',
      'Team / Played / W–L / Points',
      ...table.map(t => `${t.name} / ${t.played} / ${t.wins}–${t.losses} / ${t.wins}`),
      'One point per win. Equal points remain provisional until tie-breaks are resolved.',
      hub,
    ].join('\n');
  }
  if (action === 'fixtures' || action === 'remaining') {
    const mode = action === 'remaining' ? 'remaining' : (args[0]?.toLowerCase() || 'remaining');
    if (!['remaining', 'all'].includes(mode)) return 'Use !split2 fixtures, !split2 remaining or !split2 fixtures all.';
    const fixtures = view.fixtures.filter(f => f.stage === 'ROUND_ROBIN' && (mode === 'all' || !fixtureFinished(f)))
      .sort((a, b) => a.week - b.week || a.code.localeCompare(b.code));
    if (!fixtures.length) return ['ECL Split II / Remaining fixtures', 'Round robin complete. No round-robin fixtures remain.', hub].join('\n');
    const lines = [`ECL Split II / ${mode === 'all' ? 'All round-robin fixtures' : 'Remaining fixtures'}`,
      `${fixtures.length} ${mode === 'all' ? 'fixtures' : 'unplayed fixtures'} / Bo1`];
    let week = -1;
    for (const fixture of fixtures) {
      if (fixture.week !== week) { week = fixture.week; lines.push(`\nWeek ${week}`); }
      const played = fixtureFinished(fixture);
      const matchup = played
        ? `${name(fixture.homeTeamId)} ${fixture.homeScore}–${fixture.awayScore} ${name(fixture.awayTeamId)}`
        : `${name(fixture.homeTeamId)} vs ${name(fixture.awayTeamId)}`;
      const when = !played && fixture.schedule
        ? ` / ${new Date(fixture.schedule.at).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false })} China / ${fixture.schedule.state}`
        : !played ? ' / Unscheduled' : ' / Final';
      lines.push(`${fixture.code}: ${matchup}${when}`);
    }
    lines.push(hub);
    return lines.join('\n');
  }
  if (action === 'results') {
    const reports = view.reports.filter(r => r.status === 'APPROVED')
      .map(r => ({ ...r, payload: r.payload as unknown as { winnerTeamId: string; durationSeconds: number; playedAt: string } }))
      .sort((a, b) => Date.parse(b.payload.playedAt) - Date.parse(a.payload.playedAt));
    if (!reports.length) return ['ECL Split II / Results', 'No published results yet.', hub].join('\n');
    const lines = ['ECL Split II / Published results'];
    for (const fixture of view.fixtures.filter(f => reports.some(r => r.fixtureId === f.id)).sort((a, b) => {
      const time = (id: string) => Math.max(0, ...reports.filter(r => r.fixtureId === id).map(r => Date.parse(r.payload.playedAt)));
      return time(b.id) - time(a.id);
    })) {
      lines.push(`${fixture.code}: ${name(fixture.homeTeamId)} ${fixture.homeScore}–${fixture.awayScore} ${name(fixture.awayTeamId)}`);
      for (const report of reports.filter(r => r.fixtureId === fixture.id)) {
        const seconds = report.payload.durationSeconds;
        const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        const when = new Date(report.payload.playedAt).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
        lines.push(`  ${when} China / ${duration}`);
      }
    }
    lines.push(hub);
    return lines.join('\n');
  }
  return null;
}
