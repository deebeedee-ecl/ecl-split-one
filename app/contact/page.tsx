export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-8 shadow-[0_0_80px_rgba(74,222,128,0.08)] md:p-12">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-green-400">
              Expat China League
            </p>

            <h1 className="mt-5 text-5xl font-black uppercase tracking-tight md:text-7xl">
              Contact
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
              Join the ECL community, get tournament support, and reach out for
              questions about teams, free agency, rules, scheduling, or admin issues.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Community Platform
              </p>
              <p className="mt-2 text-xl font-bold text-white">KOOK</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Community Access
              </p>
              <p className="mt-2 text-xl font-bold text-white">KOOK + WeChat</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Admin Support
              </p>
              <p className="mt-2 text-xl font-bold text-white">Joe / Soul</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)] md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
              Join the Community
            </p>

            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">
              Official ECL KOOK Server
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
              Join the official ECL KOOK server for match scheduling, announcements,
              tournament coordination, community chat, and league updates.
            </p>

            <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 md:p-10">
              <div className="flex flex-col items-center justify-center text-center">
                <a
                  href="https://www.kookapp.cn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-72 w-72 items-center justify-center rounded-[2.5rem] border border-white/10 bg-white p-8 transition duration-300 ease-out hover:scale-[1.15] hover:-translate-y-3 active:scale-[0.95]"
                >
                  <img
                    src="/kook-logo.png"
                    alt="KOOK"
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                  />
                </a>

                <p className="mt-6 text-sm leading-7 text-zinc-400">
                  Click the KOOK logo to visit the official platform website.
                </p>

                <a
                  href="https://kook.vip/gWdaaw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex rounded-2xl border border-green-400/20 bg-green-400/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-green-300 transition hover:-translate-y-0.5 hover:border-green-400/40 hover:bg-green-400/15"
                >
                  Join ECL KOOK Server
                </a>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">
                WeChat Group
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-200">
                WeChat is also used for broader community contact and updates.
                If you need access, join through KOOK first or contact an admin for help.
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)] md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Admin Contact
              </p>

              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">
                Need Help?
              </h2>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Admin</p>
                  <p className="mt-2 text-2xl font-black uppercase text-white">Joe</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Admin</p>
                  <p className="mt-2 text-2xl font-black uppercase text-white">Soul</p>
                </div>
              </div>

              <p className="mt-6 text-sm leading-7 text-zinc-400">
                Contact admins for disputes, registration issues, roster questions,
                scheduling problems, or community access support.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)] md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-green-400">
                Contact Form
              </p>

              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">
                Send a Message
              </h2>

              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Use this form for general questions, support requests, or tournament-related issues.
              </p>

              <form className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30 focus:bg-white/[0.06]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Contact
                  </label>
                  <input
                    type="text"
                    placeholder="Email, Discord, or WeChat"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30 focus:bg-white/[0.06]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Topic
                  </label>
                  <select className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-green-400/30 focus:bg-white/[0.06]">
                    <option value="">Select a topic</option>
                    <option value="general">General Question</option>
                    <option value="team">Team Registration</option>
                    <option value="free-agent">Free Agent Help</option>
                    <option value="rules">Rules / Dispute</option>
                    <option value="community">Community Join</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Write your message here..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-green-400/30 focus:bg-white/[0.06]"
                  />
                </div>

                <button
                  type="button"
                  className="inline-flex rounded-2xl border border-green-400/20 bg-green-400/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-green-300 transition hover:-translate-y-0.5 hover:border-green-400/40 hover:bg-green-400/15"
                >
                  Submit
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}