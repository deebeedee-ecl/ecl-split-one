export function AuthMediaPanel() {
  return (
    <aside className="relative min-h-[38rem] overflow-hidden rounded-r-[1.4rem] bg-[#0fd6d0]">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/videos/login-hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,214,208,0.08),rgba(15,214,208,0.22))]" />
    </aside>
  );
}
