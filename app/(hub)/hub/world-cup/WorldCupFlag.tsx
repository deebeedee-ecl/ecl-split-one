import { countryByCode, countryFlagImagePath } from "@/lib/world-cup-countries";

export function WorldCupFlag({
  code,
  label,
  size = "default",
  showLabel = false,
  className = "",
}: {
  code?: string | null;
  label?: string | null;
  size?: "small" | "default" | "large" | "hero";
  showLabel?: boolean;
  className?: string;
}) {
  const country = countryByCode(code);
  const src = countryFlagImagePath(code);
  const text = label || country?.name || "Country pending";
  const sizeClass = {
    small: "h-4 w-6",
    default: "h-6 w-9",
    large: "h-10 w-16",
    hero: "h-14 w-24 sm:h-16 sm:w-28",
  }[size];

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={text}
          className={`${sizeClass} shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.18)]`}
          loading="lazy"
        />
      ) : (
        <span className={`${sizeClass} shrink-0 rounded-[2px] border border-[#36D7FF]/22 bg-[#061C4A]`} />
      )}
      {showLabel && <span className="min-w-0 truncate">{text}</span>}
    </span>
  );
}
