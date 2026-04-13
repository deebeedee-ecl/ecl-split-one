export const dynamic = "force-dynamic";

type Row = {
  leftName: string;
  leftKda: string;
  leftDmg: string;
  rightDmg: string;
  rightKda: string;
  rightName: string;
};

const rows: Row[] = [
  {
    leftName: "nidebaba#44619",
    leftKda: "12 / 3 / 12",
    leftDmg: "21.4k",
    rightDmg: "19.8k",
    rightKda: "7 / 7 / 2",
    rightName: "galore#52104",
  },
  {
    leftName: "Sheniqua#68061",
    leftKda: "5 / 0 / 6",
    leftDmg: "14.5k",
    rightDmg: "10.3k",
    rightKda: "0 / 3 / 8",
    rightName: "TARDIS#14076",
  },
  {
    leftName: "GoneSouth#00000",
    leftKda: "5 / 8 / 9",
    leftDmg: "13.7k",
    rightDmg: "16.2k",
    rightKda: "6 / 6 / 2",
    rightName: "Gnarls#00000",
  },
  {
    leftName: "3AndAHalfMen#00000",
    leftKda: "4 / 4 / 7",
    leftDmg: "11.4k",
    rightDmg: "11.5k",
    rightKda: "3 / 5 / 4",
    rightName: "Homie#00000",
  },
  {
    leftName: "TheDonger#49795",
    leftKda: "4 / 5 / 8",
    leftDmg: "7.6k",
    rightDmg: "8.8k",
    rightKda: "4 / 9 / 5",
    rightName: "KkllNoob#00000",
  },
];

function ObjectivePill({
  icon,
  value,
}: {
  icon: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
      <span className="text-xs">{icon}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function FooterBadge({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "silver";
}) {
  const styles =
    accent === "gold"
      ? "border-yellow-400/40 bg-yellow-400/15 text-yellow-300"
      : "border-white/10 bg-white/[0.04] text-white/60";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${styles}`}>
      <span className="text-[11px] font-black uppercase tracking-[0.18em]">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

export default function MockMatchPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_40px_rgba(0,255,150,0.08)]">
          <div className="border-b border-white/10 pb-4">
            <div className="text-center text-[11px] font-bold uppercase tracking-[0.26em] text-white/35">
              Game 1 • 32m 48s
            </div>

            <div className="mt-2 text-center text-6xl font-black tracking-tight text-white">
              30 - 20
            </div>

            <div className="mt-1 text-center text-lg font-bold text-white/80">
              MFGA <span className="text-white/35">vs</span> EB
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-white/10 py-4">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-black uppercase tracking-[0.06em] text-white">
                MFGA
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <ObjectivePill icon="🏰" value={2} />
                <ObjectivePill icon="🐉" value={1} />
                <ObjectivePill icon="👑" value={0} />
                <ObjectivePill icon="🔥" value={0} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ObjectivePill icon="🏰" value={1} />
                <ObjectivePill icon="🐉" value={0} />
                <ObjectivePill icon="👑" value={0} />
                <ObjectivePill icon="🔥" value={0} />
              </div>

              <span className="text-2xl font-black uppercase tracking-[0.06em] text-white">
                EB
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.2em] text-white/50">
                  <th className="w-[26%] px-3 py-3 text-left">Player</th>
                  <th className="w-[13%] px-2 py-3 text-center">KDA</th>
                  <th className="w-[11%] px-2 py-3 text-center">DMG</th>
                  <th className="w-[1%] px-0 py-3"></th>
                  <th className="w-[11%] px-2 py-3 text-center">DMG</th>
                  <th className="w-[13%] px-2 py-3 text-center">KDA</th>
                  <th className="w-[26%] px-3 py-3 text-right">Player</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.leftName}-${row.rightName}`}
                    className="border-b border-white/[0.06] text-sm transition hover:bg-green-400/[0.06]"
                  >
                    <td className="truncate px-3 py-3 text-left text-[15px] font-semibold text-white">
                      {row.leftName}
                    </td>

                    <td className="px-2 py-3 text-center text-[15px] font-bold tracking-wide text-white/90">
                      {row.leftKda}
                    </td>

                    <td className="px-2 py-3 text-center text-[16px] font-extrabold text-red-400">
                      {row.leftDmg}
                    </td>

                    <td className="px-0 py-3">
                      <div className="mx-auto h-4 w-px bg-white/5" />
                    </td>

                    <td className="px-2 py-3 text-center text-[16px] font-extrabold text-sky-400">
                      {row.rightDmg}
                    </td>

                    <td className="px-2 py-3 text-center text-[15px] font-bold tracking-wide text-white/90">
                      {row.rightKda}
                    </td>

                    <td className="truncate px-3 py-3 text-right text-[15px] font-semibold text-white">
                      {row.rightName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <FooterBadge label="MVP" value="nidebaba#44619" accent="gold" />
            <FooterBadge label="SVP" value="galore#52104" accent="silver" />
          </div>
        </div>
      </div>
    </main>
  );
}