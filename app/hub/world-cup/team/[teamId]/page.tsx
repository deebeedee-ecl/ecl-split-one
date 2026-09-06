import fs from "node:fs/promises";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { HubShell } from "../../../_components/HubShell";
import { prisma } from "@/lib/prisma";
import { formatLzyumiRank, getLzyumiRankRows } from "@/lib/hub-profile";
import { riotIdKey } from "@/lib/riot-id";
import { countryNameLabel } from "@/lib/world-cup-countries";
import { parseWorldCupApplication } from "@/lib/world-cup-applications";
import { WorldCupFlag } from "../../WorldCupFlag";
import { CaptainApplicationsPanel } from "./CaptainApplicationsPanel";

export const dynamic = "force-dynamic";

type TeamPlayer = {
  playerName?: string;
  name?: string;
  riotName?: string;
  riotTag?: string;
  primaryRole?: string;
  secondaryRole?: string;
  nationality?: string;
  countryCode?: string;
  countryFlag?: string;
  teamCountry?: string;
  teamCountryCode?: string;
  teamCountryFlag?: string;
};

type ChampionPick = {
  championId: string;
  games: number;
  name: string;
};

type TeamProfile = {
  id: string;
  riotName: string;
  riotTag: string | null;
  currentRank: string | null;
  lzyumiRawProfile: unknown;
  lzyumiRecentStat: unknown;
  championPool: unknown;
};

type TournamentGame = {
  id: string;
  teamIsHome: boolean;
  winnerTeamId: string | null;
  homeKills: number | null;
  awayKills: number | null;
  homeDrakes: number | null;
  awayDrakes: number | null;
  homeBarons: number | null;
  awayBarons: number | null;
  homeTowers: number | null;
  awayTowers: number | null;
  playerStats: Array<{
    kills: number;
    deaths: number;
    assists: number;
    teamId: string | null;
  }>;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function displayName(player: TeamPlayer) {
  return clean(player.playerName) || clean(player.name) || clean(player.riotName) || "Player";
}

function displayRiot(player: TeamPlayer) {
  const name = clean(player.riotName);
  const tag = clean(player.riotTag);
  return name && tag ? `${name}#${tag}` : "Riot pending";
}

function playerCountryName(player: TeamPlayer) {
  return countryNameLabel({
    countryName: player.nationality || player.teamCountry,
    countryCode: player.countryCode || player.teamCountryCode,
  });
}

function isRealPlayer(player: TeamPlayer) {
  return Boolean(clean(player.playerName) || clean(player.name) || clean(player.riotName) || clean(player.riotTag));
}

async function championNameMap() {
  const file = await fs.readFile(
    path.join(process.cwd(), "public", "lol", "champions", "champions.json"),
    "utf8",
  );
  const champions = JSON.parse(file.replace(/^\uFEFF/, "")) as Array<{ id: number; name: string }>;
  return new Map(champions.map((champion) => [String(champion.id), champion.name]));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function topChampions(profile: { lzyumiRecentStat?: unknown; championPool?: unknown }, names: Map<string, string>) {
  const recentRoot = asRecord(profile.lzyumiRecentStat);
  const data = asRecord(recentRoot?.data);
  const recentState = asRecord(data?.recentState);
  const common = recentState?.common_use_champions;

  if (Array.isArray(common)) {
    return common
      .map((entry) => {
        const item = asRecord(entry);
        const championId = String(item?.key ?? item?.championId ?? "");
        const games = Number(item?.value ?? item?.games ?? 0);
        return { championId, games, name: names.get(championId) ?? `Champion ${championId}` };
      })
      .filter((entry) => entry.championId && Number.isFinite(entry.games))
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
  }

  const pool = profile.championPool;
  if (Array.isArray(pool)) {
    return pool
      .map((entry) => {
        const item = asRecord(entry);
        const championId = String(item?.championId ?? item?.id ?? "");
        const name = clean(String(item?.name ?? "")) || names.get(championId) || `Champion ${championId}`;
        return { championId, games: Number(item?.games ?? 0), name };
      })
      .filter((entry) => entry.championId || entry.name)
      .slice(0, 3);
  }

  return [] satisfies ChampionPick[];
}

function profileRank(profile?: { currentRank?: string | null; lzyumiRawProfile?: unknown } | null) {
  if (!profile) return "Hub pending";
  const solo = getLzyumiRankRows(profile.lzyumiRawProfile, profile.currentRank).solo;
  return formatLzyumiRank(solo).label;
}

function roleCounts(players: TeamPlayer[]) {
  const counts = new Map<string, { primary: number; secondary: number }>();

  for (const player of players) {
    const primary = clean(player.primaryRole) || "Fill";
    const secondary = clean(player.secondaryRole);

    const primaryCurrent = counts.get(primary) ?? { primary: 0, secondary: 0 };
    primaryCurrent.primary += 1;
    counts.set(primary, primaryCurrent);

    if (secondary && secondary.toLowerCase() !== primary.toLowerCase()) {
      const secondaryCurrent = counts.get(secondary) ?? { primary: 0, secondary: 0 };
      secondaryCurrent.secondary += 1;
      counts.set(secondary, secondaryCurrent);
    }
  }

  return Array.from(counts.entries()).sort(
    (a, b) =>
      b[1].primary + b[1].secondary - (a[1].primary + a[1].secondary) ||
      b[1].primary - a[1].primary ||
      a[0].localeCompare(b[0]),
  );
}

function teamCountryCode(players: TeamPlayer[]) {
  const first = players.find((player) => clean(player.teamCountryCode) || clean(player.countryCode));
  return first?.teamCountryCode || first?.countryCode || "";
}

function profileForPlayer(player: TeamPlayer, profileByRiot: Map<string, TeamProfile>) {
  return profileByRiot.get(riotIdKey(player.riotName, player.riotTag) ?? "") ?? null;
}

function isWorldCupMatch(match: {
  roundLabel?: string | null;
  matchLabel?: string | null;
  notes?: string | null;
}) {
  const text = `${match.roundLabel ?? ""} ${match.matchLabel ?? ""} ${match.notes ?? ""}`.toLowerCase();

  if (!text.trim()) return true;
  return text.includes("world cup") || text.includes("worldcup") || text.includes("wc ");
}

function clampStat(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDecimal(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function tournamentStats(teamId: string | null, games: TournamentGame[]) {
  if (!teamId || games.length === 0) {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      kda: 0,
      avgDrakes: 0,
      avgBarons: 0,
      avgTowers: 0,
      synergy: 0,
      objectiveControl: 0,
      winRate: 0,
    };
  }

  let wins = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let drakes = 0;
  let barons = 0;
  let towers = 0;
  let kpSamples = 0;
  let kpTotal = 0;

  for (const game of games) {
    const teamStats = game.playerStats.filter((stat) => stat.teamId === teamId);
    const teamKills = teamStats.reduce((sum, stat) => sum + stat.kills, 0);
    const resolvedTeamKills = teamKills || (game.teamIsHome ? game.homeKills ?? 0 : game.awayKills ?? 0);

    if (game.winnerTeamId === teamId) wins += 1;

    kills += teamStats.reduce((sum, stat) => sum + stat.kills, 0);
    deaths += teamStats.reduce((sum, stat) => sum + stat.deaths, 0);
    assists += teamStats.reduce((sum, stat) => sum + stat.assists, 0);
    drakes += game.teamIsHome ? game.homeDrakes ?? 0 : game.awayDrakes ?? 0;
    barons += game.teamIsHome ? game.homeBarons ?? 0 : game.awayBarons ?? 0;
    towers += game.teamIsHome ? game.homeTowers ?? 0 : game.awayTowers ?? 0;

    if (resolvedTeamKills > 0) {
      for (const stat of teamStats) {
        kpTotal += ((stat.kills + stat.assists) / resolvedTeamKills) * 100;
        kpSamples += 1;
      }
    }
  }

  const gamesPlayed = games.length;
  const avgDrakes = drakes / gamesPlayed;
  const avgBarons = barons / gamesPlayed;
  const avgTowers = towers / gamesPlayed;

  return {
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    kda: (kills + assists) / Math.max(1, deaths),
    avgDrakes,
    avgBarons,
    avgTowers,
    synergy: kpSamples ? kpTotal / kpSamples : 0,
    objectiveControl: clampStat((avgDrakes / 4) * 55 + (avgTowers / 11) * 30 + (avgBarons / 2) * 15),
    winRate: (wins / gamesPlayed) * 100,
  };
}

export default async function WorldCupTeamDashboardPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const team = await prisma.teamRegistration.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return (
      <HubShell active="world-cup" eyebrow="World Cup" title="Team Missing" description="" theme="blue" hideHeader>
        <section className="border border-[#2d6bff]/30 bg-[#081431]/92 p-8 text-white">
          <h1 className="text-3xl font-black uppercase">Team not found.</h1>
          <Link href="/hub/world-cup/find-team" className="mt-5 inline-flex text-[#8dbbff]">
            Back to teams
          </Link>
        </section>
      </HubShell>
    );
  }

  const roster = Array.isArray(team.players) ? (team.players as TeamPlayer[]).filter(isRealPlayer) : [];
  const applications = await prisma.freeAgentRegistration.findMany({
    where: {
      notes: {
        contains: "World Cup Team Application",
      },
    },
    orderBy: { submittedAt: "desc" },
  });
  const teamApplications = applications.filter((application) => {
    const meta = parseWorldCupApplication(application.notes);
    return meta.requestedTeamId === team.id || meta.requestedTeam === team.teamName;
  });

  const riotKeys = [
    ...roster.map((player) => riotIdKey(player.riotName, player.riotTag)),
    ...teamApplications.map((application) => riotIdKey(application.riotName, application.riotTag)),
  ].filter((key): key is string => Boolean(key));

  const [profiles, championNames, officialTeam] = await Promise.all([
    prisma.accountProfile.findMany({
      where: {
        verificationStatus: "VERIFIED",
        accountStatus: "ACTIVE",
      },
      select: {
        id: true,
        riotName: true,
        riotTag: true,
        currentRank: true,
        lzyumiRawProfile: true,
        lzyumiRecentStat: true,
        championPool: true,
      },
    }),
    championNameMap(),
    prisma.team.findUnique({
      where: { name: team.teamName },
      select: { id: true },
    }),
  ]);

  const officialTeamId = officialTeam?.id ?? null;
  const tournamentMatches = officialTeamId
    ? await prisma.match.findMany({
        where: {
          status: "COMPLETED",
          OR: [{ homeTeamId: officialTeamId }, { awayTeamId: officialTeamId }],
        },
        include: {
          games: {
            include: {
              playerStats: {
                select: {
                  kills: true,
                  deaths: true,
                  assists: true,
                  teamId: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const tournamentGames = tournamentMatches
    .filter(isWorldCupMatch)
    .flatMap((match) =>
      match.games.map((game) => ({
        ...game,
        teamIsHome: match.homeTeamId === officialTeamId,
      })),
    ) as TournamentGame[];

  const profileByRiot = new Map(
    profiles
      .map((profile) => [riotIdKey(profile.riotName, profile.riotTag), profile] as const)
      .filter((entry) => entry[0] && riotKeys.includes(entry[0])),
  ) as Map<string, TeamProfile>;

  const teamCountry = Array.isArray(team.players) ? (team.players as TeamPlayer[]) : [];
  const roleCoverage = roleCounts(roster);
  const performance = tournamentStats(officialTeamId, tournamentGames);
  const championCounts = new Map<string, { champion: ChampionPick; totalGames: number; players: number }>();

  for (const player of roster) {
    const profile = profileForPlayer(player, profileByRiot);
    if (!profile) continue;

    for (const champion of topChampions(profile, championNames)) {
      const current = championCounts.get(champion.name);
      if (current) {
        current.totalGames += champion.games;
        current.players += 1;
      } else {
        championCounts.set(champion.name, {
          champion,
          totalGames: champion.games,
          players: 1,
        });
      }
    }
  }

  const topTeamChampions = Array.from(championCounts.values())
    .sort((a, b) => b.players - a.players || b.totalGames - a.totalGames || a.champion.name.localeCompare(b.champion.name))
    .slice(0, 3);
  const radarStats = [
    { label: "KDA", value: clampStat((performance.kda / 5) * 100), display: performance.gamesPlayed ? formatDecimal(performance.kda, 2) : "-" },
    { label: "Synergy", value: clampStat(performance.synergy), display: performance.gamesPlayed ? `${Math.round(performance.synergy)}%` : "-" },
    { label: "Drakes", value: clampStat((performance.avgDrakes / 4) * 100), display: performance.gamesPlayed ? formatDecimal(performance.avgDrakes) : "-" },
    { label: "Win Rate", value: clampStat(performance.winRate), display: performance.gamesPlayed ? `${Math.round(performance.winRate)}%` : "-" },
    { label: "Games", value: clampStat((performance.gamesPlayed / 10) * 100), display: String(performance.gamesPlayed) },
    { label: "Objectives", value: performance.objectiveControl, display: performance.gamesPlayed ? `${performance.objectiveControl}` : "-" },
  ];

  return (
    <HubShell active="world-cup" eyebrow="World Cup" title="Team Dashboard" description="" theme="blue" hideHeader>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/hub/world-cup/find-team"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff] transition hover:text-white"
        >
          <ArrowLeft size={15} />
          Back To Teams
        </Link>
        <Link
          href="/hub/world-cup/find-team"
          className="inline-flex min-h-10 items-center gap-2 border border-[#36D7FF]/24 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#C9DFEB] transition hover:border-white/45 hover:text-white"
        >
          <Users size={15} />
          View All Teams
        </Link>
      </div>

      <header className="mb-5 border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#36D7FF]">
              Team Dashboard
            </p>
            <h1 className="mt-2 break-words text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
              {team.teamName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C9DFEB]">
              Review tournament performance, player stats, champion coverage, and applicants before admin final approval.
            </p>
          </div>
          <div className="min-w-48 border border-[#36D7FF]/18 bg-[#020817]/42 p-3 text-sm font-black text-[#C9DFEB]">
            <WorldCupFlag code={teamCountryCode(teamCountry)} label={playerCountryName(teamCountry[0] ?? {})} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <DashboardStat icon={<Users size={18} />} label="Roster" value={`${Math.min(roster.length, 6)}/6`} />
        <DashboardStat icon={<Swords size={18} />} label="Record" value={`${performance.wins}-${performance.losses}`} />
        <DashboardStat icon={<ShieldCheck size={18} />} label="Synergy" value={performance.gamesPlayed ? `${Math.round(performance.synergy)}%` : "-"} />
        <DashboardStat icon={<Trophy size={18} />} label="Status" value={team.status} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Panel title="Team Radar">
          <div className="p-5">
            <TeamRadar stats={radarStats} />
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Role Coverage">
            <div className="divide-y divide-[#36D7FF]/10">
              {roleCoverage.length > 0 ? (
                roleCoverage.map(([role, count]) => (
                  <MetricRow
                    key={role}
                    label={role}
                    value={`${count.primary} primary / ${count.secondary} secondary`}
                  />
                ))
              ) : (
                <p className="p-5 text-sm font-semibold text-[#C9DFEB]">Roles appear once players are added.</p>
              )}
            </div>
          </Panel>

          <Panel title="Top 3 Champion Pool">
            <div className="divide-y divide-[#36D7FF]/10">
              {topTeamChampions.length > 0 ? (
                topTeamChampions.map(({ champion, players, totalGames }) => (
                  <div key={champion.name} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      {champion.championId && (
                        <Image
                          src={`/lol/champions/${champion.championId}.png`}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-sm object-cover"
                        />
                      )}
                      <span className="truncate text-sm font-black text-white">{champion.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[#C9DFEB]">
                      {players} player{players === 1 ? "" : "s"} / {totalGames} games
                    </span>
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm font-semibold text-[#C9DFEB]">Champion stats appear from verified Hub profiles.</p>
              )}
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="space-y-5">
          <Panel title="Roster">
            <div className="divide-y divide-[#69a7ff]/12">
              {Array.from({ length: 6 }, (_, index) => roster[index] ?? null).map((player, index) => {
                if (!player) {
                  return (
                    <PlayerRow
                      key={`empty-${index}`}
                      slot={`Slot ${index + 1}`}
                      name="Open roster slot"
                      riotId="Waiting for accepted applicant"
                      role="Role pending"
                      nationality="Nationality pending"
                      rank="Hub pending"
                      champions={[]}
                    />
                  );
                }
                const profile = profileByRiot.get(riotIdKey(player.riotName, player.riotTag) ?? "");
                const champs = profile ? topChampions(profile, championNames) : [];

                return (
                  <PlayerRow
                    key={`${displayRiot(player)}-${index}`}
                    slot={`Slot ${index + 1}`}
                    name={displayName(player)}
                    riotId={displayRiot(player)}
                    role={`${player.primaryRole || "Role pending"}${player.secondaryRole ? ` / ${player.secondaryRole}` : ""}`}
                    nationality={playerCountryName(player)}
                    countryCode={player.countryCode || player.teamCountryCode}
                    rank={profileRank(profile)}
                    profileId={profile?.id}
                    champions={champs}
                  />
                );
              })}
            </div>
          </Panel>
          <CaptainApplicationsPanel teamId={team.id} />
        </div>

        <aside className="space-y-4">
          <section className="border border-[#2d6bff]/30 bg-[#081431]/92 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
              Captain Flow
            </p>
            <h2 className="mt-3 text-2xl font-black uppercase leading-tight text-white">
              Accept first. Admins finalize.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#aebfe4]">
              Accepted applicants stay visible in admin review so ECL staff can lock the official roster.
            </p>
          </section>
          <section className="border border-[#2d6bff]/30 bg-[#020817]/55 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
              Scouting Source
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#aebfe4]">
              Rank and top champions appear when the player has a verified Hub profile with refreshed ECL.GG data.
            </p>
          </section>
        </aside>
      </section>
    </HubShell>
  );
}

function DashboardStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-[#2d6bff]/30 bg-[#081431]/92 p-4">
      <div className="flex items-center gap-2 text-[#8dbbff]">{icon}</div>
      <p className="mt-3 text-2xl font-black uppercase text-white">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8094c2]">{label}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden border border-[#2d6bff]/30 bg-[#081431]/92">
      <h2 className="border-b border-[#69a7ff]/14 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TeamRadar({ stats }: { stats: Array<{ label: string; value: number; display?: string }> }) {
  const center = 100;
  const radius = 74;
  const spokes = stats.map((stat, index) => {
    const angle = (-90 + index * (360 / stats.length)) * (Math.PI / 180);
    const capped = Math.max(0, Math.min(100, stat.value));
    const outerX = center + Math.cos(angle) * radius;
    const outerY = center + Math.sin(angle) * radius;
    const valueX = center + Math.cos(angle) * ((capped / 100) * radius);
    const valueY = center + Math.sin(angle) * ((capped / 100) * radius);

    return { ...stat, outerX, outerY, valueX, valueY, capped };
  });
  const polygon = spokes.map((point) => `${point.valueX},${point.valueY}`).join(" ");
  const rings = [25, 50, 75, 100].map((percent) =>
    spokes
      .map((_, index) => {
        const angle = (-90 + index * (360 / stats.length)) * (Math.PI / 180);
        const ringRadius = (percent / 100) * radius;
        return `${center + Math.cos(angle) * ringRadius},${center + Math.sin(angle) * ringRadius}`;
      })
      .join(" "),
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
      <svg viewBox="0 0 200 200" className="mx-auto aspect-square w-full max-w-52 overflow-visible">
        {rings.map((points, index) => (
          <polygon
            key={points}
            points={points}
            fill="none"
            stroke="rgba(119,207,255,0.18)"
            strokeWidth={index === rings.length - 1 ? 1.5 : 1}
          />
        ))}
        {spokes.map((point) => (
          <line
            key={point.label}
            x1={center}
            y1={center}
            x2={point.outerX}
            y2={point.outerY}
            stroke="rgba(54,215,255,0.16)"
            strokeWidth="1"
          />
        ))}
        <polygon points={polygon} fill="rgba(7,151,242,0.34)" stroke="#36D7FF" strokeWidth="2" />
        {spokes.map((point) => (
          <circle key={`${point.label}-dot`} cx={point.valueX} cy={point.valueY} r="3.5" fill="#F5F5F2" />
        ))}
      </svg>
      <div className="space-y-3">
        {spokes.map((stat) => (
          <div key={stat.label}>
            <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="text-[#C9DFEB]">{stat.label}</span>
              <span className="text-white">{stat.display ?? stat.capped}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden bg-[#020817]">
              <div
                className="h-full bg-[linear-gradient(90deg,#0755C9,#36D7FF)]"
                style={{ width: `${stat.capped}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm font-black uppercase tracking-[0.1em] text-white">{label}</span>
      <span className="shrink-0 text-xs font-bold text-[#C9DFEB]">{value}</span>
    </div>
  );
}

function PlayerRow({
  slot,
  name,
  riotId,
  role,
  nationality,
  countryCode,
  rank,
  profileId,
  champions,
  pitch,
  compact = false,
}: {
  slot: string;
  name: string;
  riotId: string;
  role: string;
  nationality: string;
  countryCode?: string | null;
  rank: string;
  profileId?: string;
  champions: ChampionPick[];
  pitch?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "" : "grid gap-3 p-4 md:grid-cols-[4.5rem_minmax(0,1fr)]"}`}>
      {!compact && (
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8dbbff]">
          {slot}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-base font-black text-white">
              {name}
            </p>
            <p className="mt-1 break-all text-xs font-bold text-[#8094c2]">
              {riotId}
            </p>
          </div>
          <span className="border border-[#69a7ff]/18 bg-[#020817]/50 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#8dbbff]">
            {slot}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-xs font-bold text-[#aebfe4] md:grid-cols-3">
          <span>{role}</span>
          <WorldCupFlag code={countryCode} label={nationality} />
          <span>{rank}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {champions.length > 0 ? (
            champions.map((champion) => (
              <span
                key={`${champion.championId}-${champion.name}`}
                className="inline-flex items-center gap-2 border border-[#69a7ff]/16 bg-[#020817]/50 px-2 py-1 text-xs font-bold text-[#d7e6ff]"
              >
                {champion.championId && (
                  <Image
                    src={`/lol/champions/${champion.championId}.png`}
                    alt=""
                    width={22}
                    height={22}
                    className="h-5 w-5 object-cover"
                  />
                )}
                {champion.name}
              </span>
            ))
          ) : (
            <span className="text-xs font-bold text-[#5f7fb8]">
              Top champions pending
            </span>
          )}
          {profileId && (
            <Link
              href={`/hub/players/${profileId}`}
              className="inline-flex min-h-7 items-center border border-[#69a7ff]/24 px-2 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
            >
              Profile
            </Link>
          )}
        </div>

        {pitch && (
          <p className="mt-3 border-l-2 border-[#69a7ff]/35 pl-3 text-sm font-semibold leading-6 text-[#d7e6ff]">
            {pitch}
          </p>
        )}
      </div>
    </div>
  );
}
