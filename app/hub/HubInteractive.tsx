import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HubInteractive() {
  return (
    <main className="min-h-screen bg-[#0d0d10] text-white">
      <section className="relative isolate min-h-[calc(100vh-73px)] overflow-hidden bg-[#050506]">
        <video
          className="absolute left-1/2 top-1/2 max-w-none object-cover opacity-55"
          style={{
            width: "100vh",
            height: "100vw",
            transform: "translate(-50%, -50%) rotate(-90deg) scale(1.18)",
          }}
          src="/videos/hub-hero-2.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(90deg,rgba(5,5,6,0.8),rgba(5,5,6,0.22)_45%,rgba(5,5,6,0.82)),linear-gradient(180deg,rgba(5,5,6,0.76),rgba(5,5,6,0.16)_42%,rgba(5,5,6,0.94))]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050506] to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl flex-col px-4 sm:px-6">
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <h1 className="text-[clamp(4.5rem,15vw,13rem)] font-black uppercase leading-none tracking-[0.34em] text-white [font-family:Impact,Arial_Black,Arial,sans-serif]">
              Hub
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
              A standalone ECL stat interface for player profiles, ranked
              inhouse form, champion pools, match history, and community ladder
              movement.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/hub/dashboard"
                className="inline-flex items-center justify-center gap-3 rounded-md bg-white px-8 py-4 text-base font-black text-stone-950 transition hover:bg-stone-200"
              >
                Enter the Hub
                <ArrowRight size={20} />
              </Link>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
