<nav className="hidden items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300 md:flex">
  <Link
    href="/"
    className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
  >
    Home
  </Link>

  <Link
    href="/register/team"
    className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
  >
    Team Signup
  </Link>

  <Link
    href="/register/free-agent"
    className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
  >
    Free Agent
  </Link>

  <Link
    href="/teams"
    className="rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
  >
    Teams
  </Link>

  <div className="group relative">
    <button
      type="button"
      className="flex items-center gap-2 rounded-md px-3 py-2 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
    >
      Split One
      <span className="text-[0.65rem]">▼</span>
    </button>

    <div className="invisible absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 opacity-0 shadow-[0_0_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-200 group-hover:visible group-hover:opacity-100">
      {splitOneLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="block rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-300 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
        >
          {link.label}
        </Link>
      ))}
    </div>
  </div>

  <a
    href="https://www.youtube.com/@ECL-LoL"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="ECL YouTube Channel"
    className="rounded-md p-2 text-zinc-300 transition duration-200 hover:bg-green-500/10 hover:text-green-400"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8ZM9.75 15.5v-7L16 12l-6.25 3.5Z" />
    </svg>
  </a>
</nav>