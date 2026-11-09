const sections = [
  {
    number: "01",
    title: "Community Standard",
    body: [
      "ECL is a competitive League of Legends community for players in China. Everyone is expected to treat other players, captains, admins, casters, and volunteers with basic respect.",
      "Harassment, hate speech, threats, targeted abuse, repeated toxicity, and attempts to disrupt events may result in warnings, match penalties, removal from the Hub, or bans from ECL spaces.",
    ],
  },
  {
    number: "02",
    title: "Accounts & Identity",
    body: [
      "Players must register with accurate account details and use the Riot ID, China server, and KOOK identity connected to their ECL profile.",
      "Account sharing, smurfing, hiding rank history, false registration details, or playing on an unapproved account can lead to match forfeits or account suspension.",
    ],
  },
  {
    number: "03",
    title: "KOOK & League Participation",
    body: [
      "KOOK is the primary coordination space for verification, queues, match organization, announcements, and admin contact.",
      "Players are responsible for checking official ECL updates, responding to admin requests, and keeping their contact details current.",
    ],
  },
  {
    number: "04",
    title: "Match Integrity",
    body: [
      "Players must compete fairly, avoid intentional griefing, and follow the match format announced by admins for each event or inhouse session.",
      "Cheating, scripting, win trading, intentional feeding, ghosting, or any attempt to gain an unfair advantage is prohibited.",
    ],
  },
  {
    number: "05",
    title: "Results & Records",
    body: [
      "ECL may store match results, player statistics, champion data, awards, ELO history, and moderation records for league operations.",
      "Admins may correct obvious data errors, duplicate reports, or invalid match records when needed to protect the accuracy of the league.",
    ],
  },
  {
    number: "06",
    title: "Disputes",
    body: [
      "Disputes should be raised through the Contact page or directly through the official KOOK admin flow. Include match details, player names, screenshots, and a clear explanation.",
      "Admin decisions are final for match rulings, roster rulings, conduct rulings, rank rulings, and access to ECL community spaces.",
    ],
  },
  {
    number: "07",
    title: "Beta Terms",
    body: [
      "The Hub is launching in beta. Features, profile data, rankings, inhouse records, and integrations may change while the system is stabilized.",
      "ECL will make reasonable efforts to preserve accurate competitive records, but beta features may be adjusted, corrected, or temporarily disabled during launch.",
    ],
  },
  {
    number: "08",
    title: "Privacy & Contact",
    body: [
      "ECL uses submitted information to operate accounts, verify players, coordinate matches, handle support requests, and maintain community safety.",
      "Do not submit private information about another person unless it is necessary for a legitimate admin report. Contact admins if you need a profile or message reviewed.",
    ],
  },
];

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-20 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden border border-[#1f1f1f] bg-[#0d0d0d] p-8 md:p-12">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.24),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(209,26,42,0.18),transparent_30%)]" />
          <div className="relative max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b11226]">
              ECL Beta
            </p>
            <h1 className="mt-5 text-[clamp(3.4rem,8vw,7rem)] font-black uppercase leading-[0.9] text-white [font-family:Anton,Impact,Arial_Black,Arial,sans-serif]">
              Terms & Community Rules
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-[#9ca3af]">
              These rules keep the ECL community competitive, readable, and fair.
              By using the Hub, joining KOOK, registering for events, or playing
              ECL inhouses, you agree to follow these standards.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="h-fit border border-[#1f1f1f] bg-[#0d0d0d] p-5 lg:sticky lg:top-24">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b11226]">
              Sections
            </p>
            <nav className="mt-4 space-y-1">
              {sections.map((section) => (
                <a
                  key={section.number}
                  href={`#section-${section.number}`}
                  className="block px-3 py-3 text-sm font-bold text-[#9ca3af] transition hover:bg-[#b11226]/10 hover:text-white"
                >
                  <span className="mr-2 text-[#b11226]">{section.number}</span>
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-5">
            {sections.map((section) => (
              <section
                key={section.number}
                id={`section-${section.number}`}
                className="scroll-mt-24 border border-[#1f1f1f] bg-[#0d0d0d] p-6 md:p-8"
              >
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b11226]">
                  Section {section.number}
                </p>
                <h2 className="mt-3 text-3xl font-black uppercase text-white">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-4 text-base leading-8 text-[#c6cbd3]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
