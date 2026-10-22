// Runs against a fresh loopback-only PostgreSQL cluster. Never loads .env or live credentials.
// Setup: npm install --prefix .tmp/tournament-test-tools --no-save --package-lock=false embedded-postgres@18.4.0-beta.17
// Run: node node_modules/tsx/dist/cli.mjs scripts/test-tournament-registration.ts
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient, type Prisma, type AccountProfile } from "@prisma/client";
import { createRegistrationHandlers } from "../lib/tournaments/registration-http";
import { getRegistrationState, registerForSplitTwo, RegistrationError } from "../lib/tournaments/registration";
import { SPLIT_II_FLOATER_RULES_VERSION, SPLIT_II_OPENS_AT, SPLIT_II_RULES_VERSION, SPLIT_II_SLUG, SPLIT_II_TERMS_VERSION } from "../lib/tournaments/split-ii-config";

async function main() {
  const root = process.cwd();
  const temporary = path.resolve(root, ".tmp");
  const tools = path.resolve(temporary, "tournament-test-tools/node_modules/embedded-postgres/dist/index.js");
  const { default: EmbeddedPostgres } = await import(pathToFileURL(tools).href);
  const password = randomBytes(24).toString("hex");
  const cluster = new EmbeddedPostgres({
    databaseDir: path.join(temporary, `tournament-postgres-${Date.now()}`),
    user: "postgres", password, port: 54329, persistent: true, createPostgresUser: false,
    postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {},
  });
  let database: PrismaClient | undefined;
  let connection: ReturnType<typeof cluster.getPgClient> | undefined;
  const originalWarn = console.warn;
  try {
    await cluster.initialise();
    await cluster.start();
    const name = "ecl_tournament_registration_test";
    await cluster.createDatabase(name);
    const url = new URL(`postgresql://postgres:${password}@127.0.0.1:54329/${name}?connection_limit=12`);
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(url.pathname.endsWith("_test"));
    connection = cluster.getPgClient(name, "127.0.0.1");
    await connection.connect();
    database = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
    const db = database;

    // Reproduce the existing account schema without the two proposed tournament tables.
    const schema = (await readFile(path.join(root, "prisma/schema.prisma"), "utf8"))
      .replace(/^\s*tournamentRegistrations TournamentRegistration\[\]\s*$/m, "")
      .replace(/^model Tournament \{[\s\S]*?^\}/m, "")
      .replace(/^model TournamentRegistration \{[\s\S]*?^\}/m, "")
      .replace(/^enum TournamentStatus \{[\s\S]*?^\}/m, "");
    assert.ok(!schema.includes("model Tournament "));
    const schemaPath = path.join(temporary, "tournament-test-baseline.prisma");
    const sqlPath = path.join(temporary, "tournament-test-baseline.sql");
    await mkdir(temporary, { recursive: true });
    await writeFile(schemaPath, schema);
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script", "--output", sqlPath], {
      cwd: root, stdio: "pipe", windowsHide: true,
      env: { ...process.env, DATABASE_URL: url.href,
        PRISMA_SCHEMA_ENGINE_BINARY: path.join(root, "node_modules/@prisma/engines/schema-engine-windows.exe"),
        PRISMA_QUERY_ENGINE_LIBRARY: path.join(root, "node_modules/@prisma/engines/query_engine-windows.dll.node") },
    });
    await connection.query(await readFile(sqlPath, "utf8"));
    await connection.query("CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;");
    const sql = (file: string) => readFile(path.join(root, "docs/database/tournaments", file), "utf8");
    await connection.query(await sql("create-tournaments.draft.sql"));
    await connection.query(await sql("seed-split-ii.draft.sql"));
    console.log("PASS: additive migration and seed against an isolated PostgreSQL database");

    const fixtures: Array<{ account: { id: string; email: string }; profile: AccountProfile }> = [];
    for (let i = 0; i < 65; i++) {
      const user = await db.user.create({ data: { email: `fixture-${i}@test.invalid` } });
      const profile = await db.accountProfile.create({ data: {
        userId: user.id, email: user.email, displayName: `Fixture ${i}`,
        riotName: `Fixture${i}`, riotTag: `${1000 + i}`, kookUsername: `fixture-${i}`,
        primaryRole: "MID", chinaServerId: 1, openId: `fixture-open-${i}`,
        verificationStatus: "VERIFIED", accountStatus: "ACTIVE",
      } });
      fixtures.push({ account: { id: user.id, email: user.email }, profile });
    }
    await connection.query(await sql("schedule-split-ii.draft.sql"));
    const historical = fixtures.slice(0, 25);
    for (const fixture of historical) await connection.query(`INSERT INTO public.tournament_registrations
      (id, tournament_id, profile_id, display_name_snapshot, primary_role_snapshot, riot_name_snapshot, riot_tag_snapshot, terms_version, rules_version, consented_at)
      SELECT $1, id, $2, 'Historical player', 'MID', $3, '1234', terms_version, rules_version, now() FROM public.tournaments WHERE slug=$4`,
      [randomBytes(16).toString("hex"), fixture.profile.id, fixture.profile.riotName, SPLIT_II_SLUG]);
    const beforeUpgrade = (await connection.query("SELECT row_to_json(r) AS entry FROM public.tournament_registrations r ORDER BY id")).rows;
    await connection.query(await sql("add-floater-pool.sql"));
    await connection.query(await sql("activate-floater-pool.sql"));
    const afterUpgrade = (await connection.query("SELECT to_jsonb(r) - 'pool' AS entry FROM public.tournament_registrations r ORDER BY id")).rows;
    assert.deepEqual(afterUpgrade, beforeUpgrade);
    assert.equal((await getRegistrationState(db, fixtures[0].account)).count, 25);
    assert.equal((await getRegistrationState(db, fixtures[0].account)).capacity, 25);
    assert.equal((await getRegistrationState(db, fixtures[0].account)).floaters.length, 0);
    await db.tournamentRegistration.deleteMany();
    await db.tournament.updateMany({ data: {status:"DRAFT"} });
    console.log("PASS: upgrade preserves all 25 historical entries and their accepted consent exactly");
    const consent = { accepted: true as const, termsVersion: SPLIT_II_TERMS_VERSION, rulesVersion: SPLIT_II_RULES_VERSION };
    const handlers = createRegistrationHandlers(db, async request => {
      const token = request.headers.get("authorization")?.replace("Bearer fixture-", "");
      return token !== undefined && /^\d+$/.test(token) ? fixtures[Number(token)]?.account ?? null : null;
    });
    const post = (index: number | null, body: unknown = consent) => handlers.POST(new Request("http://localhost/api/tournaments/split-ii/registration", {
      method: "POST", headers: { "Content-Type": "application/json", ...(index === null ? {} : { Authorization: `Bearer fixture-${index}` }) }, body: JSON.stringify(body),
    }));
    const errorCode = async (response: Response, status: number, code: string) => {
      assert.equal(response.status, status, `${code}: ${await response.clone().text()}`);
      assert.equal((await response.json()).code, code);
    };
    const event = await db.tournament.findUniqueOrThrow({ where: { slug: SPLIT_II_SLUG } });
    const updateEvent = (data: Prisma.TournamentUpdateInput) => db.tournament.update({ where: { id: event.id }, data });
    const register = (index: number) => registerForSplitTwo(db, fixtures[index].account, consent);
    const expectServiceError = (index: number, code: string) => assert.rejects(() => register(index), error => error instanceof RegistrationError && error.code === code);

    await errorCode(await post(null), 401, "UNAUTHENTICATED");
    await errorCode(await post(0, { ...consent, accepted: false }), 400, "CONSENT_REQUIRED");
    assert.equal((await handlers.POST(new Request("http://localhost/api", { method: "POST", headers: { Authorization: "Bearer fixture-0", "Content-Type": "application/json" }, body: "{" }))).status, 400);
    await errorCode(await post(0), 409, "CLOSED");
    assert.equal(await db.tournamentRegistration.count(), 0);
    await db.tournament.updateMany({ data: {status:"REGISTRATION_OPEN"} });
    assert.equal((await getRegistrationState(db, null, new Date(new Date(SPLIT_II_OPENS_AT).getTime() - 1))).window, "scheduled");
    assert.equal((await getRegistrationState(db, null, new Date(SPLIT_II_OPENS_AT))).window, "open");
    await updateEvent({ registrationOpensAt: new Date(Date.now() + 60_000) });
    await expectServiceError(0, "CLOSED");
    await updateEvent({ registrationOpensAt: new Date(Date.now() - 60_000), registrationClosesAt: null });
    await errorCode(await post(0, { ...consent, rulesVersion: "outdated" }), 409, "RULES_CHANGED");

    await db.accountProfile.update({ where: { id: fixtures[1].profile.id }, data: { verificationStatus: "PENDING_KOOK" } });
    await db.accountProfile.update({ where: { id: fixtures[2].profile.id }, data: { accountStatus: "SUSPENDED" } });
    await db.accountProfile.update({ where: { id: fixtures[3].profile.id }, data: { primaryRole: "" } });
    for (const i of [1, 2, 3]) await errorCode(await post(i), 403, "INELIGIBLE");
    console.log("PASS: authentication, consent, invalid input, eligibility, opening time and stale rules");

    const first = await post(0, { ...consent, profileId: fixtures[1].profile.id, primaryRole: "TOP", displayName: "Spoofed" });
    assert.equal(first.status, 201);
    const saved = await db.tournamentRegistration.findFirstOrThrow();
    assert.equal(saved.profileId, fixtures[0].profile.id);
    assert.equal(saved.primaryRoleSnapshot, "MID");
    assert.equal(saved.displayNameSnapshot, "Fixture 0");
    assert.equal(saved.termsVersion, consent.termsVersion);
    assert.equal(saved.rulesVersion, consent.rulesVersion);
    assert.ok(saved.consentedAt <= saved.registeredAt);
    await db.accountProfile.update({ where: { id: fixtures[0].profile.id }, data: { primaryRole: "SUPP", displayName: "Changed after signup" } });
    const afterEdit = await getRegistrationState(db, fixtures[0].account);
    assert.equal(afterEdit.players[0].name, "Fixture 0");
    assert.equal(afterEdit.players[0].role, "Middle");
    assert.equal(afterEdit.registration?.role, "Middle");
    await assert.rejects(() => db.tournamentRegistration.update({ where: { id: saved.id }, data: { primaryRoleSnapshot: "TOP" } }));
    await assert.rejects(() => db.accountProfile.delete({ where: { id: fixtures[0].profile.id } }));
    const anonymous = await (await handlers.GET(new Request("http://localhost/api"))).json();
    assert.deepEqual(Object.keys(anonymous.players[0]).sort(), ["id", "name", "role"]);
    assert.equal(anonymous.registration, null);
    assert.equal(anonymous.viewer.account, "signed-out");
    assert.ok(!JSON.stringify(anonymous).includes("fixture-open"));
    assert.ok(!JSON.stringify(anonymous).includes("@test.invalid"));

    await db.accountProfile.update({ where: { id: fixtures[4].profile.id }, data: { openId: fixtures[0].profile.openId } });
    await expectServiceError(4, "IDENTITY_REGISTERED");
    await db.accountProfile.update({ where: { id: fixtures[5].profile.id }, data: { openId: null, riotName: "fixture0", riotTag: fixtures[0].profile.riotTag } });
    await expectServiceError(5, "IDENTITY_REGISTERED");
    await updateEvent({ status: "REGISTRATION_CLOSED" });
    assert.equal((await post(0, { ...consent, rulesVersion: "outdated" })).status, 200);
    await expectServiceError(6, "CLOSED");
    await updateEvent({ status: "REGISTRATION_OPEN", registrationClosesAt: new Date(Date.now() - 1000) });
    await expectServiceError(6, "CLOSED");
    await updateEvent({ registrationClosesAt: null });
    console.log("PASS: server-derived identity/role, saved consent, immutable snapshots, privacy and idempotent closed-event retries");

    for (const role of ["anon", "authenticated"]) {
      await connection.query(`SET ROLE ${role}`);
      try {
        for (const table of ["tournaments", "tournament_registrations"]) {
          for (const query of [`SELECT * FROM public.${table}`, `INSERT INTO public.${table} DEFAULT VALUES`, `UPDATE public.${table} SET id = id`, `DELETE FROM public.${table}`]) {
            await assert.rejects(() => connection!.query(query), (error: unknown) => (error as { code: string }).code === "42501");
          }
        }
      }
      finally { await connection.query("RESET ROLE"); }
    }
    assert.equal((await connection.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tournament_registrations'::regclass")).rows[0].relrowsecurity, true);
    console.log("PASS: RLS enabled and browser roles denied direct registration access");

    await db.tournamentRegistration.deleteMany();
    for (let i = 30; i < 54; i++) assert.equal((await post(i)).status, 201);
    assert.equal(await db.tournamentRegistration.count(), 24);
    const contenders = await Promise.all([post(54), post(55)]);
    assert.deepEqual(contenders.map(response => response.status).sort(), [201, 409]);
    const winner = contenders[0].status === 201 ? 54 : 55;
    assert.equal(await db.tournamentRegistration.count(), 25);
    const retries = await Promise.all(Array.from({ length: 8 }, () => post(winner)));
    assert.ok(retries.every(response => response.status === 200));
    await errorCode(await post(56), 409, "FULL");
    assert.equal(await db.tournamentRegistration.count(), 25);
    await assert.rejects(() => db.tournamentRegistration.create({ data: { ...saved, id: randomBytes(16).toString("hex"), profileId: fixtures[57].profile.id, gameIdentityKey: "direct-fixture" } }));
    await assert.rejects(() => updateEvent({ capacity: 24 }));
    const lastEntry = await db.tournamentRegistration.findFirstOrThrow({ orderBy: [{ registeredAt: "desc" }, { id: "desc" }] });
    await db.tournamentRegistration.delete({ where: { id: lastEntry.id } });
    const directRace = await Promise.allSettled([57, 58].map(index => db.tournamentRegistration.create({ data: {
      ...saved, id: randomBytes(16).toString("hex"), profileId: fixtures[index].profile.id, gameIdentityKey: `direct-${index}`,
    } })));
    assert.equal(directRace.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await db.tournamentRegistration.count(), 25);
    await assert.rejects(() => db.$transaction(async tx => {
      await tx.tournamentRegistration.create({ data: { ...saved, id: randomBytes(16).toString("hex"), profileId: fixtures[58].profile.id, gameIdentityKey: "serializable-fixture" } });
    }, { isolationLevel: "Serializable" }));
    console.log("PASS: slot 25 race, slot 26 rejection, simultaneous retries, direct-SQL capacity guard and isolation guard");

    const floaterConsent = {...consent, pool:"FLOATER" as const, rulesVersion:SPLIT_II_FLOATER_RULES_VERSION};
    const mainSnapshot = await db.tournamentRegistration.findMany({where:{pool:"MAIN"},orderBy:{id:"asc"}});
    const joinedFloater = await post(6, floaterConsent);
    assert.equal(joinedFloater.status,201);
    const floaterState = await joinedFloater.json();
    assert.equal(floaterState.count,25);
    assert.equal(floaterState.floaters.length,1);
    assert.equal(floaterState.registration,null);
    assert.equal(floaterState.floaterRegistration.role,"Middle");
    assert.deepEqual(Object.keys(floaterState.floaters[0]).sort(),["id","name","role"]);
    assert.equal((await post(6,floaterConsent)).status,200);
    await errorCode(await post(6),409,"ALREADY_REGISTERED");
    await errorCode(await post(30,floaterConsent),409,"ALREADY_REGISTERED");
    await errorCode(await post(1,floaterConsent),403,"INELIGIBLE");
    await errorCode(await post(7,{...floaterConsent,rulesVersion:consent.rulesVersion}),409,"RULES_CHANGED");
    await errorCode(await post(7,{...floaterConsent,pool:"INVALID"}),400,"INVALID_POOL");
    await db.accountProfile.update({where:{id:fixtures[7].profile.id},data:{openId:fixtures[6].profile.openId}});
    await errorCode(await post(7,floaterConsent),409,"IDENTITY_REGISTERED");
    await updateEvent({status:"REGISTRATION_CLOSED"});
    assert.equal((await post(8,floaterConsent)).status,201);
    await updateEvent({floatersOpen:false});
    await errorCode(await post(9,floaterConsent),409,"CLOSED");
    assert.equal((await post(8,floaterConsent)).status,200);
    await updateEvent({floatersOpen:true,status:"REGISTRATION_OPEN"});
    const concurrentPools=await Promise.all([post(10),post(10,floaterConsent)]);
    assert.ok(concurrentPools.some(r=>r.status===201));
    assert.equal(await db.tournamentRegistration.count({where:{profileId:fixtures[10].profile.id}}),1);
    assert.deepEqual(await db.tournamentRegistration.findMany({where:{pool:"MAIN"},orderBy:{id:"asc"}}),mainSnapshot);
    assert.equal((await getRegistrationState(db,null)).count,25);
    await assert.rejects(()=>updateEvent({capacity:24}));
    await updateEvent({capacity:25}); // Floaters do not consume main capacity.
    await db.tournamentRegistration.deleteMany({where:{pool:"FLOATER"}});
    console.log("PASS: separate floaters, consent, eligibility, full main pool, cross-pool uniqueness and independent close");

    const rollback = await sql("rollback-tournaments.draft.sql");
    await assert.rejects(() => connection!.query(rollback));
    await connection.query("ROLLBACK");
    assert.equal(await db.tournamentRegistration.count(), 25);
    await db.tournamentRegistration.deleteMany();
    await assert.rejects(() => db.$transaction(async tx => {
      await tx.tournamentRegistration.create({ data: { ...saved, id: randomBytes(16).toString("hex") } });
      throw new Error("Deliberate test rollback");
    }));
    assert.equal(await db.tournamentRegistration.count(), 0);
    await connection.query(rollback);
    assert.equal((await connection.query("SELECT to_regclass('public.tournaments') AS table_name")).rows[0].table_name, null);
    console.log("PASS: failed transaction leaves no entry; rollback refuses saved registrations and removes only unused foundation");
    console.log("All isolated PostgreSQL registration checks passed. No live database was used.");
  } finally {
    console.warn = originalWarn;
    if (database) await database.$disconnect();
    if (connection) await connection.end();
    await cluster.stop();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Tournament checks failed"); process.exitCode = 1; });
