"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { BarChart3, CalendarDays, Globe2, Table2, Users } from "lucide-react";

type WorldCupNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number }>;
};

const items: WorldCupNavItem[] = [
  { label: "Dashboard", href: "/hub/dashboard", icon: Globe2 },
  { label: "Teams", href: "/hub/world-cup/find-team", icon: Users },
  { label: "Players", href: "/hub/world-cup/players", icon: BarChart3 },
  { label: "Standings", href: "/hub/world-cup/standings", icon: Table2 },
  { label: "Fixtures", href: "/hub/world-cup/fixtures", icon: CalendarDays },
];

export function WorldCupNav({
  active,
}: {
  active: "teams" | "apply" | "create" | "standings" | "fixtures" | "dashboard" | "players";
}) {
  return (
    <nav className="mb-5 grid gap-2 border border-[#0797F2]/30 bg-[#061C4A]/92 p-2 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          (active === "teams" && item.label === "Teams") ||
          (active === "dashboard" && item.label === "Dashboard") ||
          (active === "players" && item.label === "Players") ||
          (active === "standings" && item.label === "Standings") ||
          (active === "fixtures" && item.label === "Fixtures");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-11 items-center justify-center gap-2 px-4 text-xs font-black uppercase tracking-[0.12em] transition ${
              isActive
                ? "bg-[#0755C9] text-white shadow-[0_0_24px_rgba(54,215,255,0.22)]"
                : "text-[#C9DFEB] hover:bg-[#0797F2]/18 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
