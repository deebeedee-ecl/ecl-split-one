import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthenticatedAccount } from "@/lib/account-auth";
import { hubRoleLabel, normalizeHubRole } from "@/lib/hub-profile";
import { riotIdKey } from "@/lib/riot-id";
import {
  SPLIT_II_CAPACITY, SPLIT_II_FLOATER_RULES_VERSION, SPLIT_II_RULES_VERSION, SPLIT_II_SLUG, SPLIT_II_TERMS_VERSION,
  type TournamentPool, type TournamentRegistrationState, type TournamentViewer,
} from "./split-ii-config";

type Database = PrismaClient | Prisma.TransactionClient;

export class RegistrationError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "RegistrationError";
  }
}

function roleLabel(value: string) {
  const role = normalizeHubRole(value);
  return role ? hubRoleLabel(role) : "";
}

const profileSelect = {
  id: true, displayName: true, riotName: true, riotTag: true, primaryRole: true,
  secondaryRole: true, chinaServerId: true, openId: true,
  verificationStatus: true, accountStatus: true,
} satisfies Prisma.AccountProfileSelect;

function loadProfile(database: Database, account: AuthenticatedAccount | null) {
  return account ? database.accountProfile.findUnique({ where: { userId: account.id }, select: profileSelect }) : null;
}

type Profile = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

function viewerFor(account: AuthenticatedAccount | null, profile: Profile | null): TournamentViewer {
  if (!account) return { account: "signed-out", name: "Your ECL profile", riotId: "", role: "" };
  if (!profile) return { account: "profile-required", name: "Your ECL profile", riotId: "", role: "" };
  const role = roleLabel(profile.primaryRole);
  const state = profile.accountStatus === "SUSPENDED" ? "suspended"
    : profile.accountStatus !== "ACTIVE" || profile.verificationStatus !== "VERIFIED" ? "unverified"
    : !role || !profile.displayName.trim() || !profile.riotName.trim() || !profile.riotTag.trim() ? "profile-required"
    : "eligible";
  return { account: state, name: profile.displayName, riotId: `${profile.riotName}#${profile.riotTag.replace(/^#+/, "")}`, role };
}

function windowFor(event: {
  status: string; registrationOpensAt: Date | null; registrationClosesAt: Date | null;
  termsVersion: string | null; rulesVersion: string | null;
}, now: Date): TournamentRegistrationState["window"] {
  if (event.status !== "REGISTRATION_OPEN" || !event.registrationOpensAt
    || event.termsVersion !== SPLIT_II_TERMS_VERSION || event.rulesVersion !== SPLIT_II_RULES_VERSION) return "closed";
  if (now < event.registrationOpensAt) return "scheduled";
  if (event.registrationClosesAt && now >= event.registrationClosesAt) return "closed";
  return "open";
}

export async function getRegistrationState(database: Database, account: AuthenticatedAccount | null, now = new Date()): Promise<TournamentRegistrationState> {
  const event = await database.tournament.findUnique({
    where: { slug: SPLIT_II_SLUG },
    include: { registrations: { orderBy: [{ registeredAt: "asc" }, { id: "asc" }], select: {
      id: true, profileId: true, pool: true, displayNameSnapshot: true, primaryRoleSnapshot: true,
      profile: { select: { riotName: true, riotTag: true } },
    } } },
  });
  if (!event) throw new RegistrationError(503, "NOT_READY", "Registration is being prepared. Please check back shortly.");
  // Accept the old configuration during deployment; application claims already cap at 25.
  if (![SPLIT_II_CAPACITY, 30].includes(event.capacity)) throw new RegistrationError(503, "CONFIGURATION", "Registration is temporarily unavailable. Please try again later.");
  const main = event.registrations.filter(entry => entry.pool === "MAIN");
  const floaters = event.registrations.filter(entry => entry.pool === "FLOATER");
  const profile = await loadProfile(database, account);
  const ownIndex = profile ? main.findIndex(entry => entry.profileId === profile.id) : -1;
  const own = ownIndex >= 0 ? main[ownIndex] : null;
  const floaterIndex = profile ? floaters.findIndex(entry => entry.profileId === profile.id) : -1;
  const ownFloater = floaterIndex >= 0 ? floaters[floaterIndex] : null;
  const entryFor = (entry: typeof main[number]) => ({ id: entry.id, name: entry.displayNameSnapshot, role: roleLabel(entry.primaryRoleSnapshot) });
  return {
    capacity: Math.min(event.capacity, SPLIT_II_CAPACITY),
    count: main.length,
    window: windowFor(event, now),
    opensAt: event.registrationOpensAt?.toISOString() ?? null,
    closesAt: event.registrationClosesAt?.toISOString() ?? null,
    termsVersion: SPLIT_II_TERMS_VERSION,
    rulesVersion: SPLIT_II_RULES_VERSION,
    players: main.map(entry => {
      const name = entry.profile.riotName.trim();
      const tag = entry.profile.riotTag.trim().replace(/^#+/, "");
      return { ...entryFor(entry), riotId: name && tag ? `${name}#${tag}` : undefined };
    }),
    floaters: floaters.map(entryFor),
    floaterWindow: floaterWindowFor(event) ? "open" : "closed",
    floaterRulesVersion: SPLIT_II_FLOATER_RULES_VERSION,
    viewer: viewerFor(account, profile),
    registration: own ? { id: own.id, role: roleLabel(own.primaryRoleSnapshot), ticketNumber: ownIndex + 1 } : null,
    floaterRegistration: ownFloater ? { id: ownFloater.id, role: roleLabel(ownFloater.primaryRoleSnapshot), ticketNumber: floaterIndex + 1 } : null,
  };
}

function floaterWindowFor(event: { status: string; floatersOpen: boolean; floaterRulesVersion: string | null; termsVersion: string | null }) {
  return event.floatersOpen && ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"].includes(event.status)
    && event.floaterRulesVersion === SPLIT_II_FLOATER_RULES_VERSION && event.termsVersion === SPLIT_II_TERMS_VERSION;
}

export type RegistrationConsent = { accepted: true; termsVersion: string; rulesVersion: string; pool?: TournamentPool };

export async function registerForSplitTwo(database: PrismaClient, account: AuthenticatedAccount, consent: RegistrationConsent) {
  if (consent.accepted !== true) throw new RegistrationError(400, "CONSENT_REQUIRED", "Please accept the terms and tournament rules.");
  const pool = consent.pool ?? "MAIN";
  if (pool !== "MAIN" && pool !== "FLOATER") throw new RegistrationError(400, "INVALID_POOL", "Choose the main roster or floater list.");

  return database.$transaction(async transaction => {
    const events = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.tournaments WHERE slug = ${SPLIT_II_SLUG} FOR UPDATE
    `;
    if (!events[0]) throw new RegistrationError(503, "NOT_READY", "Registration is being prepared. Please check back shortly.");
    const eventId = events[0].id;

    await transaction.$queryRaw`
      SELECT id FROM public."AccountProfile" WHERE "userId" = ${account.id} FOR SHARE
    `;
    const profile = await loadProfile(transaction, account);
    if (!profile) throw new RegistrationError(403, "PROFILE_REQUIRED", "Complete your ECL profile before signing up.");

    const existing = await transaction.tournamentRegistration.findUnique({
      where: { tournamentId_profileId: { tournamentId: eventId, profileId: profile.id } }, select: { id: true, pool: true },
    });
    // Retries return the saved entry even after capacity is reached or signup closes.
    if (existing) {
      if (existing.pool !== pool) throw new RegistrationError(409, "ALREADY_REGISTERED", "You already have an entry in the other player pool. Contact an ECL admin to change pools.");
      return { created: false, state: await getRegistrationState(transaction, account) };
    }

    const viewer = viewerFor(account, profile);
    if (viewer.account !== "eligible") {
      throw new RegistrationError(403, "INELIGIBLE", viewer.account === "profile-required"
        ? "Complete your player name, League identity and primary role in ECL settings."
        : "Registration requires an active, verified ECL profile. Please contact an ECL admin if you need help.");
    }
    const event = await transaction.tournament.findUniqueOrThrow({ where: { id: eventId } });
    const now = new Date();
    const expectedRules = pool === "MAIN" ? SPLIT_II_RULES_VERSION : SPLIT_II_FLOATER_RULES_VERSION;
    const eventRules = pool === "MAIN" ? event.rulesVersion : event.floaterRulesVersion;
    if (consent.termsVersion !== SPLIT_II_TERMS_VERSION || consent.rulesVersion !== expectedRules
      || event.termsVersion !== consent.termsVersion || eventRules !== consent.rulesVersion) {
      throw new RegistrationError(409, "RULES_CHANGED", "The registration rules have changed. Refresh the page and review them again.");
    }
    if (pool === "MAIN" ? windowFor(event, now) !== "open" : !floaterWindowFor(event)) throw new RegistrationError(409, "CLOSED", "Registration is not open right now.");
    if (![SPLIT_II_CAPACITY, 30].includes(event.capacity)) throw new RegistrationError(503, "CONFIGURATION", "Registration is temporarily unavailable. Please try again later.");

    const entries = await transaction.tournamentRegistration.findMany({ where: { tournamentId: eventId }, select: {
      pool: true, gameIdentityKey: true, chinaServerIdSnapshot: true, riotNameSnapshot: true, riotTagSnapshot: true,
    } });
    const gameIdentityKey = profile.chinaServerId && profile.openId?.trim()
      ? `${profile.chinaServerId}:${profile.openId.trim()}` : null;
    const sameIdentity = entries.some(entry =>
      (gameIdentityKey !== null && entry.gameIdentityKey === gameIdentityKey)
      || (profile.chinaServerId !== null && entry.chinaServerIdSnapshot === profile.chinaServerId
        && riotIdKey(entry.riotNameSnapshot, entry.riotTagSnapshot) === riotIdKey(profile.riotName, profile.riotTag)));
    if (sameIdentity) throw new RegistrationError(409, "IDENTITY_REGISTERED", "This League account already has a tournament entry. Please contact an ECL admin.");
    if (pool === "MAIN" && entries.filter(entry => entry.pool === "MAIN").length >= Math.min(event.capacity, SPLIT_II_CAPACITY)) throw new RegistrationError(409, "FULL", "All 25 main-roster places have been claimed. You can join the floater list instead.");

    await transaction.tournamentRegistration.create({ data: {
      tournamentId: eventId, profileId: profile.id, pool,
      displayNameSnapshot: profile.displayName.trim(), primaryRoleSnapshot: profile.primaryRole,
      secondaryRoleSnapshot: profile.secondaryRole, riotNameSnapshot: profile.riotName, riotTagSnapshot: profile.riotTag,
      chinaServerIdSnapshot: profile.chinaServerId, gameIdentityKey,
      termsVersion: consent.termsVersion, rulesVersion: consent.rulesVersion,
      consentedAt: now, registeredAt: now,
    } });
    return { created: true, state: await getRegistrationState(transaction, account) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 15_000 });
}
