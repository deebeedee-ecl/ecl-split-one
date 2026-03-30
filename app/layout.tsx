import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECL Split One",
  description: "ECL tournament portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <header className="border-b border-white/10 bg-black/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="text-xl font-black uppercase tracking-[0.2em] text-white"
            >
              ECL
            </Link>

            <nav className="flex flex-wrap gap-4 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">
              <Link href="/" className="hover:text-green-400">
                Home
              </Link>
              <Link href="/register/team" className="hover:text-green-400">
                Team Signup
              </Link>
              <Link href="/register/free-agent" className="hover:text-green-400">
                Free Agent
              </Link>
              <Link href="/teams" className="hover:text-green-400">
                Teams
              </Link>
              <Link href="/schedule" className="hover:text-green-400">
                Schedule
              </Link>
              <Link href="/standings" className="hover:text-green-400">
                Standings
              </Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}