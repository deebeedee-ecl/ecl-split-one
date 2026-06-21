import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,23,40,0.22),transparent_28%),linear-gradient(135deg,rgba(255,23,40,0.12),transparent_35%,rgba(255,255,255,0.03))]" />
      <div className="relative flex min-h-screen items-center justify-center px-5 py-12">
        <Suspense
          fallback={
            <div className="rounded-3xl border border-white/[0.08] bg-[#111217] px-6 py-5 text-sm font-black uppercase tracking-[0.14em] text-[#aeb5da]">
              Loading admin access...
            </div>
          }
        >
          <AdminLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
