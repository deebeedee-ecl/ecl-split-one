"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getAccessToken } from "@/components/account/client-account";
import { CaptainApplicationActions } from "./CaptainApplicationActions";

type CaptainApplication = {
  id: string;
  playerName: string;
  riotId: string;
  role: string;
  nationality: string;
  pitch: string;
  status: string;
  captainDecision: string;
  profileId: string;
};

export function CaptainApplicationsPanel({ teamId }: { teamId: string }) {
  const [applications, setApplications] = useState<CaptainApplication[]>([]);
  const [state, setState] = useState<"loading" | "captain" | "hidden" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled) setState("hidden");
          return;
        }

        const response = await fetch(`/api/world-cup/team/${teamId}/applications`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (response.status === 403 || response.status === 401) {
          if (!cancelled) setState("hidden");
          return;
        }

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load applications.");

        if (!cancelled) {
          setApplications(Array.isArray(payload.applications) ? payload.applications : []);
          setState("captain");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (state === "hidden" || state === "loading") return null;

  return (
    <section className="overflow-hidden border border-[#2d6bff]/30 bg-[#081431]/92">
      <h2 className="border-b border-[#69a7ff]/14 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white">
        Captain Applications
      </h2>
      {state === "error" ? (
        <p className="p-5 text-sm font-semibold text-red-200">Applications could not be loaded.</p>
      ) : applications.length === 0 ? (
        <p className="p-5 text-sm font-semibold text-[#aebfe4]">No applications yet.</p>
      ) : (
        <div className="divide-y divide-[#69a7ff]/12">
          {applications.map((application) => (
            <div key={application.id} className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_10rem] xl:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-black text-white">{application.playerName}</p>
                    <p className="mt-1 break-all text-xs font-bold text-[#8094c2]">{application.riotId}</p>
                  </div>
                  <span className="border border-[#69a7ff]/18 bg-[#020817]/50 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#8dbbff]">
                    {application.captainDecision || application.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-xs font-bold text-[#aebfe4] md:grid-cols-3">
                  <span>{application.role}</span>
                  <span>{application.nationality}</span>
                  {application.profileId ? (
                    <Link
                      href={`/hub/players/${application.profileId}`}
                      className="inline-flex items-center gap-1 text-[#77CFFF] transition hover:text-white"
                    >
                      Review Profile
                      <ExternalLink size={12} />
                    </Link>
                  ) : (
                    <span>Profile pending</span>
                  )}
                </div>
                {application.pitch && (
                  <p className="mt-3 border-l-2 border-[#69a7ff]/35 pl-3 text-sm font-semibold leading-6 text-[#d7e6ff]">
                    {application.pitch}
                  </p>
                )}
              </div>
              <CaptainApplicationActions applicationId={application.id} teamId={teamId} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
