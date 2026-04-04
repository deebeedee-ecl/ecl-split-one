export default function RulesPage() {
  const sections = [
    {
      number: "01",
      title: "Overview",
      content: (
        <>
          <p>
            The <span className="font-semibold text-white">Expat China League (ECL)</span> is a
            community League of Legends competition for expat players on the Chinese server.
            Split One is designed to be competitive, fair, and enjoyable while remaining accessible
            to a wide range of players.
          </p>
          <p className="mt-4">
            By participating in ECL, all players agree to follow these rules and accept all
            administrative decisions made throughout the tournament.
          </p>
        </>
      ),
    },

    {
      number: "02",
      title: "Split One Format",
      content: (
        <ul className="space-y-3">
          <li>• Regular season is a <span className="font-semibold text-white">single round-robin</span></li>
          <li>• Matches are played as <span className="font-semibold text-white">Best of 2</span></li>
          <li>• Teams are ranked based on official results recorded by ECL admins</li>
          <li>• Top teams advance to a <span className="font-semibold text-white">single-elimination knockout stage</span></li>
          <li>• Knockout matches are <span className="font-semibold text-white">Best of 3</span></li>
          <li>• <span className="font-semibold text-white">Fearless Draft</span> applies in knockout stage</li>
          <li>• Fearless Draft resets in <span className="font-semibold text-white">Semifinals</span> and <span className="font-semibold text-white">Finals</span></li>
        </ul>
      ),
    },

    {
      number: "03",
      title: "Match Scheduling",
      content: (
        <>
          <ul className="space-y-3">
            <li>• Matches must be scheduled at least <span className="font-semibold text-white">24 hours in advance</span></li>
            <li>• Teams must coordinate and confirm match times via <span className="font-semibold text-white">KOOK</span></li>
            <li>• Official scheduling method will be confirmed by ECL admins</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
              Delays & No-Shows
            </p>
            <ul className="mt-3 space-y-3 text-sm text-zinc-200">
              <li>• No-show = automatic <span className="font-semibold text-white">2-0 loss</span></li>
              <li>• Cancelling without agreement may result in a <span className="font-semibold text-white">2-0 loss</span></li>
              <li>• Delays over <span className="font-semibold text-white">1 hour</span> may result in an admin-awarded win</li>
            </ul>
          </div>
        </>
      ),
    },

    {
      number: "04",
      title: "Match Results",
      content: (
        <>
          <ul className="space-y-3">
            <li>• The <span className="font-semibold text-white">winning captain</span> must report match results</li>
            <li>• Results must be submitted through the <span className="font-semibold text-white">official ECL reporting process</span></li>
            <li>• Admins may request screenshots or additional proof</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
            <p className="text-sm font-semibold text-blue-300">Reporting System</p>
            <p className="mt-2 text-sm text-zinc-200">
              Automated reporting systems are under development. Admins will confirm valid reporting methods.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-zinc-400">Result Disputes</p>
            <p className="mt-2 text-sm text-zinc-200">
              Results are considered final unless a dispute is raised and reviewed by admins.
            </p>
          </div>
        </>
      ),
    },

    {
      number: "05",
      title: "Roster & Rank Rules",
      content: (
        <>
          <p>
            Each team may register a maximum of <span className="font-semibold text-white">7 players</span>.
          </p>

          <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
            <p className="text-sm font-semibold text-green-300 uppercase">Rank Determination</p>

            <p className="mt-3 text-sm text-zinc-200">
              A player’s tournament rank is based on the <span className="font-semibold text-white">highest rank achieved across any region</span>
              (CN, NA, EUW, etc.) within the past <span className="font-semibold text-white">three seasons</span>.
            </p>

            <p className="mt-3 text-sm text-zinc-200">
              If a player is currently active, their rank may be evaluated using their <span className="font-semibold text-white">highest rank between Solo Queue and Flex Queue</span>.
            </p>

            <p className="mt-3 text-sm text-zinc-200">
              Players with fewer than <span className="font-semibold text-white">30 ranked games</span> may be considered provisional and reviewed by admins.
            </p>

            <p className="mt-3 text-sm text-zinc-200">
              Admins reserve the right to assign a player to a higher tier if their rank does not reflect their true level.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
            <p className="text-sm font-semibold text-green-300 uppercase">Roster Limits</p>

            <ul className="mt-3 space-y-3 text-sm text-zinc-200">
              <li>• Max <span className="font-semibold text-white">1 Masters+</span></li>
              <li>• Max <span className="font-semibold text-white">1 Diamond</span></li>
              <li>• Max <span className="font-semibold text-white">1 Emerald</span></li>
              <li>• At least <span className="font-semibold text-white">1 Silver or below</span> on roster</li>
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
            <p className="text-sm font-semibold text-green-300 uppercase">Active Lineup Rules</p>

            <ul className="mt-3 space-y-3 text-sm text-zinc-200">
              <li>• Rules apply to the <span className="font-semibold text-white">5 players in each game</span></li>
              <li>• Max <span className="font-semibold text-white">1 Masters+</span></li>
              <li>• Max <span className="font-semibold text-white">1 Diamond</span></li>
              <li>• Max <span className="font-semibold text-white">1 Emerald</span></li>
              <li>• Must include <span className="font-semibold text-white">1 Silver or below</span></li>
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-zinc-400">Substitutions</p>
            <p className="mt-2 text-sm text-zinc-200">
              Substitutions are only allowed if the new lineup remains fully compliant with all rules.
            </p>
          </div>
        </>
      ),
    },

    {
      number: "06",
      title: "Gameplay Rules",
      content: (
        <>
          <ul className="space-y-3">
            <li>• All matches must be played on <span className="font-semibold text-white">Ionia</span></li>
            <li>• Players must use their <span className="font-semibold text-white">registered account</span></li>
            <li>• Tournament Draft mode is required</li>
            <li>• Role swaps must be decided before champion select</li>
          </ul>
        </>
      ),
    },

    {
      number: "07",
      title: "Remakes & Pauses",
      content: (
        <>
          <ul className="space-y-3">
            <li>• No guaranteed pause system</li>
            <li>• No chronobreak</li>
            <li>• Admins may decide outcomes in extreme cases</li>
          </ul>
        </>
      ),
    },

    {
      number: "08",
      title: "Competitive Integrity",
      content: (
        <>
          <ul className="space-y-3">
            <li>• No account sharing</li>
            <li>• No smurfing or false rank</li>
            <li>• No fraudulent registration</li>
            <li>• No unfair advantage</li>
          </ul>
        </>
      ),
    },

    {
      number: "09",
      title: "Conduct Rules",
      content: (
        <>
          <ul className="space-y-3">
            <li>• No harassment or toxicity</li>
            <li>• No abusive language</li>
            <li>• No unsportsmanlike behaviour</li>
          </ul>
        </>
      ),
    },

    {
      number: "10",
      title: "Admin Decisions",
      content: (
        <p>
          All admin decisions are final.
        </p>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {sections.map((section) => (
          <section key={section.number} className="p-6 border border-white/10 rounded-2xl">
            <h2 className="text-2xl font-bold">
              {section.number}. {section.title}
            </h2>
            <div className="mt-4">{section.content}</div>
          </section>
        ))}
      </div>
    </main>
  );
}