"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Flag, Send, ShieldCheck, Trophy, Users } from "lucide-react";
import { HubShell } from "../../_components/HubShell";
import { countryByCode, worldCupCountries } from "@/lib/world-cup-countries";
import { WorldCupNav } from "../WorldCupNav";
import { WorldCupFlag } from "../WorldCupFlag";
import { getAccessToken } from "@/components/account/client-account";

const rosterSlots = Array.from({ length: 6 }, (_, index) => `Slot ${index + 1}`);

export default function WorldCupCreateTeamPage() {
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [dashboardHref, setDashboardHref] = useState("");

  const teamCountry = useMemo(() => countryByCode(countryCode), [countryCode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);
    setDashboardHref("");

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Log in to the Hub before creating a World Cup team.");
      }

      const response = await fetch("/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamName,
          captainName,
          country: teamCountry?.name || "",
          countryCode: teamCountry?.code || "",
          countryFlag: teamCountry?.flag || "",
          players: [],
        }),
      });

      if (!response.ok) throw new Error("Team submission failed.");
      const createdTeam = await response.json();
      const captainDashboardHref = createdTeam?.id ? "/hub/world-cup/my" : "";

      setMessage("World Cup team submitted. Admins will review it before it appears on the team board.");
      setDashboardHref(captainDashboardHref);
      setTeamName("");
      setCaptainName("");
      setCountryCode("");
    } catch (error) {
      setIsError(true);
      setDashboardHref("");
      setMessage(error instanceof Error ? error.message : "Team submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <HubShell
      active="world-cup"
      eyebrow="World Cup"
      title="Create Team"
      description="Submit a national team for admin review."
      theme="blue"
      hideHeader
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/hub/dashboard"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#77CFFF] transition hover:text-white"
        >
          <ArrowLeft size={15} />
          Back To World Cup
        </Link>
        <Link
          href="/hub/world-cup/apply"
          className="inline-flex min-h-10 items-center gap-2 border border-[#36D7FF]/24 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#C9DFEB] transition hover:border-white/45 hover:text-white"
        >
          Apply For Team
        </Link>
      </div>

      <WorldCupPageHeader
        eyebrow="World Cup"
        title="Create Team"
        description="Create the team, choose the national flag, and open your captain dashboard for applicants."
      />
      <WorldCupNav active="create" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          onSubmit={handleSubmit}
          className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_44px_rgba(54,215,255,0.12)]"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <Field label="Team Name">
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                className="world-cup-input"
                placeholder="Team Canada"
                required
              />
            </Field>
            <Field label="Nation">
              <div className="grid gap-2">
                <select
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="world-cup-input"
                  required
                >
                  <option value="">Select flag</option>
                  {worldCupCountries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.name}
                    </option>
                  ))}
                </select>
                {teamCountry && (
                  <div className="border border-[#36D7FF]/18 bg-[#020817]/42 px-3 py-2 text-sm font-bold text-[#C9DFEB]">
                    <WorldCupFlag code={teamCountry.code} label={teamCountry.name} />
                  </div>
                )}
              </div>
            </Field>
            <Field label="Captain Name">
              <input
                value={captainName}
                onChange={(event) => setCaptainName(event.target.value)}
                className="world-cup-input"
                placeholder="Captain display name"
                required
              />
            </Field>
          </div>

          <section className="mt-6 border border-[#36D7FF]/18 bg-[#020817]/44 p-4">
            <div className="flex items-center gap-3">
              <Flag size={18} className="text-[#77CFFF]" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#77CFFF]">
                  Six Player Roster
                </p>
                <p className="mt-1 text-sm font-semibold text-[#C9DFEB]">
                  Players apply through ECL profiles. Captains accept applicants, admins finalize.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rosterSlots.map((slot) => (
                <div key={slot} className="border border-[#36D7FF]/14 bg-[#061C4A]/60 px-3 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#77CFFF]">
                    {slot}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">Open</p>
                </div>
              ))}
            </div>
          </section>

          {message && (
            <div
              className={`mt-5 border p-4 text-sm font-bold leading-6 ${
                isError
                  ? "border-red-400/30 bg-red-500/10 text-red-200"
                  : "border-[#36D7FF]/30 bg-[#0755C9]/18 text-[#F5F5F2]"
              }`}
            >
              {message}
              {dashboardHref && (
                <Link
                  href={dashboardHref}
                  className="mt-3 inline-flex min-h-10 items-center justify-center border border-[#36D7FF]/28 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:border-white/45"
                >
                  Open Captain Dashboard
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#0755C9] px-5 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0797F2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={17} />
            {loading ? "Submitting" : "Create Team"}
          </button>
        </form>

        <aside className="space-y-4">
          <InfoBlock
            icon={<Users size={18} />}
            title="Players Apply"
            text="Your roster fills from ECL applications, so player identity, roles, ranks, and champion data stay tied to Hub profiles."
          />
          <InfoBlock
            icon={<ShieldCheck size={18} />}
            title="Captain Dashboard"
            text="The captain dashboard opens from the Hub profile that created the team."
          />
          <InfoBlock
            icon={<Trophy size={18} />}
            title="Admin Final"
            text="Teams and signings stay pending until admins approve them from the admin dashboard."
          />
          <div className="border border-[#36D7FF]/35 bg-[#0755C9]/14 p-5">
            <div className="flex items-center gap-3 text-[#77CFFF]">
              <CheckCircle2 size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                No Elo Requirement
              </h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#C9DFEB]">
              National pride first. Bring your flag, then fight for the bracket.
            </p>
          </div>
        </aside>
      </section>
    </HubShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#77CFFF]">
        {label}
      </span>
      {children}
    </label>
  );
}

function WorldCupPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-5 border border-[#0797F2]/30 bg-[#061C4A]/92 p-6 shadow-[0_18px_54px_rgba(0,0,0,0.28)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#36D7FF]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-4xl font-black uppercase leading-none tracking-normal text-white md:text-5xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C9DFEB]">
        {description}
      </p>
    </header>
  );
}

function InfoBlock({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="border border-[#0797F2]/30 bg-[#061C4A]/92 p-5">
      <div className="flex items-center gap-3 text-[#77CFFF]">
        {icon}
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">
          {title}
        </h2>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#C9DFEB]">
        {text}
      </p>
    </section>
  );
}
