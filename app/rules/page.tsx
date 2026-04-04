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
            Split One is designed to be competitive, fair, and enjoyable, while remaining
            accessible to a wide range of players.
          </p>
          <p className="mt-4">
            These rules exist to provide clear structure for teams, match play, roster building,
            scheduling, and disputes. By entering the tournament, all players agree to follow the
            official ECL rules and accept admin rulings made throughout the event.
          </p>
        </>
      ),
    },
    {
      number: "02",
      title: "Split One Format",
      content: (
        <ul className="space-y-3">
          <li>• Split One begins with a <span className="font-semibold text-white">single round-robin stage</span></li>
          <li>• Regular season matches are <span className="font-semibold text-white">Best of 2</span></li>
          <li>• Teams progress into a <span className="font-semibold text-white">single elimination knockout stage</span> after the round-robin stage</li>
          <li>• Knockout matches are played as <span className="font-semibold text-white">Best of 3</span></li>
          <li>• <span className="font-semibold text-white">Fearless Draft</span> is active during knockout matches</li>
          <li>• Fearless Draft resets in the <span className="font-semibold text-white">Semifinals</span></li>
          <li>• Fearless Draft resets again in the <span className="font-semibold text-white">Finals</span></li>
        </ul>
      ),
    },
    {
      number: "03",
      title: "Match Scheduling",
      content: (
        <>
          <ul className="space-y-3">
            <li>• Matches must be scheduled <span className="font-semibold text-white">at least 24 hours in advance</span></li>
            <li>• Teams must use <span className="font-semibold text-white">KOOK</span> to confirm match times and coordination</li>
            <li>• Official scheduling procedure will be confirmed by ECL admins</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
              Delays & No-Shows
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• A no-show results in an automatic <span className="font-semibold text-white">2-0 loss</span></li>
              <li>• Cancelling without agreement may result in an automatic <span className="font-semibold text-white">2-0 loss</span></li>
              <li>• If a team causes a delay of <span className="font-semibold text-white">more than 1 hour</span>, the opposing team may leave and request an <span className="font-semibold text-white">admin-awarded win</span></li>
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
            <li>• After each match, the <span className="font-semibold text-white">winning captain</span> must report the result</li>
            <li>• Results must be submitted through the <span className="font-semibold text-white">official ECL reporting process</span></li>
            <li>• Admins may request screenshots or additional proof where needed</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">
              Reporting Note
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Automated reporting tools are currently under construction. Until finalized, ECL admins
              will confirm the accepted reporting method.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Result Finality
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Match results are considered <span className="font-semibold text-white">official once submitted</span>,
              unless a formal dispute is raised and reviewed by admins.
            </p>
          </div>
        </>
      ),
    },
    {
      number: "05",
      title: "Roster Rules",
      content: (
        <>
          <p>
            Each team may register a maximum of <span className="font-semibold text-white">7 players</span>.
          </p>

          <div className="mt-6 rounded-[1.75rem] border border-green-400/20 bg-gradient-to-br from-green-400/10 via-green-400/[0.06] to-transparent p-6 shadow-[0_0_35px_rgba(74,222,128,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-300">
              Rank Determination
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              A player’s tournament rank is determined using their <span className="font-semibold text-white">highest proven rank across any region</span>
              (including CN, NA, EUW, and others) within the past <span className="font-semibold text-white">three seasons</span>.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              If a player is currently active, admins may also consider that player’s
              <span className="font-semibold text-white"> highest rank between Solo Queue and Flex Queue</span>.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Players with fewer than <span className="font-semibold text-white">30 ranked games</span> may be treated as
              <span className="font-semibold text-white"> provisional</span> and reviewed further.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Admins reserve the right to place a player in a <span className="font-semibold text-white">higher competitive tier</span>
              if their listed rank does not accurately reflect their true level.
            </p>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-green-400/20 bg-gradient-to-br from-green-400/10 via-green-400/[0.06] to-transparent p-6 shadow-[0_0_35px_rgba(74,222,128,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-300">
              Maximum Allowed Per Roster
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Roster Limits</p>
                <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
                  <li>• <span className="font-semibold text-white">1 Masters+ player</span> maximum</li>
                  <li>• <span className="font-semibold text-white">1 Diamond player</span> maximum</li>
                  <li>• <span className="font-semibold text-white">1 Emerald player</span> maximum</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Substitute Requirement</p>
                <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
                  <li>• At least <span className="font-semibold text-white">one substitute</span> on the 7-player roster must be <span className="font-semibold text-white">Silver or below</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-green-400/20 bg-gradient-to-br from-green-400/10 via-green-400/[0.06] to-transparent p-6 shadow-[0_0_35px_rgba(74,222,128,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-300">
              Active Lineup Rules
            </p>

            <div className="mt-5 rounded-2xl border border-green-400/15 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Per Game</p>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
                <li>• All rank restrictions apply to the <span className="font-semibold text-white">5 players actually playing each game</span></li>
                <li>• A lineup may include a maximum of <span className="font-semibold text-white">1 Masters+ player</span></li>
                <li>• A lineup may include a maximum of <span className="font-semibold text-white">1 Diamond player</span></li>
                <li>• A lineup may include a maximum of <span className="font-semibold text-white">1 Emerald player</span></li>
                <li>• Every lineup must include at least <span className="font-semibold text-white">1 Silver-or-below player</span></li>
              </ul>
            </div>

            <div className="mt-5 rounded-2xl border border-green-400/15 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Substitution Rule</p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                Substitutions are only legal if the new five-player lineup remains fully compliant
                with all active lineup restrictions.
              </p>
            </div>
          </div>
        </>
      ),
    },
    {
      number: "06",
      title: "Substitutions & Lineups",
      content: (
        <>
          <ul className="space-y-3">
            <li>• Teams must confirm their match lineup <span className="font-semibold text-white">at least 1 hour before the match</span></li>
            <li>• Any substitution between games in a BO2 or BO3 must be communicated before the next game begins</li>
            <li>• All substitute players must be officially registered and approved</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Substitute Rules
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• At least <span className="font-semibold text-white">one substitute must be Silver or below</span></li>
              <li>• All substitutes must still follow roster and active lineup restrictions</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      number: "07",
      title: "Gameplay Rules",
      content: (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Server
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                All matches must be played on <span className="font-semibold text-white">Ionia</span>.
              </p>
            </div>

            <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
                Registered Accounts Only
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                Players must play on their <span className="font-semibold text-white">registered account</span>.
                Use of an unregistered account results in an automatic <span className="font-semibold text-white">2-0 loss</span>.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Tournament Draft & Role Flex
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• All matches must be played using <span className="font-semibold text-white">Tournament Draft Mode</span></li>
              <li>• Role swaps are allowed, but must be decided <span className="font-semibold text-white">before entering champion select</span></li>
              <li>• Teams must still comply with role setup requirements enforced by the client</li>
            </ul>
          </div>
        </>
      ),
    },
    {
      number: "08",
      title: "Remakes & Pauses",
      content: (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Remakes
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• Remakes may only be considered for serious early-game technical issues</li>
              <li>• Admins may request evidence before approving a remake</li>
              <li>• Once the game has meaningfully progressed, a remake is unlikely to be granted</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Pauses
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• There is <span className="font-semibold text-white">no guaranteed pause system</span></li>
              <li>• There is <span className="font-semibold text-white">no chronobreak system</span></li>
              <li>• Teams are expected to play through issues unless admins intervene</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      number: "09",
      title: "Competitive Integrity",
      content: (
        <>
          <p>
            ECL enforces strict standards for fair competition.
          </p>

          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
              Prohibited
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• Account sharing</li>
              <li>• Smurfing or incorrect rank declaration</li>
              <li>• Fraudulent registration</li>
              <li>• Use of undeclared off-region peak rank to gain a lower classification</li>
              <li>• Any attempt to gain an unfair competitive advantage</li>
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Reporting Suspicion
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              If suspicious activity occurs, teams should record evidence where possible and submit it to admins for review.
              Violations may result in match forfeits, tournament removal, or bans from future events.
            </p>
          </div>
        </>
      ),
    },
    {
      number: "10",
      title: "Conduct Rules",
      content: (
        <>
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
              Zero-Tolerance Conduct Standard
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• Insults</li>
              <li>• Harassment</li>
              <li>• Excessive toxicity</li>
              <li>• Abusive or offensive language</li>
              <li>• Unsportsmanlike behaviour</li>
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Possible Penalties
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-200">
              <li>• Warnings</li>
              <li>• Match penalties</li>
              <li>• Tournament disqualification</li>
              <li>• Bans from future tournaments</li>
            </ul>
            <p className="mt-4 text-sm leading-7 text-zinc-200">
              Severe cases may result in <span className="font-semibold text-white">immediate multi-tournament bans</span>.
            </p>
          </div>
        </>
      ),
    },
    {
      number: "11",
      title: "Disputes & Admin Decisions",
      content: (
        <>
          <p className="leading-7 text-zinc-200">
            If a team wishes to raise a dispute, they must contact:
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Admin</p>
              <p className="mt-2 text-2xl font-black uppercase text-white">Joe</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Admin</p>
              <p className="mt-2 text-2xl font-black uppercase text-white">Soul</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-300">
              Final Authority
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-200">
              Admin decisions are <span className="font-semibold text-white">final</span>. This applies to rank rulings,
              roster rulings, gameplay rulings, conduct rulings, and all tournament-related decisions.
            </p>
          </div>
        </>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-8 shadow-[0_0_80px_rgba(74,222,128,0.08)] md:p-12">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-green-400">
              Expat China League
            </p>

            <h1 className="mt-5 text-5xl font-black uppercase tracking-tight md:text-7xl">
              Rules
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
              Official rules for ECL Split One. These guidelines exist to keep the
              tournament fair, balanced, competitive, and enjoyable for everyone involved.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tournament</p>
              <p className="mt-2 text-xl font-bold text-white">ECL Split One</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Server</p>
              <p className="mt-2 text-xl font-bold text-white">Ionia</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Match Reporting</p>
              <p className="mt-2 text-xl font-bold text-white">Admin Confirmed</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 xl:sticky xl:top-24">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
              Quick Nav
            </p>

            <div className="mt-5 space-y-2">
              {sections.map((section) => (
                <a
                  key={section.number}
                  href={`#section-${section.number}`}
                  className="block rounded-xl border border-transparent px-3 py-3 text-sm text-zinc-300 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                >
                  <span className="mr-2 text-zinc-500">{section.number}</span>
                  {section.title}
                </a>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.number}
                id={`#section-${section.number}`.replace("#", "")}
                className="scroll-mt-24 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)] md:p-8"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                      Section {section.number}
                    </p>
                    <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">
                      {section.title}
                    </h2>
                  </div>
                </div>

                <div className="mt-6 text-base leading-8 text-zinc-300">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}