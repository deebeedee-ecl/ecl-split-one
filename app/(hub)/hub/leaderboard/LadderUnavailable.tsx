"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

export default function LadderUnavailable({ retry }: { retry?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section className="border border-white/10 bg-[#191d29] p-6 sm:p-8" role="alert">
      <CircleAlert size={26} className="text-[#8ca3ff]" />
      <h2 className="mt-4 text-2xl font-bold text-white">The ladder couldn&apos;t load.</h2>
      <p className="mt-3 max-w-lg text-sm leading-7 text-[#b0b8cb]">
        Standings are temporarily unavailable. Please try again shortly.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => retry ? retry() : router.refresh())}
          className="inline-flex min-h-11 items-center gap-2 bg-[#0035f8] px-4 text-sm font-bold text-white hover:bg-[#0028c2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8ca3ff] disabled:opacity-60"
        >
          <RotateCcw size={16} />{pending ? "Trying again…" : "Try again"}
        </button>
        <Link href="/hub/dashboard" className="text-sm text-[#b8c6ff] underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
