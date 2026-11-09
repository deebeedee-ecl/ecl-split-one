"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquareText, Send, Sparkles } from "lucide-react";
import { getAccessToken } from "@/components/account/client-account";
import { countryByCode, worldCupCountries } from "@/lib/world-cup-countries";
import { WorldCupFlag } from "../WorldCupFlag";

type TeamOption = {
  id: string;
  name: string;
  countryLabel: string;
};

type RecentApplication = {
  id: string;
  playerName: string;
  role: string;
  requestedTeam: string;
  nationality: string;
  pitch: string;
  status: string;
};

const roleOptions = ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"];

export function ApplicationForm({
  teams,
  initialTeamId,
  recentApplications,
}: {
  teams: TeamOption[];
  initialTeamId?: string;
  recentApplications: RecentApplication[];
}) {
  const [teamId, setTeamId] = useState(initialTeamId || "");
  const [playerName, setPlayerName] = useState("");
  const [email, setEmail] = useState("");
  const [riotName, setRiotName] = useState("");
  const [riotTag, setRiotTag] = useState("");
  const [primaryRole, setPrimaryRole] = useState("");
  const [secondaryRole, setSecondaryRole] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [notes, setNotes] = useState("");
  const [signatureChampions, setSignatureChampions] = useState("");
  const [availability, setAvailability] = useState("");
  const [whyPickMe, setWhyPickMe] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [profileStatus, setProfileStatus] = useState("Loading Hub profile...");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === teamId) ?? null,
    [teamId, teams],
  );
  const country = useMemo(() => countryByCode(countryCode), [countryCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!cancelled) setProfileStatus("Log in and verify your Hub profile before applying.");
          return;
        }

        const response = await fetch("/api/account/profile", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setProfileStatus("Log in and verify your Hub profile before applying.");
          return;
        }

        const data = await response.json();
        const profile = data?.profile;
        if (!profile) {
          if (!cancelled) setProfileStatus("Create and verify your Hub profile before applying.");
          return;
        }

        if (cancelled) return;

        setPlayerName((current) => current || profile.displayName || "");
        setEmail((current) => current || profile.email || "");
        setRiotName((current) => current || profile.riotName || "");
        setRiotTag((current) => current || profile.riotTag || "");
        setPrimaryRole((current) => current || profile.primaryRole || "");
        setSecondaryRole((current) => current || profile.secondaryRole || "");
        setProfileLoaded(true);
        setProfileStatus(
          profile.verificationStatus === "VERIFIED" && profile.accountStatus === "ACTIVE"
            ? "Using your verified Hub profile."
            : "Finish Hub verification before admins can approve your application.",
        );
      } catch {
        if (!cancelled) setProfileStatus("Hub profile could not be loaded. You can still fill this manually.");
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    if (!/^\d+$/.test(riotTag.trim())) {
      setIsError(true);
      setMessage("Riot tag must be numbers only.");
      setLoading(false);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setIsError(true);
      setMessage("Log in with your Hub account before applying.");
      setLoading(false);
      return;
    }

    const applicationNotes = [
      "World Cup Team Application",
      selectedTeam ? `Requested team: ${selectedTeam.name}` : "Requested team: Any approved roster",
      selectedTeam ? `Requested team ID: ${selectedTeam.id}` : "",
      country ? `Nationality: ${country.flag} ${country.name}` : "",
      country ? `Nationality code: ${country.code}` : "",
      signatureChampions.trim() ? `Signature champions: ${signatureChampions.trim()}` : "",
      availability.trim() ? `Availability: ${availability.trim()}` : "",
      whyPickMe.trim() ? `Player pitch: ${whyPickMe.trim()}` : "",
      notes.trim() ? `Extra note: ${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch("/api/free-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerName,
          email,
          riotName,
          riotTag,
          primaryRole,
          secondaryRole,
          currentRank: "No elo requirement",
          notes: applicationNotes,
        }),
      });

      if (!response.ok) throw new Error("Application failed.");

      setMessage("Application submitted. Admins will review it before any roster move is final.");
      setPlayerName("");
      setEmail("");
      setRiotName("");
      setRiotTag("");
      setPrimaryRole("");
      setSecondaryRole("");
      setCountryCode("");
      setNotes("");
      setSignatureChampions("");
      setAvailability("");
      setWhyPickMe("");
      setTeamId("");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Application failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/hub/world-cup/find-team"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff] transition hover:text-white"
        >
          <ArrowLeft size={15} />
          Back To Teams
        </Link>
        <Link
          href="/hub/world-cup/create-team"
          className="inline-flex min-h-10 items-center gap-2 border border-[#69a7ff]/24 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#d7e6ff] transition hover:border-white/45 hover:text-white"
        >
          Create Team
        </Link>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          onSubmit={handleSubmit}
          className="border border-[#2d6bff]/30 bg-[#081431]/92 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_44px_rgba(20,86,255,0.12)]"
        >
          <div className="mb-5 border border-[#36D7FF]/18 bg-[#020817]/42 px-4 py-3 text-sm font-bold text-[#C9DFEB]">
            {profileStatus}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Apply To">
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="world-cup-input"
              >
                <option value="">Any approved roster</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.countryLabel} - {team.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nationality">
              <div className="grid gap-2">
                <select
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="world-cup-input"
                  required
                >
                  <option value="">Select flag</option>
                  {worldCupCountries.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.flag} {option.name}
                    </option>
                  ))}
                </select>
                {country && (
                  <div className="border border-[#36D7FF]/18 bg-[#020817]/42 px-3 py-2 text-sm font-bold text-[#C9DFEB]">
                    <WorldCupFlag code={country.code} label={country.name} />
                  </div>
                )}
              </div>
            </Field>
            <Field label="Display Name">
              <input
                value={playerName}
                className="world-cup-input"
                placeholder="Alias"
                readOnly={profileLoaded}
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                className="world-cup-input"
                placeholder="player@email.com"
                readOnly={profileLoaded}
                required
              />
            </Field>
            <Field label="Riot Name">
              <input
                value={riotName}
                className="world-cup-input"
                placeholder="Riot name"
                readOnly={profileLoaded}
                required
              />
            </Field>
            <Field label="Riot Tag">
              <input
                value={riotTag}
                className="world-cup-input"
                inputMode="numeric"
                pattern="[0-9]+"
                placeholder="Tag"
                readOnly={profileLoaded}
                required
              />
            </Field>
            <Field label="Primary Role">
              <select
                value={primaryRole}
                onChange={(event) => setPrimaryRole(event.target.value)}
                className="world-cup-input"
                disabled={profileLoaded}
                required
              >
                <option value="">Select role</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Secondary Role">
              <select
                value={secondaryRole}
                onChange={(event) => setSecondaryRole(event.target.value)}
                className="world-cup-input"
                disabled={profileLoaded}
              >
                <option value="">None</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Signature Champions">
              <input
                value={signatureChampions}
                onChange={(event) => setSignatureChampions(event.target.value)}
                className="world-cup-input"
                placeholder="Ornn, Rumble, K'Sante"
              />
            </Field>
            <Field label="Availability">
              <input
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                className="world-cup-input"
                placeholder="Weeknights, weekends, flexible"
              />
            </Field>
          </div>

          <Field label="Sell Yourself">
            <textarea
              value={whyPickMe}
              onChange={(event) => setWhyPickMe(event.target.value)}
              className="world-cup-input mt-4 min-h-36 resize-y"
              placeholder="Tell captains what you bring: shotcalling, champion pool, weakside, flex picks, clutch factor"
              required
            />
          </Field>

          <Field label="Extra Note">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="world-cup-input mt-4 min-h-24 resize-y"
              placeholder="Anything else admins or captains should know"
            />
          </Field>

          {message && (
            <div
              className={`mt-5 border p-4 text-sm font-bold leading-6 ${
                isError
                  ? "border-red-400/30 bg-red-500/10 text-red-200"
                  : "border-[#69a7ff]/30 bg-[#1456ff]/14 text-[#d7e6ff]"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#1456ff] px-5 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#2d6bff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={17} />
            {loading ? "Submitting" : "Submit Application"}
          </button>
        </form>

        <aside className="space-y-4">
          <section className="border border-[#2d6bff]/30 bg-[#081431]/92 p-5">
            <div className="flex items-center gap-3 text-[#8dbbff]">
              <MessageSquareText size={18} />
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
                Player Pitch
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-black uppercase leading-tight text-white">
              Make captains want you.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#aebfe4]">
              Your champions, availability, and pitch show up for captains and admins.
              Admins still make roster moves final.
            </p>
          </section>

          <section className="border border-[#2d6bff]/30 bg-[#020817]/55 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
              Selected Team
            </p>
            <p className="mt-3 text-xl font-black text-white">
              {selectedTeam ? selectedTeam.name : "Any approved roster"}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#aebfe4]">
              {selectedTeam
                ? selectedTeam.countryLabel
                : "Captains and admins can place you where you fit."}
            </p>
          </section>

          <section className="border border-[#2d6bff]/30 bg-[#020817]/55 p-5">
            <div className="flex items-center gap-3 text-[#8dbbff]">
              <Sparkles size={18} />
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
                After Applying
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#aebfe4]">
              Captains can accept or reject applicants from their team dashboard.
              Accepted applications remain visible for admin approval.
            </p>
          </section>
        </aside>
      </section>

      <section className="mt-5 border border-[#2d6bff]/30 bg-[#081431]/92">
        <div className="border-b border-[#69a7ff]/14 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
            Application Board
          </p>
          <h2 className="mt-2 text-2xl font-black uppercase text-white">
            Players Looking For Teams
          </h2>
        </div>
        <div className="divide-y divide-[#69a7ff]/12">
          {recentApplications.map((application) => (
            <article
              key={application.id}
              className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_12rem_10rem] lg:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-lg font-black text-white">
                    {application.playerName}
                  </h3>
                  <span className="border border-[#69a7ff]/18 bg-[#020817]/50 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#8dbbff]">
                    {application.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold text-[#8094c2]">
                  Wants: {application.requestedTeam}
                </p>
                {application.pitch && (
                  <p className="mt-3 border-l-2 border-[#69a7ff]/35 pl-3 text-sm font-semibold leading-6 text-[#d7e6ff]">
                    {application.pitch}
                  </p>
                )}
              </div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#aebfe4]">
                {application.role}
              </p>
              <p className="text-xs font-bold text-[#d7e6ff]">
                {application.nationality}
              </p>
            </article>
          ))}
          {recentApplications.length === 0 && (
            <p className="p-5 text-sm font-semibold text-[#aebfe4]">
              No World Cup applications yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8dbbff]">
        {label}
      </span>
      {children}
    </label>
  );
}
