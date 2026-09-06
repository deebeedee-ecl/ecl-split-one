export type WorldCupCountry = {
  code: string;
  name: string;
  flag: string;
};

export const worldCupCountries: WorldCupCountry[] = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
];

export function countryByCode(code?: string | null) {
  const cleanCode = code?.trim().toUpperCase();
  return worldCupCountries.find((country) => country.code === cleanCode) ?? null;
}

export function countryByName(name?: string | null) {
  const cleanName = name?.trim().toLowerCase();
  if (!cleanName) return null;
  return worldCupCountries.find((country) => country.name.toLowerCase() === cleanName) ?? null;
}

export function countryFlagImagePath(code?: string | null) {
  const cleanCode = code?.trim().toLowerCase();
  if (!cleanCode || !/^[a-z]{2}$/.test(cleanCode)) return null;
  return `/flags/world-cup/${cleanCode}.png`;
}

export function formatCountryLabel(country?: {
  flag?: string;
  name?: string;
  countryName?: string;
  countryCode?: string;
} | null) {
  if (!country) return "Country pending";

  const matched =
    countryByCode(country.countryCode) ||
    countryByName(country.countryName) ||
    countryByName(country.name);

  const flag = country.flag || matched?.flag;
  const name = country.countryName || country.name || matched?.name;

  if (flag && name) return `${flag} ${name}`;
  if (name) return name;
  return "Country pending";
}

export function countryNameLabel(country?: {
  name?: string;
  countryName?: string;
  countryCode?: string;
} | null) {
  if (!country) return "Country pending";

  const matched =
    countryByCode(country.countryCode) ||
    countryByName(country.countryName) ||
    countryByName(country.name);

  return country.countryName || country.name || matched?.name || "Country pending";
}
