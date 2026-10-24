"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight, Check, CheckCheck, ChevronRight,
  CalendarDays, FlaskConical, LoaderCircle, LockKeyhole, RotateCcw,
  Settings2, ShieldCheck, Swords, Ticket, Trophy, UserRound, Users, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SPLIT_II_FLOATER_RULES, SPLIT_II_REGISTRATION_RULES, type TournamentPool } from "@/lib/tournaments/split-ii-config";
import { SPLIT_II_ROSTERS } from "@/lib/tournaments/split-ii-rosters";
import { useSplitTwoRegistration } from "./useSplitTwoRegistration";
import BroadcastType from "./BroadcastType";
import DashboardAudio from "./DashboardAudio";
import TournamentFormat from "./TournamentFormat";
import TournamentFixtures from "./TournamentFixtures";
import TournamentRosters from "./TournamentRosters";
import styles from "./split-ii.module.css";

export default function SplitTwoRegistration({ inDashboard = false, preview = false }: { inDashboard?: boolean; preview?: boolean }) {
  const isPreview = preview && process.env.NODE_ENV === "development";
  const state = useSplitTwoRegistration(isPreview);
  const { players, player, registration, floaters, floaterRegistration, slot, account, capacity, loaded, requestState } = state;
  const [claimPool, setClaimPool] = useState<TournamentPool>("MAIN");
  const [dialog, setDialog] = useState<"claim" | "signin" | "verify" | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"roster" | "details" | "format" | "fixtures">("roster");
  const [announcement, setAnnouncement] = useState("");
  const count = players.length;
  const windowOpen = state.window === "open";
  const floaterOpen = state.floaterWindow === "open";
  const isFloaterClaim = claimPool === "FLOATER";
  const claimAvailable = isFloaterClaim ? floaterOpen : windowOpen && count < capacity;
  const hasEntry = Boolean(registration || floaterRegistration);

  function openClaim(pool: TournamentPool = "MAIN") {
    setAccepted(false);
    setSubmissionError("");
    if (hasEntry || !loaded || requestState !== "idle" || (pool === "MAIN" ? count >= capacity || !windowOpen : !floaterOpen)) return;
    setClaimPool(pool);
    setDialog(account === "signed-out" ? "signin" : account === "eligible" ? "claim" : "verify");
  }

  async function confirmClaim() {
    if (!accepted || submitting || hasEntry || account !== "eligible" || requestState !== "idle" || !claimAvailable) return;
    setSubmitting(true);
    setSubmissionError("");
    try {
      await state.confirm(claimPool);
      setDialog(null);
      setAnnouncement(`Your ${isPreview ? "mock " : ""}${isFloaterClaim ? "floater " : ""}entry is confirmed. Your role is taken from your ECL profile.`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not confirm your entry. Please try again.");
    } finally { setSubmitting(false); }
  }

  function previewCapacity(value: number) {
    state.previewCapacity(value);
    setAnnouncement("");
  }

  return (
    <main className={styles.page}>
      {!inDashboard && <div className={styles.previewNotice}>
        <span>{isPreview ? <><FlaskConical size={13} />Design preview / Mock registrations</> : <>Registration opens 17 October, 12:00 noon China time</>}</span>
        <Link href="/hub" prefetch={false}>Back to the Hub <ArrowRight size={13} /></Link>
      </div>}
      <section className={styles.titleBand} aria-labelledby="split-title">
        <div className={styles.titleMeta}><span>EXPAT CHINA LEAGUE</span><div className={styles.musicControls}><span>LEAGUE OF LEGENDS</span>{inDashboard && <DashboardAudio />}</div></div>
        <div className={styles.brandRow}>
          <h1 id="split-title"><span className={styles.srOnly}>Expat China League / Split II / 2026 signup</span><BroadcastType text="ECL" className={styles.brandType} /></h1>
        </div>
      </section>
      <div className={styles.broadcastStrip} aria-label="Draft 2026">
        <BroadcastType text="DRAFT" className={styles.seasonType} />
        <span className={styles.eventLogo}><Image src="/ecl-logo.png" alt="ECL logo" width={150} height={100} preload /></span>
        <BroadcastType text="2026" className={styles.yearType} />
      </div>
      <section className={styles.signupBand} aria-labelledby="signup-title">
        <h2 id="signup-title"><BroadcastType text="SPLIT II" className={styles.signupType} /></h2>
        <div className={styles.signupFooter}><span>{capacity} PLAYERS / {SPLIT_II_ROSTERS.length} TEAMS</span><span className={styles.catchphrase}>AGAINST ALL ODDS</span></div>
      </section>
      <section className={styles.eventDetails} aria-label="Tournament dates and draft status">
        <div><span>Draft day</span><strong>23 October</strong></div>
        <div><span>Tournament begins</span><strong>24 October</strong></div>
        <div><span>Finals</span><strong>20 November</strong></div>
        <div><span>Team selection</span><strong>Draft complete</strong></div>
      </section>
      <div className={styles.registrationLayout}>
        <section className={styles.rosterSection} aria-label="Split II roster">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "roster" | "details" | "format" | "fixtures")}>
          <TabsList className={styles.tabs} variant="line" aria-label="Split II information">
            <TabsTrigger value="roster"><Users size={15} />Team rosters <span>{SPLIT_II_ROSTERS.length}</span></TabsTrigger>
            <TabsTrigger value="details"><Trophy size={15} />Season details</TabsTrigger>
            <TabsTrigger value="format"><Swords size={15} />Tournament format</TabsTrigger>
            <TabsTrigger value="fixtures"><CalendarDays size={15} />Fixtures</TabsTrigger>
          </TabsList>
          {requestState === "error" && <div className={styles.rosterWarning} role="status"><p>{loaded ? "Couldn't refresh registration status or floaters. Showing the last loaded data." : "Registration status and floaters couldn't load. Team rosters are still available."}</p><button onClick={() => void state.refresh()}><RotateCcw size={13} />Try again</button></div>}
          <TabsContent value="roster">
            <TournamentRosters />
          </TabsContent>
          <TabsContent value="details" className={styles.seasonDetails}>
            <p>EXCLUSIVE TO THE ECL COMMUNITY</p><h3>The next chapter.</h3>
            <p>Split II brings the ECL community together for a fresh competitive season. Claim a place in the player pool before the draft.</p>
            <dl><div><dt>Main player pool</dt><dd>{capacity} places</dd></div><div><dt>1st prize</dt><dd className={styles.prize}>3000 RMB</dd></div><div><dt>Season</dt><dd>Split II / 2026</dd></div><div><dt>Draft date</dt><dd>23 October</dd></div><div><dt>Tournament begins</dt><dd>24 October</dd></div><div><dt>Finals</dt><dd>20 November</dd></div><div><dt>Team selection</dt><dd>Draft complete</dd></div><div><dt>Match format</dt><dd>Bo1 league / Bo3 playoffs</dd></div></dl>
            <p>Entry is for existing, active and verified ECL players. Your role comes from your ECL profile. <Link href="/split-ii/rules">Read the registration rules and terms.</Link></p>
          </TabsContent>
          <TabsContent value="format"><TournamentFormat /></TabsContent>
          <TabsContent value="fixtures"><TournamentFixtures /></TabsContent>
          </Tabs>
          <section className={styles.floaterSection} aria-labelledby="floaters-heading">
            <div className={styles.sectionHeading}><div><p>SUBSTITUTES / SEPARATE PLAYER POOL</p><h3 id="floaters-heading">Subs / Floaters <span className={styles.floaterCount}>{loaded ? floaters.length : "--"}</span></h3></div></div>
            <p className={styles.floaterDescription}>Available to sub for tournament matches and scrims. One tournament match per team across Split II; scrims do not count towards the limit.</p>
            {requestState === "error" && !loaded ? <p className={styles.submissionError}>Floater list unavailable. Retry loading the roster above.</p> : !loaded ? <p className={styles.floaterDescription}>Loading floaters…</p> : floaters.length === 0 ? <p className={styles.floaterDescription}>No floaters have joined yet.</p> : <ol className={styles.playerList} aria-label="Registered floaters in signup order">{floaters.map((entry, index) => <li key={entry.id} data-you={entry.id === floaterRegistration?.id || undefined}><span className={styles.listNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.listName}>{entry.name}{entry.id === floaterRegistration?.id && <em>You</em>}</span><span className={styles.listRole}>{entry.role}</span><Check size={12} aria-label="Registered floater" /></li>)}</ol>}
            {floaterRegistration ? <p className={styles.floaterConfirmed}><CheckCheck size={17} /> You&apos;re on the floater list. Your main-roster count is unchanged.</p> : registration ? <p className={styles.floaterDescription}>You already have a main-roster place.</p> : <button className={styles.claimButton} onClick={() => openClaim("FLOATER")} disabled={!loaded || !floaterOpen || requestState !== "idle"}>{!loaded ? "Checking floaters" : !floaterOpen ? "Floater signup closed" : account === "signed-out" ? "Sign in to join floaters" : account !== "eligible" ? "Check floater eligibility" : "Join the floater list"}<ArrowRight size={17} /></button>}
          </section>
        </section>
        <aside className={styles.entryColumn} aria-label="Your registration">
          <article className={styles.ticket} data-registered={Boolean(registration)}>
            <div className={styles.ticketTop}><span>ECL / SPLIT II</span><Ticket size={19} /></div>
            <p className={styles.ticketEyebrow}>{registration ? "YOU'RE ON THE ROSTER" : floaterRegistration ? "YOU'RE A FLOATER" : "YOUR NEXT CHAPTER"}</p>
            <h3>{registration ? <>You&apos;re<br />locked in.</> : floaterRegistration ? <>Ready<br />to sub.</> : <>Your place.<br />Your split.</>}</h3>
            <div className={styles.ticketIdentity}><div className={styles.avatar}><UserRound size={20} /></div><div><strong>{player.name}</strong><span>{account === "signed-out" ? "Existing ECL account required" : player.riotId}</span></div>{account === "eligible" && <ShieldCheck size={19} className={styles.verifiedIcon} aria-label="Verified ECL account" />}</div>
            <dl className={styles.ticketSpecs}><div><dt>Season</dt><dd>2026 / Split II</dd></div><div><dt>Role from profile</dt><dd>{registration?.role ?? floaterRegistration?.role ?? (account === "signed-out" ? "Sign in to view" : player.role || "Complete profile")}</dd></div><div><dt>Status</dt><dd>{registration ? "Confirmed" : floaterRegistration ? "Floater" : !loaded ? "Checking registration" : !windowOpen ? state.window === "scheduled" ? "Opening soon" : "Registration closed" : count >= capacity ? "Roster full" : "Awaiting entry"}</dd></div></dl>
            <div className={styles.perforation} />
            <div className={styles.ticketAction}>
              {registration ? <><span className={styles.confirmedLabel}><CheckCheck size={17} /> Place confirmed</span><div className={styles.ticketSerial}>ECL / II / {String(slot).padStart(3, "0")}</div></> : <button className={styles.claimButton} onClick={() => openClaim()} disabled={Boolean(floaterRegistration) || !loaded || !windowOpen || count >= capacity || requestState !== "idle"}>{floaterRegistration ? "Registered as floater" : !loaded ? "Checking registration" : !windowOpen ? state.window === "scheduled" ? "Opens 17 Oct, 12:00" : "Registration closed" : count >= capacity ? "Registration full" : account === "signed-out" ? "Sign in to claim a place" : account !== "eligible" ? "Check eligibility" : "Claim your place"}{!windowOpen || count >= capacity ? <LockKeyhole size={16} /> : <ArrowRight size={17} />}</button>}
              <span className={styles.ticketNote}>{registration ? isPreview ? "Your place is saved in this preview only." : "Your entry is saved to your ECL account." : "Your role is taken from your ECL profile."}</span>
              <div className={styles.barcode} aria-hidden="true" /><div className={styles.barcodeCaption}><span>EXPAT CHINA LEAGUE</span><span>II / 2026</span></div>
            </div>
          </article>
          <div className={styles.entryFootnote}><ShieldCheck size={16} /><p>Reserved for the ECL community.<br /><span>Verified players. A fresh start.</span></p></div>
        </aside>
      </div>
      <section className={styles.stepsBand} aria-label="Registration process"><div><span>01</span><div><h3>Sign in.</h3><p>Your existing ECL account.</p></div><UserRound size={19} /></div><div><span>02</span><div><h3>Claim your place.</h3><p>One of {capacity} main player entries.</p></div><Ticket size={19} /></div><div><span>03</span><div><h3>Be draft-ready.</h3><p>The next chapter is yours.</p></div><Trophy size={19} /></div></section>
      <div className={styles.pageEnd}><span>EXPAT CHINA LEAGUE</span><span>ECL / SPLIT II / 2026 <ArrowRight size={14} /></span></div>
      <p className={styles.srOnly} role="status">{announcement}</p>
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !submitting) setDialog(null); }}>
        <DialogContent className={styles.modal} overlayClassName={styles.modalOverlay} showCloseButton={false}>
          <button className={styles.modalClose} title="Close" aria-label="Close dialog" onClick={() => setDialog(null)} disabled={submitting}><X size={19} /></button>
          <Ticket size={26} className={styles.modalIcon} /><span className={styles.modalEyebrow}>SPLIT II / {isPreview ? "DESIGN PREVIEW" : "PLAYER REGISTRATION"}</span>
          <DialogTitle className={styles.modalTitle}>{dialog === "signin" ? "Your ECL account." : dialog === "verify" ? "One more step." : isFloaterClaim ? "Ready to join the floaters?" : "Ready to sign up?"}</DialogTitle>
          <DialogDescription className={styles.modalDescription}>{dialog === "signin" ? isPreview ? "Continue with the sample ECL player to try registration." : "Sign in with your existing ECL account to register. Your profile name and role will be filled in for you." : dialog === "verify" ? "Registration requires an active, verified ECL profile with a player name, League identity and primary role. Check your profile in settings or contact an ECL admin for help." : isFloaterClaim ? "By joining, you accept the ECL Terms of Service and floater rules: one tournament match per team; scrims do not count. Your profile role is used." : "By registering, you accept the ECL Terms of Service and the tournament registration rules. Your player name and role will be taken from your ECL profile."}</DialogDescription>
          {dialog === "claim" ? <form className={styles.consentForm} onSubmit={(event) => { event.preventDefault(); void confirmClaim(); }}>
            <div className={styles.reviewRow}><strong>{player.name}</strong><span>{player.riotId}</span><span className={styles.profileRole}><ShieldCheck size={14} />{player.role}<small>From your ECL profile</small></span></div>
            <details className={styles.consentRules}>
              <summary>{isFloaterClaim ? "Floater rules" : "Tournament registration rules"}</summary>
              <ul>{(isFloaterClaim ? SPLIT_II_FLOATER_RULES : SPLIT_II_REGISTRATION_RULES).map(rule => <li key={rule}>{rule}</li>)}</ul>
            </details>
            <label className={styles.acceptLabel}><input type="checkbox" required checked={accepted} disabled={submitting} onChange={(event) => setAccepted(event.target.checked)} /><span>I have read and accept the <Link href={isFloaterClaim ? "/split-ii/rules#floaters" : "/split-ii/rules"} target="_blank" rel="noopener noreferrer" prefetch={false}>Terms of Service and {isFloaterClaim ? "floater rules" : "tournament registration rules"}</Link>.</span></label>
            {submissionError && <p className={styles.submissionError} role="alert">{submissionError}</p>}
            <button type="submit" className={styles.claimButton} disabled={!accepted || submitting || !claimAvailable}>{submitting ? <><LoaderCircle size={17} className={styles.spinner} />Signing up</> : <>{isFloaterClaim ? "Accept & join floaters" : "Accept & sign up"}<ArrowRight size={17} /></>}</button>
            <p className={styles.consentPreview}>{isPreview ? "Design preview only. No real registration or consent record is saved." : "Your registration includes a record of the terms and rules you accept."}</p>
          </form> : isPreview ? <button className={styles.claimButton} onClick={() => { state.previewAccount("eligible"); setDialog("claim"); }}>{dialog === "signin" ? "Continue as demo player" : "Preview verified player"}<ChevronRight size={17} /></button> : <Link className={styles.claimButton} href={dialog === "signin" ? "/login" : "/hub/settings"}>{dialog === "signin" ? "Sign in to ECL" : "Open profile settings"}<ChevronRight size={17} /></Link>}
        </DialogContent>
      </Dialog>
      {isPreview && <div className={styles.previewTools}>
        {controlsOpen && <div className={styles.controlPanel}><div className={styles.controlHeading}><strong>Preview states</strong><button title="Close preview controls" aria-label="Close preview controls" onClick={() => setControlsOpen(false)}><X size={15} /></button></div><label>Capacity<select aria-label="Preview capacity" value={count} onChange={(event) => previewCapacity(Number(event.target.value))}>{![5, 18, 23, 25].includes(count) && <option value={count}>{count} / {capacity}</option>}{[5, 18, 23, 25].map((value) => <option key={value} value={value}>{value} / {capacity}</option>)}</select></label><label>Account<select aria-label="Preview account" value={account} onChange={(event) => state.previewAccount(event.target.value as "eligible" | "signed-out" | "unverified")}><option value="eligible">Verified player</option><option value="signed-out">Signed out</option><option value="unverified">Unverified player</option></select></label><label>Roster<select aria-label="Preview roster state" value={requestState} onChange={(event) => state.previewRequest(event.target.value as "idle" | "loading" | "error")}><option value="idle">Loaded</option><option value="loading">Loading</option><option value="error">Error</option></select></label><button className={styles.resetButton} onClick={() => { previewCapacity(18); state.previewAccount("eligible"); setActiveTab("roster"); }}><RotateCcw size={13} />Reset preview</button></div>}
        <button className={styles.toolsTrigger} onClick={() => setControlsOpen(!controlsOpen)} title="Preview controls" aria-label="Preview controls" aria-expanded={controlsOpen}><Settings2 size={18} /></button>
      </div>}
    </main>
  );
}
