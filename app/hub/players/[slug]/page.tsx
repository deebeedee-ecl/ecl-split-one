import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  HUB_ROLE_ICONS,
  formatLzyumiRank,
  getLzyumiRankRows,
  hubRoleLabel,
  isSafeProfileImageUrl,
  lzyumiTierColor,
  normalizeHubRole,
  type HubRole,
} from "@/lib/hub-profile";
import { HubShell } from "../../_components/HubShell";

export const dynamic = "force-dynamic";

type PlayerProfilePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type LzyumiRecentGame = {
  championId?: string | number;
  isWin?: number;
  title?: string;
  titleTime?: string;
  wasMvp?: string;
  wasSvp?: string;
};

type RankedGamesPayload = {
  soloGames?: LzyumiRecentGame[];
  flexGames?: LzyumiRecentGame[];
};

type ChampionStat = {
  id: string;
  plays: number;
};

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getSeasonChampStats(recentStatRaw: unknown): ChampionStat[] {
  const root = asRecord(recentStatRaw);
  const data = asRecord(root?.data);
  const recentState = asRecord(data?.recentState);
  const champions = recentState?.common_use_champions;

  if (!Array.isArray(champions)) return [];

  return champions
    .map((item) => {
      const row = asRecord(item);
      return {
        id: String(row?.key ?? ""),
        plays: Number(row?.value ?? 0),
      };
    })
    .filter((item) => item.id && item.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);
}

function getCombinedRankedGames(rankedGamesRaw: unknown): LzyumiRecentGame[] {
  const payload = asRecord(rankedGamesRaw) as RankedGamesPayload | null;
  const soloGames = Array.isArray(payload?.soloGames) ? payload.soloGames : [];
  const flexGames = Array.isArray(payload?.flexGames) ? payload.flexGames : [];

  return [...soloGames, ...flexGames]
    .filter((game) => !String(game.title ?? "").includes("ARAM"))
    .sort((a, b) => String(b.titleTime ?? "").localeCompare(String(a.titleTime ?? "")))
    .slice(0, 8);
}

function parseGameScore(title: string | undefined) {
  const match = title?.match(/\((\d+)-(\d+)-(\d+)\)/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : "-";
}

function parseGameMode(title: string | undefined) {
  const value = title ?? "";
  if (value.includes("\u7075\u6d3b")) return "Flex";
  if (value.includes("\u5355\u53cc")) return "Solo/Duo";
  return "Ranked";
}

function parseGameDate(titleTime: string | undefined) {
  return titleTime?.split(" ")?.[0] ?? "";
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { slug } = await params;

  const profile = await prisma.accountProfile.findFirst({
    where: {
      id: slug,
      verificationStatus: "VERIFIED",
      accountStatus: "ACTIVE",
    },
    select: {
      id: true,
      displayName: true,
      riotName: true,
      riotTag: true,
      chinaServerName: true,
      primaryRole: true,
      secondaryRole: true,
      avatarUrl: true,
      bannerUrl: true,
      currentRank: true,
      lzyumiRawProfile: true,
      lzyumiRecentStat: true,
      lzyumiRankedGames: true,
      lzyumiLastLookupAt: true,
      verificationStatus: true,
    },
  });

  if (!profile) {
    notFound();
  }

  const roles = [normalizeHubRole(profile.primaryRole), normalizeHubRole(profile.secondaryRole)].filter(
    Boolean,
  ) as HubRole[];
  const ranks = getLzyumiRankRows(profile.lzyumiRawProfile, profile.currentRank);
  const soloRank = formatLzyumiRank(ranks.solo);
  const flexRank = formatLzyumiRank(ranks.flex);
  const avatarUrl = isSafeProfileImageUrl(profile.avatarUrl) ? profile.avatarUrl : null;
  const bannerUrl = isSafeProfileImageUrl(profile.bannerUrl) ? profile.bannerUrl : null;
  const initials = getInitials(profile.displayName || profile.riotName || "ECL");
  const championStats = getSeasonChampStats(profile.lzyumiRecentStat);
  const recentGames = getCombinedRankedGames(profile.lzyumiRankedGames);
  const hasRank = Boolean(ranks.solo || ranks.flex);

  return (
    <HubShell
      active="players"
      eyebrow="Player Profile"
      title={profile.displayName}
      description={`${profile.riotName}#${profile.riotTag}${profile.chinaServerName ? ` / ${profile.chinaServerName}` : ""}`}
    >
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[1.7rem] border border-white/[0.08] bg-[#191a1f] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="h-44 w-full object-cover" />
          ) : (
            <div className="h-44 bg-[radial-gradient(circle_at_80%_15%,rgba(255,23,40,0.28),transparent_28%),linear-gradient(135deg,#211217,#10131f_58%,#07090f)]" />
          )}

          <div className="-mt-14 flex flex-col gap-6 px-7 pb-7 md:flex-row md:items-end">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[1.7rem] bg-[#24262d] text-4xl font-black text-white ring-4 ring-[#191a1f]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-4xl font-black tracking-normal text-white md:text-5xl">
                  {profile.displayName}
                </h2>
                <span className="rounded-full border border-[#19d27f]/30 bg-[#19d27f]/10 px-3 py-1 text-xs font-black uppercase text-[#19d27f]">
                  Verified
                </span>
              </div>

              <p className="mt-3 text-base font-bold text-[#aeb5da]">
                Riot ID: {profile.riotName}#{profile.riotTag}
                {profile.chinaServerName ? ` / ${profile.chinaServerName}` : ""}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {roles.map((role) => (
                  <RoleBadge key={role} role={role} />
                ))}
                {ranks.solo && (
                  <RankTag
                    label="Solo/Duo"
                    tier={soloRank.label}
                    lp={soloRank.lp}
                    color={lzyumiTierColor(ranks.solo.tier)}
                  />
                )}
                {ranks.flex && (
                  <RankTag
                    label="Flex"
                    tier={flexRank.label}
                    lp={flexRank.lp}
                    color={lzyumiTierColor(ranks.flex.tier)}
                  />
                )}
                {!hasRank && (
                  <span className="rounded-2xl bg-white/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#aeb5da] ring-1 ring-white/[0.08]">
                    Rank refresh pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="rounded-[1.2rem] border border-white/[0.08] bg-[#15161b] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff1730]">
                  Solo / Flex
                </p>
                <h3 className="mt-1 text-2xl font-black text-white">Recent Games</h3>
              </div>
              {profile.lzyumiLastLookupAt && (
                <p className="text-xs font-bold text-[#7d8397]">
                  Updated {profile.lzyumiLastLookupAt.toLocaleDateString("en-GB")}
                </p>
              )}
            </div>

            {recentGames.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {recentGames.map((game, index) => (
                  <RecentGameRow key={`${game.titleTime}-${game.championId}-${index}`} game={game} />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm font-bold text-[#8f96ae]">
                Recent ranked games will appear after the next ecl.gg stat refresh.
              </p>
            )}
          </div>

          <div className="rounded-[1.2rem] border border-white/[0.08] bg-[#15161b] p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff1730]">
              Season
            </p>
            <h3 className="mt-1 text-2xl font-black text-white">Most Played Champions</h3>

            {championStats.length > 0 ? (
              <div className="mt-5 grid grid-cols-5 gap-3">
                {championStats.map((champion) => (
                  <div key={champion.id} className="text-center">
                    <Image
                      src={`/lol/champions/${champion.id}.png`}
                      alt=""
                      width={52}
                      height={52}
                      className="mx-auto rounded-xl object-cover ring-1 ring-white/10"
                    />
                    <p className="mt-2 text-xs font-black text-[#cfd5f4]">{champion.plays}G</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm font-bold text-[#8f96ae]">
                Champion pool data will appear after the next ecl.gg stat refresh.
              </p>
            )}
          </div>
        </section>
      </div>
    </HubShell>
  );
}

function RoleBadge({ role }: { role: HubRole }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-white/[0.08]">
      <Image
        src={HUB_ROLE_ICONS[role]}
        alt={hubRoleLabel(role)}
        width={24}
        height={24}
        className="object-contain"
        style={{ filter: "brightness(0) invert(1)" }}
      />
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#d7dcff]">
        {hubRoleLabel(role)}
      </span>
    </span>
  );
}

function RankTag({
  label,
  tier,
  lp,
  color,
}: {
  label: string;
  tier: string;
  lp: number | null;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-4 py-2 ring-1 ring-white/[0.08]">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
      <p className={`text-base font-black ${color}`}>{tier}</p>
      {lp !== null && <p className="text-[10px] font-bold text-[#6b7280]">{lp} LP</p>}
    </div>
  );
}

function RecentGameRow({ game }: { game: LzyumiRecentGame }) {
  const championId = String(game.championId ?? "0");
  const isWin = game.isWin === 1;
  const resultClass = isWin ? "bg-[#19d27f]/12 text-[#19d27f]" : "bg-[#ff1730]/12 text-[#ff5b6d]";

  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06]">
      <Image
        src={`/lol/champions/${championId}.png`}
        alt=""
        width={48}
        height={48}
        className="rounded-xl object-cover ring-1 ring-white/10"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${resultClass}`}>
            {isWin ? "Win" : "Loss"}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f96ae]">
            {parseGameMode(game.title)}
          </span>
          {game.wasMvp && <span className="text-[10px] font-black uppercase text-[#ffd84d]">MVP</span>}
          {game.wasSvp && <span className="text-[10px] font-black uppercase text-[#ffd84d]">SVP</span>}
        </div>
        <p className="mt-1 text-lg font-black text-white">{parseGameScore(game.title)}</p>
      </div>
      <p className="text-xs font-black text-[#4ff5df]">{parseGameDate(game.titleTime)}</p>
    </div>
  );
}
