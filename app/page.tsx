import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-8">
          <Image
            src="/ecl-logo.png"
            alt="ECL Logo"
            width={180}
            height={180}
            priority
          />
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-green-400">
          ECL
        </p>

        <h1 className="mt-4 text-5xl font-black uppercase tracking-tight md:text-7xl">
          Split One
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-zinc-300">
          Shanghai League of Legends tournament portal for premade teams,
          free agents, standings, schedules, and match submissions.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="/register/team"
            className="rounded-2xl bg-green-400 px-6 py-3 font-bold text-black transition hover:bg-green-300"
          >
            Register Team
          </a>

          <a
            href="/register/free-agent"
            className="rounded-2xl border border-white/20 px-6 py-3 font-bold text-white transition hover:bg-white/10"
          >
            Join as Free Agent
          </a>
        </div>
      </section>
    </main>
  );
}