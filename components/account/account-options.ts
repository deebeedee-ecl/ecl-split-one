export const roles = ["TOP", "JGL", "MID", "ADC", "SUP", "FILL"];

export const avatarStyles = [
  { id: "crest", label: "Crest" },
  { id: "blade", label: "Blade" },
  { id: "dragon", label: "Dragon" },
  { id: "minimal", label: "Minimal" },
];

export const dashboardThemes = [
  { id: "crimson", label: "Crimson" },
  { id: "obsidian", label: "Obsidian" },
  { id: "broadcast", label: "Broadcast" },
  { id: "clean", label: "Clean" },
];

export const chinaServerOptions = [
  { id: "1", name: "Ionia", chineseName: "\u827e\u6b27\u5c3c\u4e9a" },
  { id: "14", name: "Black Rose", chineseName: "\u9ed1\u8272\u73ab\u7470" },
  { id: "31", name: "Valley of The Rift", chineseName: "\u5ce1\u8c37\u4e4b\u5dc5" },
  { id: "30", name: "Baron Domain", chineseName: "\u7537\u7235\u9886\u57df" },
  { id: "3", name: "Zaun", chineseName: "\u7956\u5b89" },
  { id: "4", name: "Noxus", chineseName: "\u8bfa\u514b\u8428\u65af" },
  { id: "16", name: "Shurima", chineseName: "\u6055\u745e\u739b" },
];

export const countryOptions = [
  { code: "", name: "Prefer not to say", flag: "" },
  { code: "AR", name: "Argentina", flag: "\uD83C\uDDE6\uD83C\uDDF7" },
  { code: "AU", name: "Australia", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { code: "BR", name: "Brazil", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { code: "CA", name: "Canada", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  { code: "CL", name: "Chile", flag: "\uD83C\uDDE8\uD83C\uDDF1" },
  { code: "CN", name: "China", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { code: "DK", name: "Denmark", flag: "\uD83C\uDDE9\uD83C\uDDF0" },
  { code: "FI", name: "Finland", flag: "\uD83C\uDDEB\uD83C\uDDEE" },
  { code: "FR", name: "France", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { code: "DE", name: "Germany", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { code: "HK", name: "Hong Kong", flag: "\uD83C\uDDED\uD83C\uDDF0" },
  { code: "IN", name: "India", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { code: "ID", name: "Indonesia", flag: "\uD83C\uDDEE\uD83C\uDDE9" },
  { code: "IE", name: "Ireland", flag: "\uD83C\uDDEE\uD83C\uDDEA" },
  { code: "IT", name: "Italy", flag: "\uD83C\uDDEE\uD83C\uDDF9" },
  { code: "JP", name: "Japan", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "MY", name: "Malaysia", flag: "\uD83C\uDDF2\uD83C\uDDFE" },
  { code: "MX", name: "Mexico", flag: "\uD83C\uDDF2\uD83C\uDDFD" },
  { code: "NL", name: "Netherlands", flag: "\uD83C\uDDF3\uD83C\uDDF1" },
  { code: "NZ", name: "New Zealand", flag: "\uD83C\uDDF3\uD83C\uDDFF" },
  { code: "NO", name: "Norway", flag: "\uD83C\uDDF3\uD83C\uDDF4" },
  { code: "PH", name: "Philippines", flag: "\uD83C\uDDF5\uD83C\uDDED" },
  { code: "PL", name: "Poland", flag: "\uD83C\uDDF5\uD83C\uDDF1" },
  { code: "PT", name: "Portugal", flag: "\uD83C\uDDF5\uD83C\uDDF9" },
  { code: "RU", name: "Russia", flag: "\uD83C\uDDF7\uD83C\uDDFA" },
  { code: "SG", name: "Singapore", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { code: "ZA", name: "South Africa", flag: "\uD83C\uDDFF\uD83C\uDDE6" },
  { code: "KR", name: "South Korea", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { code: "ES", name: "Spain", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { code: "SE", name: "Sweden", flag: "\uD83C\uDDF8\uD83C\uDDEA" },
  { code: "TW", name: "Taiwan", flag: "\uD83C\uDDF9\uD83C\uDDFC" },
  { code: "TH", name: "Thailand", flag: "\uD83C\uDDF9\uD83C\uDDED" },
  { code: "TR", name: "Turkey", flag: "\uD83C\uDDF9\uD83C\uDDF7" },
  { code: "GB", name: "United Kingdom", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "US", name: "United States", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "VN", name: "Vietnam", flag: "\uD83C\uDDFB\uD83C\uDDF3" },
];

export function getCountryOption(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (
    countryOptions.find(
      (country) =>
        country.code.toLowerCase() === normalized ||
        country.name.toLowerCase() === normalized,
    ) ?? null
  );
}

export function getChinaServerDisplayName(id?: string | number | null, name?: string | null) {
  const normalizedId = id === undefined || id === null ? "" : String(id);
  const server =
    chinaServerOptions.find((item) => item.id === normalizedId) ??
    chinaServerOptions.find((item) => item.chineseName === name || item.name === name);

  return server?.name ?? name ?? "";
}
