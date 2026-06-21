"use client";

import Link from "next/link";
import {
  Activity,
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
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCog,
  Users,
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
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
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
            {active === "dashboard" && <DashboardSection overview={overview} loading={overviewLoading} />}
            {active === "users" && <UsersSection users={overview.users} loading={overviewLoading} />}
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
}: {
  overview: AdminOverview;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Players" value={loading ? "..." : String(overview.metrics.players)} note="Registered profiles" icon={Users} />
        <MetricCard label="Games Played" value={loading ? "..." : String(overview.metrics.gamesPlayed)} note="Recorded games" icon={Trophy} />
        <MetricCard label="New Signups" value={loading ? "..." : String(overview.metrics.newSignups)} note="Last 7 days" icon={Mail} />
        <MetricCard label="Open Messages" value={loading ? "..." : String(overview.metrics.openReports)} note="Needs reply" icon={FileText} />
      </section>

      <LzyumiRefreshPanel />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Activity Overview" icon={Activity}>
          <ActivityChart metrics={overview.metrics} />
        </Panel>
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
      </section>
    </div>
  );
}

function LzyumiRefreshPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("Manual refresh updates verified player ranks, recent games, and profile snapshots.");
  const [isError, setIsError] = useState(false);

  async function refreshStats() {
    setIsRefreshing(true);
    setIsError(false);
    setMessage("Refreshing verified player data from ecl.gg...");

    try {
      const response = await fetch("/api/admin/refresh-lzyumi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = (await response.json()) as {
        selected?: number;
        refreshed?: number;
        failed?: number;
        success?: boolean;
        error?: string;
      };

      if (!response.ok || data.success === false) {
        throw new Error(data.error ?? `${data.failed ?? 0} profiles failed to refresh.`);
      }

      setMessage(`Refreshed ${data.refreshed ?? 0}/${data.selected ?? 0} verified profiles.`);
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
    </Panel>
  );
}

function UsersSection({
  users,
  loading,
}: {
  users: AdminOverview["users"];
  loading: boolean;
}) {
  return (
    <Panel title="Users" icon={Users}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#8d8d8d]">
          Player, email, KOOK ID, Riot ID, WeChat, and quick admin actions.
        </p>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#b11226] px-4 text-xs font-black uppercase tracking-[0.08em]">
          <Plus size={15} />
          Add Player
        </button>
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
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-[#8d8d8d]">
                  No registered player profiles yet.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[#242424]">
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
                    <ActionButton label="Edit" icon={Edit3} />
                    <ActionButton label="Remove" icon={Trash2} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
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
        <EmptyAdminState text="ELO rule configuration is not stored in the database yet." />
      </Panel>
      <Panel title="Manual ELO Override" icon={Edit3}>
        <EmptyAdminState text="Manual ELO overrides need an audit-log model before they can be enabled." />
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

    const res = await fetch("/api/admin/contact-messages", { cache: "no-store" });

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
}: {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black ${
        danger
          ? "bg-[#b11226]/15 text-[#ff5b70]"
          : "bg-white/[0.06] text-[#d8d8d8]"
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
