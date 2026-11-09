import ForgotPasswordForm from "@/components/account/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#050505] px-4 py-10 text-white sm:px-6">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(177,18,38,0.18),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(177,18,38,0.16),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:76px_76px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center">
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
