import Image from "next/image";
import Link from "next/link";
import { HubShell } from "../_components/HubShell";

type Role = "TOP" | "JNG" | "MID" | "ADC" | "SUPP" | "FILL";

type PlayerCard = {
  name: string;
  slug: string;
  rank: number;
  roles: Role[];
};

const roleIcons: Record<Role, string> = {
  TOP: "/lol/roles/top.png",
  JNG: "/lol/roles/jungle.png",
  MID: "/lol/roles/mid.png",
  ADC: "/lol/roles/bot.png",
  SUPP: "/lol/roles/support.png",
  FILL: "/lol/roles/fill.png",
};

const players: PlayerCard[] = [
  { name: "deebeedee", slug: "deebeedee", rank: 1, roles: ["MID", "SUPP"] },
  { name: "Storm", slug: "storm", rank: 2, roles: ["ADC", "MID"] },
  { name: "Night", slug: "night", rank: 3, roles: ["JNG", "TOP"] },
  { name: "Killer", slug: "killer", rank: 4, roles: ["TOP", "ADC"] },
  { name: "Anchor", slug: "anchor", rank: 5, roles: ["SUPP", "JNG"] },
  { name: "Shadow", slug: "shadow", rank: 6, roles: ["MID", "ADC"] },
  { name: "Vortex", slug: "vortex", rank: 7, roles: ["TOP", "SUPP"] },
  { name: "Bolt", slug: "bolt", rank: 8, roles: ["ADC", "FILL"] },
  { name: "Rift", slug: "rift", rank: 9, roles: ["JNG", "MID"] },
  { name: "Echo", slug: "echo", rank: 10, roles: ["SUPP", "ADC"] },
  { name: "Nova", slug: "nova", rank: 11, roles: ["MID", "TOP"] },
  { name: "Pulse", slug: "pulse", rank: 12, roles: ["ADC", "SUPP"] },
  { name: "Cipher", slug: "cipher", rank: 13, roles: ["JNG", "FILL"] },
  { name: "Atlas", slug: "atlas", rank: 14, roles: ["TOP", "JNG"] },
  { name: "Drift", slug: "drift", rank: 15, roles: ["MID", "FILL"] },
  { name: "Flux", slug: "flux", rank: 16, roles: ["SUPP", "MID"] },
  { name: "Blitz", slug: "blitz", rank: 17, roles: ["ADC", "JNG"] },
  { name: "Rune", slug: "rune", rank: 18, roles: ["TOP", "MID"] },
  { name: "Glint", slug: "glint", rank: 19, roles: ["SUPP", "FILL"] },
  { name: "Frost", slug: "frost", rank: 20, roles: ["JNG", "TOP"] },
  { name: "Ember", slug: "ember", rank: 21, roles: ["ADC", "MID"] },
  { name: "Slate", slug: "slate", rank: 22, roles: ["TOP", "FILL"] },
  { name: "Vale", slug: "vale", rank: 23, roles: ["SUPP", "ADC"] },
  { name: "Quest", slug: "quest", rank: 24, roles: ["MID", "JNG"] },
];

export default function PlayersPage() {
  return (
    <HubShell
      active="players"
      eyebrow="Player Directory"
      title="Players"
      description="Verified ECL player profiles, roles, KOOK verification, and League identity records."
    >
      <section className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {players.map((player) => (
            <Link
              key={player.name}
              href={`/hub/players/${player.slug}`}
              className="group relative min-h-[6.55rem] overflow-hidden rounded-[0.9rem] border border-white/10 bg-[#111217] p-3 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_10px_28px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:scale-[1.025] hover:border-[#ff1728]/55 hover:shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_18px_46px_rgba(0,0,0,0.52),0_0_24px_rgba(255,23,40,0.12)]"
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-[0.9rem]"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.1), transparent 28%), radial-gradient(circle at 88% 6%, rgba(255,23,40,0.18), transparent 42%), linear-gradient(180deg, rgba(255,216,77,0.055), transparent 58%)",
                }}
              />
              <div className="pointer-events-none absolute inset-[1px] rounded-[0.85rem] border border-white/[0.045]" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-[#ff1728] via-[#ff4058] to-transparent opacity-85" />
              <div className="relative flex h-full flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black leading-none text-white transition group-hover:text-[#ffd84d]">
                      {player.name}
                    </h2>
                    <p className="mt-2 inline-flex rounded-full border border-[#ffd84d]/25 bg-[#ffd84d]/10 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#ffd84d]">
                      #{player.rank}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    {player.roles.map((role) => (
                      <span
                        key={`${player.name}-${role}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ffd84d]/25 bg-[#ff1728]/18 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_0_18px_rgba(255,23,40,0.2)]"
                        title={roleLabel(role)}
                      >
                        <Image
                          src={roleIcons[role]}
                          alt={roleLabel(role)}
                          width={23}
                          height={23}
                          className="opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.22)]"
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <span />
                  <span className="h-1.5 w-10 rounded-full bg-[#ff1728]" />
                </div>
              </div>
            </Link>
        ))}
      </section>
    </HubShell>
  );
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    TOP: "Top",
    JNG: "Jungle",
    MID: "Middle",
    ADC: "Bottom",
    SUPP: "Support",
    FILL: "Fill",
  };

  return labels[role];
}
