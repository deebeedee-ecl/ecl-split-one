"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, ShieldCheck, UserPlus, Users } from "lucide-react";
import { getAccessToken } from "@/components/account/client-account";
import { HubShell } from "../../_components/HubShell";
import { WorldCupNav } from "../WorldCupNav";

type MyWorldCupTeam =
  | {
      status: "captain" | "member";
      role: "captain" | "member";
      team: {
        id: string;
        name: string;
        status: string;
        captainName: string;
        rosterCount: number;
      };
    }
  | {
      status: "applied";
      role: "applicant";
      application: {
        id: string;
        status: string;
        requestedTeamId: string;
        requestedTeam: string;
        captainDecision: string;
        submittedAt: string;
      };
    }
  | { status: "none"; role: "none" }
  | { status: "no-profile" };

export default function MyWorldCupTeamPage() {
  const router = useRouter();
  const [data, setData] = useState<MyWorldCupTeam | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");

      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Log in to view your World Cup team.");

        const response = await fetch("/api/world-cup/my-team", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Could not load your World Cup team.");
        if (!cancelled) {
          if ((payload.status === "captain" || payload.status === "member") && payload.team?.id) {
            router.replace(`/hub/world-cup/team/${payload.team.id}`);
            return;
          }

          setData(payload);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your World Cup team.");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <HubShell
      active="world-cup"
      eyebrow="World Cup"
      title="My World Cup Team"
      description="Your personal World Cup roster, application, or captain dashboard."
      theme="blue"
      hideHeader
    >
      <header className="mb-5 border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#36D7FF]">
          World Cup
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
          My Team
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C9DFEB]">
          This page follows your logged-in Hub profile and opens the right World Cup view for you.
        </p>
      </header>

      <WorldCupNav active="teams" />

      {!data && !error && (
        <StateCard icon={<ClipboardList size={22} />} title="Checking Your Roster" text="Finding your World Cup team..." />
      )}

      {error && (
        <StateCard icon={<Users size={22} />} title="Team Check Failed" text={error}>
          <LinkButton href="/login" label="Log In" />
        </StateCard>
      )}

      {data?.status === "captain" && (
        <StateCard
          icon={<ShieldCheck size={22} />}
          title={`Captain: ${data.team.name}`}
          text={`Roster ${Math.min(data.team.rosterCount, 6)}/6. Team status: ${data.team.status}.`}
        >
          <LinkButton href={`/hub/world-cup/team/${data.team.id}`} label="Open Captain Dashboard" />
        </StateCard>
      )}

      {data?.status === "member" && (
        <StateCard
          icon={<Users size={22} />}
          title={data.team.name}
          text={`You are on this World Cup roster. Captain: ${data.team.captainName}. Team status: ${data.team.status}.`}
        >
          <LinkButton href={`/hub/world-cup/team/${data.team.id}`} label="View Team" />
        </StateCard>
      )}

      {data?.status === "applied" && (
        <StateCard
          icon={<UserPlus size={22} />}
          title="Application Sent"
          text={`Requested team: ${data.application.requestedTeam || "Free agency"}. Captain decision: ${data.application.captainDecision || "Pending"}.`}
        >
          <LinkButton href="/hub/world-cup/find-team" label="Team Board" />
        </StateCard>
      )}

      {data?.status === "none" && (
        <StateCard
          icon={<Users size={22} />}
          title="No World Cup Team Yet"
          text="You are not currently linked to a World Cup roster or application."
        >
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/hub/world-cup/apply" label="Apply For Team" />
            <LinkButton href="/hub/world-cup/create-team" label="Create Team" secondary />
          </div>
        </StateCard>
      )}

      {data?.status === "no-profile" && (
        <StateCard icon={<Users size={22} />} title="Hub Profile Needed" text="Create your Hub profile before joining the World Cup flow.">
          <LinkButton href="/hub/settings" label="Open Profile" />
        </StateCard>
      )}
    </HubShell>
  );
}

function StateCard({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-8 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-3 text-[#77CFFF]">{icon}</div>
      <h2 className="mt-5 text-3xl font-black uppercase text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#C9DFEB]">{text}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

function LinkButton({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-2 px-5 text-xs font-black uppercase tracking-[0.12em] transition ${
        secondary
          ? "border border-[#36D7FF]/30 text-[#F5F5F2] hover:border-white/50 hover:bg-[#0797F2]/16"
          : "bg-[#0755C9] text-white hover:bg-[#0797F2]"
      }`}
    >
      {label}
      <ArrowRight size={16} />
    </Link>
  );
}
