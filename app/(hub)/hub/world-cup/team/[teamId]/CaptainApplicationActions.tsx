"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { getAccessToken } from "@/components/account/client-account";

export function CaptainApplicationActions({
  applicationId,
  teamId,
}: {
  applicationId: string;
  teamId: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "accepted" | "rejected" | "error">("idle");

  async function decide(decision: "Accepted" | "Rejected") {
    setState("saving");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Login required.");

      const response = await fetch(`/api/world-cup/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId, decision }),
      });

      if (!response.ok) throw new Error("Decision failed.");
      setState(decision === "Accepted" ? "accepted" : "rejected");
    } catch (error) {
      console.error(error);
      setState("error");
    }
  }

  if (state === "accepted") {
    return (
      <span className="inline-flex min-h-9 items-center justify-center border border-emerald-300/35 bg-emerald-400/10 px-3 text-xs font-black uppercase tracking-[0.1em] text-emerald-200">
        Accepted
      </span>
    );
  }

  if (state === "rejected") {
    return (
      <span className="inline-flex min-h-9 items-center justify-center border border-red-300/35 bg-red-400/10 px-3 text-xs font-black uppercase tracking-[0.1em] text-red-200">
        Rejected
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 xl:flex-col">
      <button
        type="button"
        onClick={() => decide("Accepted")}
        disabled={state === "saving"}
        className="inline-flex min-h-10 items-center justify-center gap-2 border border-emerald-300/35 bg-emerald-400/10 px-3 text-xs font-black uppercase tracking-[0.1em] text-emerald-100 transition hover:border-emerald-100 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Accept application"
        title="Accept application"
      >
        <Check size={16} />
        Accept Player
      </button>
      <button
        type="button"
        onClick={() => decide("Rejected")}
        disabled={state === "saving"}
        className="inline-flex min-h-10 items-center justify-center gap-2 border border-red-300/35 bg-red-400/10 px-3 text-xs font-black uppercase tracking-[0.1em] text-red-100 transition hover:border-red-100 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Reject application"
        title="Reject application"
      >
        <X size={16} />
        Reject
      </button>
      {state === "error" && (
        <span className="text-xs font-bold text-red-200">
          Failed
        </span>
      )}
    </div>
  );
}
