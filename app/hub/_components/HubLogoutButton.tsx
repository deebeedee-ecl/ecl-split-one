"use client";

import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function HubLogoutButton() {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      aria-label="Log out"
      title="Log out"
      className="group relative flex h-12 w-12 items-center justify-center text-[#8f96a3] transition hover:bg-[#ff1728]/12 hover:text-[#f2f2f2]"
    >
      <LogOut size={23} strokeWidth={2.15} className="transition" />
      <span className="pointer-events-none absolute left-[3.85rem] z-[999] w-64 border border-white/[0.12] bg-[#15161a] px-4 py-3 text-left opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.45)] transition group-hover:translate-x-1 group-hover:opacity-100">
        <span className="block text-sm font-black text-[#f2f2f2]">Log out</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#a9adb4]">
          End this browser session and return to login.
        </span>
      </span>
    </button>
  );
}
