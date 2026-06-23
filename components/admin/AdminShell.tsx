"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Gauge,
  Home,
  LogOut,
  MessageSquareText,
  Newspaper,
  ShieldCheck,
  Swords,
  UserCog,
  Users,
} from "lucide-react";

const navLinks = [
  { href: "/admin", label: "Dashboard", icon: Activity },
  { href: "/admin#users", label: "Users", icon: Users },
  { href: "/admin#matches", label: "Match History", icon: CalendarDays },
  { href: "/admin#elo", label: "ELO / LP", icon: Gauge },
  { href: "/admin#admins", label: "Admin Users", icon: UserCog },
  { href: "/admin#messages", label: "Messages", icon: MessageSquareText },
  { href: "/admin#news", label: "News Drafts", icon: Newspaper },
];

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin/login";
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-4 text-xs font-black uppercase tracking-[0.08em] transition ${
                  pathname === href.split("#")[0] && !href.includes("#") && pathname !== "/admin/inhouse"
                    ? "bg-[#b11226] text-white"
                    : "text-[#8d8d8d] hover:bg-[#1a1a1a] hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
            <Link
              href="/admin/inhouse"
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-4 text-xs font-black uppercase tracking-[0.08em] transition ${
                pathname === "/admin/inhouse"
                  ? "bg-[#b11226] text-white"
                  : "text-[#8d8d8d] hover:bg-[#1a1a1a] hover:text-white"
              }`}
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

        <section className="min-w-0 overflow-auto p-5 lg:p-7">
          {children}
        </section>
      </div>
    </main>
  );
}
