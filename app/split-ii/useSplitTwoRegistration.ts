"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SPLIT_II_CAPACITY, type TournamentPool, type TournamentRegistrationState, type TournamentRosterEntry, type TournamentViewer } from "@/lib/tournaments/split-ii-config";
import { demoPlayer, mockPlayers } from "./mock-registrations";

type RequestState = "idle" | "loading" | "error";
const endpoint = "/api/tournaments/split-ii/registration";

export function useSplitTwoRegistration(preview: boolean) {
  const [previewPlayers, setPreviewPlayers] = useState<TournamentRosterEntry[]>(mockPlayers.slice(0, 18));
  const [previewFloaters, setPreviewFloaters] = useState<TournamentRosterEntry[]>([]);
  const [previewAccount, setPreviewAccount] = useState<TournamentViewer["account"]>("eligible");
  const [previewRequest, setPreviewRequest] = useState<RequestState>("idle");
  const [data, setData] = useState<TournamentRegistrationState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(preview);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [requestState, setRequestState] = useState<RequestState>("loading");
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const registering = useRef(false);
  const invalidateRequests = useCallback(() => { requestId.current++; }, []);

  useEffect(() => {
    if (preview) return;
    let disposed = false;
    const applySession = (accessToken: string | null) => {
      if (disposed) return;
      requestId.current++;
      setData(null);
      setToken(accessToken);
      setSessionReady(true);
      setSessionRevision(value => value + 1);
    };
    void supabase.auth.getSession().then(({ data: session }) => applySession(session.session?.access_token ?? null)).catch(() => applySession(null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => applySession(session?.access_token ?? null));
    return () => { disposed = true; invalidateRequests(); subscription.subscription.unsubscribe(); };
  }, [preview, invalidateRequests]);

  const refresh = useCallback(async (silent = false) => {
    if (preview) { setPreviewRequest("idle"); return; }
    if (silent && registering.current) return;
    const id = ++requestId.current;
    if (!silent) setRequestState("loading");
    try {
      const response = await fetch(endpoint, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "The roster could not load.");
      if (id !== requestId.current) return;
      setData(payload as TournamentRegistrationState);
      setMessage("");
      setRequestState("idle");
    } catch (error) {
      if (id !== requestId.current) return;
      setMessage(error instanceof Error ? error.message : "The roster could not load.");
      setRequestState("error");
    }
  }, [preview, token]);

  useEffect(() => {
    if (preview || !sessionReady) return;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 20_000);
    const focus = () => { void refresh(true); };
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); invalidateRequests(); };
  }, [preview, sessionReady, sessionRevision, refresh, invalidateRequests]);

  const players = preview ? previewPlayers : data?.players ?? [];
  const ownEntry = preview ? players.find(entry => entry.id === demoPlayer.id) : data?.registration;
  const registration = ownEntry ? players.find(entry => entry.id === ownEntry.id) : undefined;
  const floaters = preview ? previewFloaters : data?.floaters ?? [];
  const floaterEntry = preview ? floaters.find(entry => entry.id === demoPlayer.id) : data?.floaterRegistration;
  const floaterRegistration = floaterEntry ? floaters.find(entry => entry.id === floaterEntry.id) : undefined;
  const player = preview ? demoPlayer : {
    id: registration?.id ?? "current-player",
    name: data?.viewer.name ?? "Your ECL profile",
    riotId: data?.viewer.riotId ?? "",
    role: data?.viewer.role ?? "",
  };

  async function confirm(pool: TournamentPool = "MAIN") {
    if (preview) {
      await new Promise(resolve => setTimeout(resolve, 350));
      if (registration || floaterRegistration) return;
      if (pool === "FLOATER") setPreviewFloaters(current => [...current, demoPlayer]);
      else setPreviewPlayers(current => current.length < SPLIT_II_CAPACITY && !current.some(entry => entry.id === demoPlayer.id) ? [...current, demoPlayer] : current);
      return;
    }
    if (!token || !data) throw new Error("Please sign in again before registering.");
    registering.current = true;
    const id = ++requestId.current;
    try {
    const response = await fetch(endpoint, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accepted: true, termsVersion: data.termsVersion,
        rulesVersion: pool === "FLOATER" ? data.floaterRulesVersion : data.rulesVersion,
        ...(pool === "FLOATER" ? { pool } : {}),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      // Refetch capacity/eligibility after conflicts; never assume a failed response means no saved entry.
      registering.current = false;
      void refresh(true);
      throw new Error(payload.message ?? "Could not confirm your entry. Refresh and try again.");
    }
    if (id === requestId.current) { setData(payload as TournamentRegistrationState); setRequestState("idle"); setMessage(""); }
    } finally { registering.current = false; }
  }

  return {
    players, player, registration, floaters, floaterRegistration,
    floaterWindow: preview ? "open" as const : data?.floaterWindow ?? "closed" as const,
    slot: preview ? players.findIndex(entry => entry.id === demoPlayer.id) + 1 : data?.registration?.ticketNumber ?? 0,
    account: preview ? previewAccount : data?.viewer.account ?? "signed-out",
    capacity: data?.capacity ?? SPLIT_II_CAPACITY,
    loaded: preview || data !== null,
    window: preview ? "open" as const : data?.window ?? "closed" as const,
    opensAt: data?.opensAt ?? null,
    requestState: preview ? previewRequest : requestState,
    message, refresh, confirm,
    previewAccount: setPreviewAccount,
    previewRequest: setPreviewRequest,
    previewCapacity: (value: number) => { setPreviewPlayers(mockPlayers.slice(0, value)); setPreviewFloaters([]); setPreviewRequest("idle"); },
  };
}
