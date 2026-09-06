import { countryByCode, countryFlagImagePath } from "@/lib/world-cup-countries";

export function WorldCupFlag({
  code,
  label,
  className = "",
}: {
  code?: string | null;
  label?: string | null;
  className?: string;
}) {
  const country = countryByCode(code);
  const src = countryFlagImagePath(code);
  const text = label || country?.name || "Country pending";

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
          loading="lazy"
        />
      ) : (
        <span className="h-4 w-6 shrink-0 rounded-[2px] border border-[#36D7FF]/22 bg-[#061C4A]" />
      )}
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}
