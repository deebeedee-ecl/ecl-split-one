"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Edit3,
  FileText,
  Gauge,
  Home,
  KeyRound,
  LogOut,
  Mail,
  MessageSquareText,
  Newspaper,
  PenSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCog,
  Users,
  X,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useEffect } from "react";

type AdminSection =
  | "dashboard"
  | "users"
  | "matches"
  | "elo"
  | "admins"
  | "messages"
  | "news";

const sections: Array<{ id: AdminSection; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "matches", label: "Match History", icon: CalendarDays },
  { id: "elo", label: "ELO / LP", icon: Gauge },
  { id: "admins", label: "Admin Users", icon: UserCog },
  { id: "messages", label: "Messages", icon: MessageSquareText },
  { id: "news", label: "News Drafts", icon: Newspaper },
];

type ContactMessage = {
  id: string;
  name: string;
  contact: string;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
};

type AdminOverview = {
  metrics: {
    players: number;
    gamesPlayed: number;
    newSignups: number;
    openReports: number;
  };
  users: Array<{
    id: string;
    player: string;
    email: string;
    kook: string;
    riot: string;
    wechat: string;
    role: string;
    rank: string;
    accountStatus: string;
    verificationStatus: string;
    // Raw fields for editing
    displayName: string;
    riotName: string;
    riotTag: string;
    kookId: string;
    kookUsername: string;
    wechatId: string;
    chinaServerId: string | number;
  }>;
  matches: Array<{
    id: string;
    date: string;
    blue: string;
    red: string;
    score: string;
    duration: string;
    status: string;
    label: string;
  }>;
  recentNotes: Array<{
    id: string;
    text: string;
    createdAt: string;
  }>;
  adminUsers: Array<{
    email: string;
    role: string;
  }>;
  newsDrafts: Array<{
    type: string;
    title: string;
    status: string;
  }>;
};

const emptyOverview: AdminOverview = {
  metrics: {
    players: 0,
    gamesPlayed: 0,
    newSignups: 0,
    openReports: 0,
  },
  users: [],
  matches: [],
  recentNotes: [],
  adminUsers: [],
  newsDrafts: [],
};

export default function AdminPage() {
  const [active, setActive] = useState<AdminSection>("dashboard");
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const activeLabel = useMemo(
    () => sections.find((section) => section.id === active)?.label ?? "Dashboard",
    [active]
  );

  async function loadOverview() {
    setOverviewLoading(true);
    setOverviewError("");

    try {
      const response = await fetch("/api/admin/overview", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load admin overview.");
      }

      setOverview(data);
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : "Could not load admin overview.");
    } finally {
      setOverviewLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <main className="fixed inset-0 z-[300] overflow-auto bg-[#050505] text-white">
      <div className="grid min-h-screen lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-[#211216] bg-[#090909] p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#b11226] text-white">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="text-lg font-black tracking-normal">ECL Admin</p>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8d8d8d]">
                Operations
              </p>
            </div>
          </div>

          <nav className="mt-9 space-y-2">
            {sections.map((section) => (
              <AdminNavButton
                key={section.id}
                active={active === section.id}
                icon={section.icon}
                label={section.label}
                onClick={() => setActive(section.id)}
              />
            ))}
            <Link
              href="/admin/inhouse"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 text-xs font-black uppercase tracking-[0.08em] text-[#8d8d8d] transition hover:bg-[#1a1a1a] hover:text-white"
            >
              <Swords size={16} />
              Inhouse Reporter
            </Link>
          </nav>

          <div className="mt-auto pt-8">
            <button
              type="button"
              onClick={logout}
              className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2b2b2b] bg-[#101010] text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
            >
              <LogOut size={15} />
              Sign Out
            </button>
            <Link
              href="/"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2b2b2b] bg-[#101010] text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-[#b11226] hover:bg-[#b11226]"
            >
              <Home size={15} />
              Return to Website
            </Link>
          </div>
        </aside>

        <section className="min-w-0 p-5 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b11226]">
                Control Room
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-normal text-white">
                {activeLabel}
              </h1>
            </div>
            <label className="flex h-11 w-full max-w-sm items-center gap-3 rounded-xl border border-[#202020] bg-[#0d0d0d] px-4 text-xs font-semibold text-[#7f7f7f]">
              <Search size={15} />
              Search admin records...
            </label>
          </div>

          <div className="mt-6">
            {overviewError && (
              <p className="mb-4 rounded-xl border border-[#b11226]/40 bg-[#b11226]/10 p-4 text-sm font-bold text-[#ff8c9a]">
                {overviewError}
              </p>
            )}
            {active === "dashboard" && <DashboardSection overview={overview} loading={overviewLoading} setActive={setActive} />}
            {active === "users" && <UsersSection users={overview.users} loading={overviewLoading} onRefresh={loadOverview} />}
            {active === "matches" && <MatchesSection matches={overview.matches} loading={overviewLoading} />}
            {active === "elo" && <EloSection />}
            {active === "admins" && <AdminsSection admins={overview.adminUsers} loading={overviewLoading} />}
            {active === "messages" && <MessagesSection />}
            {active === "news" && <NewsSection drafts={overview.newsDrafts} loading={overviewLoading} />}
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardSection({
  overview,
  loading,
  setActive,
}: {
  overview: AdminOverview;
  loading: boolean;
  setActive: (section: AdminSection) => void;
}) {
  const recentUsers = overview.users.slice(0, 5);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Players" value={loading ? "..." : String(overview.metrics.players)} note="Registered profiles" icon={Users} />
        <MetricCard label="Games Played" value={loading ? "..." : String(overview.metrics.gamesPlayed)} note="Recorded games" icon={Trophy} />
        <MetricCard label="New Signups" value={loading ? "..." : String(overview.metrics.newSignups)} note="Last 7 days" icon={Mail} />
        <MetricCard label="Open Messages" value={loading ? "..." : String(overview.metrics.openReports)} note="Needs reply" icon={FileText} />
      </section>

      <LzyumiRefreshPanel />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Panel title="Activity Overview" icon={Activity}>
          <ActivityChart metrics={overview.metrics} />
        </Panel>
        <Panel title="Recent Users" icon={Users}>
          <div className="space-y-3">
            {loading && <EmptyAdminState text="Loading users..." />}
            {!loading && recentUsers.length === 0 && (
              <EmptyAdminState text="No registered player profiles yet." />
            )}
            {recentUsers.map((user) => (
              <div key={user.id} className="rounded-xl border border-[#242424] bg-[#101010] p-3">
                <p className="text-sm font-black text-white">{user.player}</p>
                <p className="mt-1 text-xs font-semibold text-[#8d8d8d]">
                  {user.riot} / {user.accountStatus} / {user.verificationStatus}
                </p>
              </div>
            ))}
            {recentUsers.length > 0 && (
              <button
                type="button"
                onClick={() => setActive("users")}
                className="w-full rounded-xl bg-white/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#d8d8d8] transition hover:bg-[#b11226]"
              >
                View all users
              </button>
            )}
          </div>
        </Panel>
      </section>

      <Panel title="Recent Admin Notes" icon={PenSquare}>
        <div className="space-y-3">
          {loading && <EmptyAdminState text="Loading recent activity..." />}
          {!loading && overview.recentNotes.length === 0 && (
            <EmptyAdminState text="No recent admin activity is available yet." />
          )}
          {overview.recentNotes.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#242424] bg-[#101010] p-3 text-sm font-bold text-[#d8d8d8]">
              {item.text}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function LzyumiRefreshPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("Manual refresh updates verified player ranks, recent games, and profile snapshots.");
  const [isError, setIsError] = useState(false);
  const [queue, setQueue] = useState<{
    pending: number;
    processing: number;
    failed: Array<{
      id: string;
      displayName: string;
      riotId: string;
      attemptCount: number;
      nextAttemptAt: string;
      lastError: string | null;
      notifiedAt: string | null;
    }>;
  } | null>(null);

  async function loadQueue() {
    const res = await fetch("/api/admin/lzyumi-refresh-queue", { credentials: "include" });
    if (!res.ok) return;
    setQueue(await res.json());
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function refreshStats() {
    setIsRefreshing(true);
    setIsError(false);
    setMessage("Loading player list...");

    try {
      // Step 1: get players to refresh
      const listRes = await fetch("/api/admin/players-for-refresh", { credentials: "include" });
      if (!listRes.ok) throw new Error("Failed to load player list.");
      const { profiles } = (await listRes.json()) as {
        profiles: { id: string; displayName: string; riotName: string; riotTag: string | null; chinaServerId: number }[];
      };

      if (!profiles.length) {
        setMessage("No verified players found.");
        return;
      }

      let refreshed = 0;
      let failed = 0;
      const failures: string[] = [];

      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i];
        setMessage(`Refreshing ${i + 1}/${profiles.length}: ${p.displayName}...`);

        try {
          // Step 2: get a signed lzyumi URL from the server
          const tag = (p.riotTag ?? "").replace(/^#+/, "");
          const nickname = tag ? `${p.riotName}#${tag}` : p.riotName;
          const signRes = await fetch(
            `/api/lzyumi-sign?nickname=${encodeURIComponent(nickname)}&areaId=${p.chinaServerId}`,
            { credentials: "include" }
          );
          if (!signRes.ok) throw new Error("Sign failed");
          const { url } = (await signRes.json()) as { url: string };

          // Step 3: call lzyumi from the browser (uses our residential IP, not blocked)
          const lzyumiRes = await fetch(url, {
            headers: {
              Accept: "application/json",
              Referer: "https://a.2025lol.top/",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
          });
          if (!lzyumiRes.ok) throw new Error("lzyumi fetch failed");
          const rawProfile = await lzyumiRes.json();

          // Step 4: save to DB via the server
          const saveRes = await fetch("/api/admin/save-lzyumi", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileId: p.id, rawProfile }),
          });
          if (!saveRes.ok) throw new Error("Save failed");

          refreshed++;
        } catch (error) {
          failed++;
          if (failures.length < 5) {
            failures.push(
              `${p.displayName}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }
      }

      const failureDetails = failures.length > 0 ? ` First failures: ${failures.join(" | ")}` : "";
      const status = failed > 0
        ? `Refreshed ${refreshed}/${profiles.length} profiles. ${failed} failed.${failureDetails}`
        : `Refreshed ${refreshed}/${profiles.length} profiles.`;
      setMessage(status);
      if (failed > 0 && refreshed === 0) setIsError(true);
      loadQueue();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Panel title="ecl.gg Stat Refresh" icon={RefreshCw}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#cfcfcf]">
            Pull fresh profile snapshots for verified users so solo/flex ranks and recent games stay current.
          </p>
          <p className={`mt-2 text-xs font-black uppercase tracking-[0.12em] ${isError ? "text-[#ff3046]" : "text-[#8d8d8d]"}`}>
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={refreshStats}
          disabled={isRefreshing}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ff1731] px-5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ff3046] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Refreshing" : "Refresh ecl.gg Data"}
        </button>
      </div>
      <div className="mt-5 rounded-xl border border-[#242424] bg-[#101010] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8d8d8d]">
            Background Queue
          </p>
          <button
            type="button"
            onClick={loadQueue}
            className="rounded-lg border border-[#2f2f2f] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#cfcfcf] transition hover:border-[#ff3046] hover:text-white"
          >
            Refresh Queue
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#777]">Pending</p>
            <p className="mt-1 text-2xl font-black text-white">{queue?.pending ?? "-"}</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#777]">Processing</p>
            <p className="mt-1 text-2xl font-black text-white">{queue?.processing ?? "-"}</p>
          </div>
          <div className="rounded-lg bg-black/30 p-3">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#777]">Failed</p>
            <p className="mt-1 text-2xl font-black text-[#ff3046]">{queue?.failed.length ?? "-"}</p>
          </div>
        </div>
        {queue && queue.failed.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.failed.map((failure) => (
              <div key={failure.id} className="rounded-lg border border-[#ff3046]/20 bg-[#ff3046]/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-white">{failure.displayName}</p>
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-[#ff9aaa]">
                    {failure.attemptCount} attempts
                  </p>
                </div>
                <p className="mt-1 text-xs font-bold text-[#cfcfcf]">{failure.riotId}</p>
                {failure.lastError && (
                  <p className="mt-2 line-clamp-2 text-xs font-semibold text-[#ffbdc6]">
                    {failure.lastError}
                  </p>
                )}
                <p className="mt-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[#8d8d8d]">
                  Next retry {new Date(failure.nextAttemptAt).toLocaleString()}
                  {failure.notifiedAt ? " / admins notified" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function UsersSection({
  users,
  loading,
  onRefresh,
}: {
  users: AdminOverview["users"];
  loading: boolean;
  onRefresh: () => void;
}) {
  type User = AdminOverview["users"][number];

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.player.toLowerCase().includes(q) ||
      u.riot.toLowerCase().includes(q) ||
      u.kook.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  function openEdit(user: User) {
    setEditForm({
      displayName: user.displayName,
      riotName: user.riotName,
      riotTag: user.riotTag,
      kookId: user.kookId,
      kookUsername: user.kookUsername,
      wechatId: user.wechatId,
      chinaServerId: String(user.chinaServerId ?? ""),
      accountStatus: user.accountStatus,
      verificationStatus: user.verificationStatus,
    });
    setActionMsg("");
    setEditingUser(user);
  }

  async function saveEdit() {
    if (!editingUser) return;
    setSaving(true);
    setActionMsg("");
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setActionMsg("Saved successfully.");
      setEditingUser(null);
      onRefresh();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    setActionMsg("");
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setDeletingUser(null);
      onRefresh();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[#2b2b2b] bg-[#111] px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#b11226]";
  const labelCls = "block text-xs font-black uppercase tracking-[0.1em] text-[#8d8d8d] mb-1";

  return (
    <>
      <Panel title="Users" icon={Users}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              placeholder="Search by name, Riot ID, KOOK ID, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[#242424] bg-[#111] py-2 pl-8 pr-4 text-sm text-white placeholder-[#555] outline-none focus:border-[#b11226]"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#242424]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111111] text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8d8d8d]">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">KOOK ID</th>
                <th className="px-4 py-3">Riot ID</th>
                <th className="px-4 py-3">WeChat</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-[#8d8d8d]">
                    Loading players...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-[#8d8d8d]">
                    {users.length === 0 ? "No registered player profiles yet." : "No results match your search."}
                  </td>
                </tr>
              )}
              {filtered.map((user) => (
                <tr key={user.id} className="border-t border-[#242424] hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <p className="font-black text-white">{user.player}</p>
                    <p className="text-xs text-[#8d8d8d]">
                      {user.role} / {user.rank} / {user.accountStatus} / {user.verificationStatus}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[#cfcfcf]">{user.email}</td>
                  <td className="px-4 py-4 text-[#cfcfcf]">{user.kook}</td>
                  <td className="px-4 py-4 text-[#cfcfcf]">{user.riot}</td>
                  <td className="px-4 py-4 text-[#cfcfcf]">{user.wechat}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <ActionButton label="Edit" icon={Edit3} onClick={() => openEdit(user)} />
                      <ActionButton label="Remove" icon={Trash2} danger onClick={() => { setActionMsg(""); setDeletingUser(user); }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {actionMsg && (
          <p className={`mt-3 text-xs font-black ${actionMsg.includes("success") ? "text-green-400" : "text-[#ff5b70]"}`}>
            {actionMsg}
          </p>
        )}
      </Panel>

      {/* ── Edit Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="w-full max-w-lg rounded-2xl border border-[#2b2b2b] bg-[#0d0d0d] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#b11226]">Edit Profile</p>
                <h2 className="mt-1 text-lg font-black text-white">{editingUser.player}</h2>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg p-1 text-[#8d8d8d] hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Display Name</label>
                  <input className={inputCls} value={editForm.displayName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>WeChat ID</label>
                  <input className={inputCls} value={editForm.wechatId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, wechatId: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Riot Name</label>
                  <input className={inputCls} value={editForm.riotName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, riotName: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Riot Tag (no #)</label>
                  <input className={inputCls} placeholder="e.g. EUW" value={editForm.riotTag ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, riotTag: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kook ID (numeric)</label>
                  <input className={inputCls} placeholder="e.g. 2250999902" value={editForm.kookId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, kookId: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Kook Username</label>
                  <input className={inputCls} value={editForm.kookUsername ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, kookUsername: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className={labelCls}>China Server ID (for lzyumi)</label>
                <input className={inputCls} placeholder="e.g. 12345678" value={editForm.chinaServerId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, chinaServerId: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Account Status</label>
                  <select className={inputCls} value={editForm.accountStatus ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, accountStatus: e.target.value }))}>
                    <option value="PENDING">PENDING</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Verification Status</label>
                  <select className={inputCls} value={editForm.verificationStatus ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, verificationStatus: e.target.value }))}>
                    <option value="PENDING_KOOK">PENDING_KOOK</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>
            </div>

            {actionMsg && (
              <p className={`mt-3 text-xs font-black ${actionMsg.includes("success") ? "text-green-400" : "text-[#ff5b70]"}`}>
                {actionMsg}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-xl border border-[#2b2b2b] px-4 py-2 text-xs font-black text-[#8d8d8d] hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#b11226] px-5 py-2 text-xs font-black text-white transition hover:bg-[#d41530] disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingUser && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#b11226]/40 bg-[#0d0d0d] p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#b11226]/20">
                <AlertTriangle size={32} className="text-[#ff3046]" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff3046]">⚠ Destructive Action</p>
              <h2 className="mt-2 text-2xl font-black text-white">Delete Account?</h2>
              <p className="mt-3 text-sm font-semibold text-[#8d8d8d]">
                You are about to permanently delete the account for
              </p>
              <p className="mt-2 text-xl font-black text-white">{deletingUser.player}</p>
              <p className="mt-1 text-sm text-[#8d8d8d]">{deletingUser.email}</p>
              <div className="mt-5 w-full rounded-xl border border-[#b11226]/30 bg-[#1a0608] p-4 text-left text-xs font-semibold text-[#ff7b8a]">
                <p className="font-black">This will permanently erase:</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Their login credentials and account</li>
                  <li>Profile data (Riot ID, KOOK ID, rank, etc.)</li>
                  <li>All Kook verification records</li>
                </ul>
                <p className="mt-3 font-black text-[#ff3046]">This cannot be undone.</p>
              </div>
            </div>

            {actionMsg && (
              <p className="mt-4 text-center text-xs font-black text-[#ff5b70]">{actionMsg}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setDeletingUser(null); setActionMsg(""); }}
                className="flex-1 rounded-xl border border-[#2b2b2b] py-3 text-sm font-black text-[#8d8d8d] transition hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-[#b11226] py-3 text-sm font-black text-white transition hover:bg-[#d41530] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MatchesSection({
  matches,
  loading,
}: {
  matches: AdminOverview["matches"];
  loading: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel title="Report Calendar" icon={CalendarDays}>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, index) => (
            <button
              key={index}
              className={`aspect-square rounded-xl text-xs font-black ${
                [3, 8, 14, 18, 22].includes(index)
                  ? "bg-[#b11226] text-white"
                  : "bg-[#111111] text-[#777]"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Match Reports" icon={FileText}>
        <div className="space-y-3">
          {loading && <EmptyAdminState text="Loading matches..." />}
          {!loading && matches.length === 0 && (
            <EmptyAdminState text="No matches have been recorded yet." />
          )}
          {matches.map((match) => (
            <div key={match.id} className="rounded-xl border border-[#242424] bg-[#101010] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-black text-white">
                    {match.blue} {match.score} {match.red}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#8d8d8d]">
                    {match.label} / {new Date(match.date).toLocaleString()} / {match.duration}
                  </p>
                </div>
                <span className="rounded-full bg-[#b11226]/15 px-3 py-1 text-xs font-black text-[#ff5b70]">
                  {match.status}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton label="Open Report" icon={FileText} />
                <ActionButton label="Edit" icon={PenSquare} />
                <ActionButton label="Delete Duplicate" icon={Trash2} danger />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function EloSection() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Panel title="ELO / LP Rules" icon={Gauge}>
        <div className="grid gap-3 md:grid-cols-2">
          <ConfigCard label="Base win LP" value="+24" />
          <ConfigCard label="Base loss LP" value="-18" />
          <ConfigCard label="MVP bonus" value="+4" />
          <ConfigCard label="SVP protection" value="+3 loss reduction" />
          <ConfigCard label="Streak bonus" value="+2 after 3 wins" />
          <ConfigCard label="Rating floor" value="800 ELO" />
        </div>
      </Panel>
      <Panel title="Manual ELO Override" icon={Edit3}>
        <div className="space-y-3">
          <MockInput label="Player" value="Select a player" />
          <MockInput label="New ELO" value="Enter new ELO" />
          <MockInput label="Admin Reason" value="Required before saving" />
          <button className="min-h-11 w-full rounded-xl bg-[#b11226] text-xs font-black uppercase tracking-[0.08em]">
            Save Override
          </button>
        </div>
      </Panel>
    </div>
  );
}

function AdminsSection({
  admins,
  loading,
}: {
  admins: AdminOverview["adminUsers"];
  loading: boolean;
}) {
  return (
    <Panel title="Admin Users" icon={UserCog}>
      <div className="grid gap-4 lg:grid-cols-3">
        {loading && <EmptyAdminState text="Loading admin users..." />}
        {!loading && admins.length === 0 && (
          <EmptyAdminState text="Admin users are controlled by environment variables and no display email is configured." />
        )}
        {admins.map((admin) => (
          <div key={admin.email} className="rounded-xl border border-[#242424] bg-[#101010] p-4">
            <p className="flex items-center gap-2 text-sm font-black">
              <Mail size={15} />
              {admin.email}
            </p>
            <p className="mt-2 text-xs font-semibold text-[#8d8d8d]">
              {admin.role}
            </p>
            <div className="mt-4 flex gap-2">
              <ActionButton label="Reset Password" icon={KeyRound} />
              <ActionButton label="Remove" icon={Trash2} danger />
            </div>
          </div>
        ))}
      </div>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#b11226] px-4 text-xs font-black uppercase tracking-[0.08em]">
        <Plus size={15} />
        Add Admin by Email
      </button>
    </Panel>
  );
}

function MessagesSection() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMessages() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/contact-messages", {
      cache: "no-store",
      credentials: "include",
    });

    if (!res.ok) {
      setError("Could not load contact messages.");
      setLoading(false);
      return;
    }

    setMessages(await res.json());
    setLoading(false);
  }

  async function setMessageStatus(id: string, status: "new" | "resolved") {
    const res = await fetch("/api/admin/contact-messages", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (res.ok) {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, status } : message,
        ),
      );
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  return (
    <Panel title="Contact Messages" icon={MessageSquareText}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#8d8d8d]">
          Messages submitted from the public Contact page.
        </p>
        <button
          type="button"
          onClick={loadMessages}
          className="inline-flex min-h-10 items-center rounded-xl bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#d8d8d8]"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <p className="rounded-xl border border-[#242424] bg-[#101010] p-4 text-sm font-bold text-[#8d8d8d]">
          Loading messages...
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-[#b11226]/40 bg-[#b11226]/10 p-4 text-sm font-bold text-[#ff8c9a]">
          {error}
        </p>
      )}

      {!loading && !error && messages.length === 0 && (
        <p className="rounded-xl border border-[#242424] bg-[#101010] p-4 text-sm font-bold text-[#8d8d8d]">
          No contact messages have been submitted.
        </p>
      )}

      <div className="space-y-3">
        {messages.map((message) => (
          <article key={message.id} className="rounded-xl border border-[#242424] bg-[#101010] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b11226]">
                  {message.topic.replaceAll("-", " ")}
                </p>
                <h3 className="mt-2 text-base font-black text-white">{message.name}</h3>
                <p className="mt-1 text-xs font-semibold text-[#8d8d8d]">
                  {message.contact} / {new Date(message.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${
                message.status === "resolved"
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-[#b11226]/15 text-[#ff5b70]"
              }`}>
                {message.status}
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#d8d8d8]">
              {message.message}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setMessageStatus(
                    message.id,
                    message.status === "resolved" ? "new" : "resolved",
                  )
                }
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-white/[0.06] px-3 text-xs font-black text-[#d8d8d8]"
              >
                {message.status === "resolved" ? "Reopen" : "Mark Resolved"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function NewsSection({
  drafts,
  loading,
}: {
  drafts: AdminOverview["newsDrafts"];
  loading: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Panel title="News Drafts" icon={Newspaper}>
        <div className="space-y-3">
          {loading && <EmptyAdminState text="Loading news drafts..." />}
          {!loading && drafts.length === 0 && (
            <EmptyAdminState text="No news draft data source exists yet." />
          )}
          {drafts.map((draft) => (
            <div key={draft.title} className="rounded-xl border border-[#242424] bg-[#101010] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#b11226]">
                    {draft.type}
                  </p>
                  <h3 className="mt-2 text-base font-black">{draft.title}</h3>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-[#cfcfcf]">
                  {draft.status}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton label="Edit Draft" icon={PenSquare} />
                <ActionButton label="Upload Image" icon={FileText} />
                <ActionButton label="Delete" icon={Trash2} danger />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Create News Item" icon={Plus}>
        <EmptyAdminState text="News drafts need a database model before publishing tools can be enabled." />
      </Panel>
    </div>
  );
}

function AdminNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition ${
        active
          ? "bg-[#b11226] text-white"
          : "text-[#8d8d8d] hover:bg-[#151515] hover:text-white"
      }`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-xl border border-[#242424] bg-[#101010] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#9b9b9b]">{label}</p>
        <Icon size={17} className="text-[#b11226]" />
      </div>
      <p className="mt-5 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#b11226]">{note}</p>
    </article>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#242424] bg-[#0b0b0b] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black tracking-normal">{title}</h2>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b11226]/15 text-[#ff5b70]">
          <Icon size={17} />
        </span>
      </div>
      {children}
    </section>
  );
}

function ActionButton({
  label,
  icon: Icon,
  danger = false,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "bg-[#b11226]/15 text-[#ff5b70] hover:bg-[#b11226]/30"
          : "bg-white/[0.06] text-[#d8d8d8] hover:bg-white/[0.12]"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function EmptyAdminState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[#242424] bg-[#101010] p-4 text-sm font-bold text-[#8d8d8d]">
      {text}
    </div>
  );
}

function ConfigCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#242424] bg-[#101010] p-4">
      <p className="text-xs font-bold text-[#8d8d8d]">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function MockInput({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8d8d8d]">
        {label}
      </span>
      <span className="mt-2 block rounded-xl border border-[#242424] bg-[#101010] px-4 py-3 text-sm font-bold text-[#cfcfcf]">
        {value}
      </span>
    </label>
  );
}

function ActivityChart({ metrics }: { metrics: AdminOverview["metrics"] }) {
  const values = [
    { label: "Players", value: metrics.players },
    { label: "Games", value: metrics.gamesPlayed },
    { label: "Signups", value: metrics.newSignups },
    { label: "Open", value: metrics.openReports },
  ];
  const maxValue = Math.max(...values.map((item) => item.value), 1);

  return (
    <div className="h-72">
      <div className="flex h-56 items-end gap-3 border-b border-[#242424] px-1">
        {values.map((item, index) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
            <div
              className={`w-full max-w-12 rounded-t-2xl ${
                index === 2 ? "bg-[#b11226]" : "bg-[#292929]"
              }`}
              style={{ height: `${Math.max(10, (item.value / maxValue) * 180)}px` }}
            />
            <span className="text-[0.68rem] font-semibold text-[#777]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
