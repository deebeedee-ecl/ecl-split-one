"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import {
  HUB_ROLE_ICONS,
  hubRoleLabel,
  type HubRole,
} from "@/lib/hub-profile";

export type PlayerDirectoryRow = {
  id: string;
  name: string;
  riotId: string;
  roles: HubRole[];
  primaryRole: HubRole | null;
  secondaryRole: HubRole | null;
  worldCupStatus?: "ROSTERED" | "LFT";
  worldCupTeamName?: string | null;
};

const roleOptions: Array<{ value: HubRole; label: string }> = [
  { value: "TOP", label: "Top" },
  { value: "JNG", label: "Jungle" },
  { value: "MID", label: "Mid" },
  { value: "ADC", label: "ADC" },
  { value: "SUPP", label: "Support" },
  { value: "FILL", label: "Fill" },
];

export function PlayersDirectoryClient({ players }: { players: PlayerDirectoryRow[] }) {
  const [nameQuery, setNameQuery] = useState("");
  const [primaryRole, setPrimaryRole] = useState("");
  const [secondaryRole, setSecondaryRole] = useState("");
  const [worldCupView, setWorldCupView] = useState<"players" | "free-agents">("players");
  const hasWorldCupStatus = players.some((player) => player.worldCupStatus);
  const tableGridClass = hasWorldCupStatus
    ? "lg:grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1fr)_11rem_11rem_5rem]"
    : "lg:grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1fr)_11rem_5rem]";

  const filteredPlayers = useMemo(() => {
    const cleanQuery = nameQuery.trim().toLowerCase();

    return players.filter((player) => {
      const matchesName =
        !cleanQuery ||
        player.name.toLowerCase().includes(cleanQuery) ||
        player.riotId.toLowerCase().includes(cleanQuery);
      const matchesPrimary = !primaryRole || player.primaryRole === primaryRole;
      const matchesSecondary = !secondaryRole || player.secondaryRole === secondaryRole;
      const matchesWorldCupView =
        !hasWorldCupStatus ||
        worldCupView === "players" ||
        player.worldCupStatus === "LFT";

      return matchesName && matchesPrimary && matchesSecondary && matchesWorldCupView;
    });
  }, [hasWorldCupStatus, nameQuery, players, primaryRole, secondaryRole, worldCupView]);

  return (
    <section className="space-y-4">
      {hasWorldCupStatus && (
        <div className="grid gap-2 border border-[#0797F2]/24 bg-[#061C4A]/88 p-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setWorldCupView("players")}
            className={`min-h-11 px-4 text-xs font-black uppercase tracking-[0.14em] transition ${
              worldCupView === "players"
                ? "bg-[#0755C9] text-white shadow-[0_0_24px_rgba(54,215,255,0.18)]"
                : "text-[#C9DFEB] hover:bg-[#0797F2]/16 hover:text-white"
            }`}
          >
            Players
          </button>
          <button
            type="button"
            onClick={() => setWorldCupView("free-agents")}
            className={`min-h-11 px-4 text-xs font-black uppercase tracking-[0.14em] transition ${
              worldCupView === "free-agents"
                ? "bg-[#0755C9] text-white shadow-[0_0_24px_rgba(54,215,255,0.18)]"
                : "text-[#C9DFEB] hover:bg-[#0797F2]/16 hover:text-white"
            }`}
          >
            Free Agents
          </button>
        </div>
      )}

      <div className="border border-[#0797F2]/24 bg-[#061C4A]/88 p-4">
        <div className="mb-3 flex items-center gap-2 text-[#77CFFF]">
          <SlidersHorizontal size={17} />
          <p className="text-xs font-black uppercase tracking-[0.14em]">
            Filters
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_12rem_12rem]">
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#77CFFF]"
            />
            <input
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              className="world-cup-input pl-10"
              placeholder="Filter by player or Riot ID"
            />
          </label>
          <select
            value={primaryRole}
            onChange={(event) => setPrimaryRole(event.target.value)}
            className="world-cup-input"
            aria-label="Filter by primary role"
          >
            <option value="">Primary role</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <select
            value={secondaryRole}
            onChange={(event) => setSecondaryRole(event.target.value)}
            className="world-cup-input"
            aria-label="Filter by secondary role"
          >
            <option value="">Secondary role</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="overflow-hidden rounded-[0.9rem] border border-[#0797F2]/22 bg-[#061C4A]/82 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_18px_44px_rgba(0,0,0,0.35)]">
        <div className={`hidden items-center border-b border-[#36D7FF]/12 bg-white/[0.035] px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#77CFFF] lg:grid ${tableGridClass}`}>
          <span>Player</span>
          <span>Riot ID</span>
          <span>Roles</span>
          {hasWorldCupStatus && <span>Status</span>}
          <span className="text-right">Profile</span>
        </div>

        <div className="divide-y divide-[#36D7FF]/10">
          {filteredPlayers.map((player) => (
            <Link
              key={player.id}
              href={`/hub/players/${player.id}`}
              className={`group relative block px-4 py-4 transition hover:bg-[#0797F2]/10 lg:grid lg:min-h-[4.75rem] lg:items-center lg:gap-0 ${tableGridClass}`}
            >
              <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-[#36D7FF]/0 via-[#36D7FF]/0 to-[#36D7FF]/0 transition group-hover:via-[#36D7FF]/65" />

              <div className="min-w-0 pr-4">
                <h2 className="break-words text-xl font-black leading-tight text-white transition group-hover:text-[#77CFFF] lg:text-lg">
                  {player.name}
                </h2>
                <p className="mt-1 text-xs font-bold text-[#C9DFEB] lg:hidden">
                  {player.riotId}
                </p>
              </div>

              <p className="mt-3 hidden min-w-0 break-all text-sm font-bold text-[#C9DFEB] lg:mt-0 lg:block lg:pr-4">
                {player.riotId}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 lg:mt-0">
                {player.roles.length > 0 ? (
                  player.roles.map((role) => (
                    <span
                      key={`${player.id}-${role}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#36D7FF]/25 bg-[#0755C9]/18 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_0_18px_rgba(54,215,255,0.14)]"
                      title={hubRoleLabel(role)}
                    >
                      <Image
                        src={HUB_ROLE_ICONS[role]}
                        alt={hubRoleLabel(role)}
                        width={22}
                        height={22}
                        className="opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.18)]"
                      />
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold text-[#77CFFF]/60">No roles</span>
                )}
              </div>

              {player.worldCupStatus && (
                <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:pr-4">
                  <span
                    className={`inline-flex min-h-8 items-center border px-3 text-[0.65rem] font-black uppercase tracking-[0.12em] ${
                      player.worldCupStatus === "LFT"
                        ? "border-[#36D7FF]/40 bg-[#0797F2]/16 text-[#77CFFF]"
                        : "border-[#C9DFEB]/24 bg-white/[0.04] text-[#C9DFEB]"
                    }`}
                  >
                    {player.worldCupStatus === "LFT" ? "Free Agent / LFT" : "Rostered"}
                  </span>
                  {player.worldCupTeamName && (
                    <span className="text-xs font-bold text-[#C9DFEB]/70">
                      {player.worldCupTeamName}
                    </span>
                  )}
                </div>
              )}

              <div className="hidden justify-end lg:flex">
                <span className="rounded-full border border-[#36D7FF]/35 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#C9DFEB] transition group-hover:border-white/50 group-hover:text-white">
                  View
                </span>
              </div>
            </Link>
          ))}

          {filteredPlayers.length === 0 && (
            <p className="p-5 text-sm font-semibold text-[#C9DFEB]">
              No players match those filters.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
