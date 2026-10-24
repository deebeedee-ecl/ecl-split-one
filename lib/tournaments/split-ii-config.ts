export const SPLIT_II_SLUG = "ecl-split-ii-2026";
export const SPLIT_II_CAPACITY = 25;
export const SPLIT_II_OPENS_AT = "2026-10-17T04:00:00.000Z"; // Oct 17, 12:00 noon Asia/Shanghai.
export const SPLIT_II_TERMS_VERSION = "ecl-terms-2026-10-16";
export const SPLIT_II_ORIGINAL_RULES_VERSION = "split-ii-registration-2026-10-16";
export const SPLIT_II_RULES_VERSION = "split-ii-registration-2026-10-22";
export const SPLIT_II_FLOATER_RULES_VERSION = "split-ii-floaters-2026-10-22";
export type TournamentPool = "MAIN" | "FLOATER";

// Published consent text: keep this version immutable after registrations open.
// Further rules must be announced separately; do not rewrite accepted wording.
export const SPLIT_II_ORIGINAL_REGISTRATION_RULES = [
  "Registration requires an existing, active and verified ECL account.",
  "The player pool is limited to 30 players. Each player may register once.",
  "Your player name, League identity and primary role are taken from your ECL profile at signup.",
  "Teams will be drawn at random on October 23, 2026. Play begins October 24, with finals on November 20.",
  "First prize is 3,000 RMB.",
  "Players must follow the ECL Terms & Community Rules, including conduct, account identity and fair-play requirements.",
  "Exact match times and match format will be announced through ECL.",
] as const;

export const SPLIT_II_REGISTRATION_RULES = SPLIT_II_ORIGINAL_REGISTRATION_RULES.map((rule, index) =>
  index === 1 ? "The main player pool is limited to 25 players. Each player may register once." : rule);

export const SPLIT_II_FLOATER_RULES = [
  "Floaters must have an existing, active and verified ECL profile.",
  "Floaters are substitutes available for tournament games and scrims; joining this list does not guarantee a game or a main-roster place.",
  "A floater may play one tournament match per team across Split II. Scrims do not count towards this limit.",
  "Your player name, League identity and primary role are taken from your ECL profile at signup.",
  "You may join either the main roster or the floater list, not both.",
  "Players must follow the ECL Terms & Community Rules, including conduct, account identity and fair-play requirements.",
] as const;

export type TournamentRosterEntry = { id: string; name: string; role: string; riotId?: string };
export type TournamentViewer = {
  account: "signed-out" | "profile-required" | "unverified" | "suspended" | "eligible";
  name: string;
  riotId: string;
  role: string;
};
export type TournamentRegistrationState = {
  capacity: number;
  count: number;
  window: "scheduled" | "open" | "closed";
  opensAt: string | null;
  closesAt: string | null;
  termsVersion: string;
  rulesVersion: string;
  players: TournamentRosterEntry[];
  floaters: TournamentRosterEntry[];
  floaterWindow: "open" | "closed";
  floaterRulesVersion: string;
  viewer: TournamentViewer;
  registration: { id: string; role: string; ticketNumber: number } | null;
  floaterRegistration: { id: string; role: string; ticketNumber: number } | null;
};
