# Auth, Room Password, and PostgreSQL Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PostgreSQL the production source of truth, enforce server-side RBAC for live-room management, and protect password rooms with encrypted recoverable passwords plus signed room-access cookies.

**Architecture:** Introduce an asynchronous data-access layer with Prisma and a JSON development adapter, then move route handlers and server pages off the global mutable store. Keep NextAuth for staff sessions, enforce roles at every mutation, and issue room-scoped HMAC-signed HttpOnly cookies after password verification. Public DTOs never expose password material; authorized management DTOs decrypt it on demand.

**Tech Stack:** Next.js 16.2.9 App Router, Auth.js/NextAuth 5 beta, TypeScript, Zod, Prisma 6/PostgreSQL 16, Node crypto, Vitest, React Testing Library.

---

## File map

- `src/lib/database.ts`: singleton Prisma client and production database availability errors.
- `src/lib/repositories/app-repository.ts`: async repository contract used by services and pages.
- `src/lib/repositories/json-app-repository.ts`: development/test adapter around the existing JSON store.
- `src/lib/repositories/prisma-app-repository.ts`: incremental Prisma reads and transactional mutations.
- `src/lib/repositories/index.ts`: explicit `DATABASE_STORAGE=postgres|json` repository selection; production defaults to PostgreSQL and never silently falls back.
- `src/lib/room-password.ts`: AES-256-GCM encryption/decryption and password-version updates.
- `src/lib/room-access.ts`: signed room-access token creation and verification.
- `src/lib/room-access-request.ts`: Next.js request/Cookie adapter for requiring room access.
- `src/lib/live-dto.ts`: public and management live-session DTOs.
- `src/lib/auth-helpers.ts`: staff session and role verification using the async repository.
- `src/lib/*-service.ts`: async business services backed by the repository.
- `src/app/api/live-sessions/**/route.ts`: route-level authorization and room-access enforcement.
- `src/app/admin/page.tsx`, `src/app/host/page.tsx`, `src/app/live/[id]/page.tsx`: async repository reads close to the page boundary.
- `prisma/schema.prisma` and a new migration: password encryption fields plus all schema drift since the initial migration.
- `scripts/import-json-to-postgres.ts`: guarded one-time import.
- `.env.example`, `docker-compose.yml`, `package.json`: explicit storage and encryption configuration.

### Task 1: Establish a clean test/runtime baseline

**Files:**
- Modify: `package.json`
- Modify: `AGENTS.md`

- [ ] **Step 1: Read the installed Next.js guides before code changes**

Read completely:

```text
node_modules/next/dist/docs/01-app/02-guides/authentication.md
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
```

- [ ] **Step 2: Record supported Node and add focused test scripts**

Add to `package.json`:

```json
"engines": { "node": ">=22 <24" },
"scripts": {
  "test:auth": "vitest run src/lib/auth-helpers.test.ts src/app/api/live-sessions/route.test.ts",
  "test:room-access": "vitest run src/lib/room-password.test.ts src/lib/room-access.test.ts src/app/api/live-sessions/[id]/room-access/route.test.ts",
  "test:repository": "vitest run src/lib/repositories"
}
```

- [ ] **Step 3: Run the existing baseline with Node 22**

Run:

```bash
npm run test
npm run lint
npm run build
npm run prisma:validate
```

Expected: capture the exact pre-change result in `AGENTS.md`; do not treat Node 24 module-resolution failures as application test failures.

- [ ] **Step 4: Commit the baseline metadata**

```bash
git add LiveKit/package.json LiveKit/AGENTS.md
git commit -m "chore: define live app verification baseline"
```

### Task 2: Add the real Prisma migration and generated client

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260723000000_auth_room_password_closure/migration.sql`
- Modify: `src/lib/domain.ts`

- [ ] **Step 1: Write a schema contract test that fails on missing encrypted-password fields**

Create `src/lib/prisma-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("schema stores encrypted room passwords and a revocation version", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  expect(schema).toContain("accessPasswordCiphertext String?");
  expect(schema).toContain("accessPasswordVersion Int");
  expect(schema).not.toMatch(/\n\s*accessPassword\s+String\?/);
});
```

- [ ] **Step 2: Run the schema test and verify RED**

Run: `npm run test -- src/lib/prisma-schema.test.ts`

Expected: FAIL because the schema still contains plaintext `accessPassword` and lacks the new fields.

- [ ] **Step 3: Update schema and domain types**

Replace the Prisma field with:

```prisma
accessPasswordCiphertext String?
accessPasswordVersion    Int     @default(0)
```

Use separate internal and public types in `src/lib/domain.ts`:

```ts
export type StoredLiveSession = Omit<LiveSession, "accessPassword"> & {
  accessPasswordCiphertext?: string;
  accessPasswordVersion: number;
};
```

- [ ] **Step 4: Create a migration that covers all drift from the initial migration**

The SQL must add `User.passwordHash`, `LiveSession.cdnPlayUrl`, `LiveSession.accessPasswordCiphertext`, and `LiveSession.accessPasswordVersion`. It must migrate any existing plaintext `accessPassword` only through the application import step; do not encode plaintext into SQL logs.

- [ ] **Step 5: Generate and validate Prisma**

Run:

```bash
npx prisma generate
npm run prisma:validate
npm run test -- src/lib/prisma-schema.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add LiveKit/prisma LiveKit/src/lib/domain.ts LiveKit/src/lib/prisma-schema.test.ts
git commit -m "feat: add encrypted room password schema"
```

### Task 3: Implement recoverable room-password encryption

**Files:**
- Create: `src/lib/room-password.ts`
- Create: `src/lib/room-password.test.ts`

- [ ] **Step 1: Write failing crypto behavior tests**

```ts
import { describe, expect, it } from "vitest";
import { decryptRoomPassword, encryptRoomPassword } from "./room-password";

const key = Buffer.alloc(32, 7).toString("base64");

describe("room password encryption", () => {
  it("round-trips without placing plaintext in the stored value", () => {
    const encrypted = encryptRoomPassword("sale-2026", key);
    expect(encrypted).not.toContain("sale-2026");
    expect(decryptRoomPassword(encrypted, key)).toBe("sale-2026");
  });

  it("rejects an invalid key", () => {
    expect(() => encryptRoomPassword("secret", "short")).toThrow("ROOM_PASSWORD_KEY_INVALID");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptRoomPassword("secret", key);
    expect(() => decryptRoomPassword(`${encrypted}x`, key)).toThrow("ROOM_PASSWORD_DECRYPT_FAILED");
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- src/lib/room-password.test.ts`

Expected: FAIL because `room-password.ts` does not exist.

- [ ] **Step 3: Implement versioned AES-256-GCM storage**

Implement `v1.<iv>.<tag>.<ciphertext>` using `randomBytes(12)`, `createCipheriv("aes-256-gcm", ...)`, and constant error codes. Export only `encryptRoomPassword`, `decryptRoomPassword`, and `hasRoomPassword`.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test -- src/lib/room-password.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add LiveKit/src/lib/room-password.ts LiveKit/src/lib/room-password.test.ts
git commit -m "feat: encrypt recoverable room passwords"
```

### Task 4: Replace the global production store with an async repository

**Files:**
- Create: `src/lib/database.ts`
- Create: `src/lib/repositories/app-repository.ts`
- Create: `src/lib/repositories/json-app-repository.ts`
- Create: `src/lib/repositories/prisma-app-repository.ts`
- Create: `src/lib/repositories/index.ts`
- Create: `src/lib/repositories/repository-selection.test.ts`
- Create: `src/lib/repositories/prisma-app-repository.test.ts`
- Delete: `src/lib/store-repository-prisma.ts`
- Modify: `src/lib/store-repository.ts`

- [ ] **Step 1: Write failing repository-selection tests**

```ts
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

it("selects PostgreSQL by default in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_STORAGE", "");
  vi.resetModules();
  const { repositoryKind } = await import("./index");
  expect(repositoryKind()).toBe("postgres");
});

it("allows JSON only when explicitly selected outside production", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_STORAGE", "json");
  vi.resetModules();
  const { repositoryKind } = await import("./index");
  expect(repositoryKind()).toBe("json");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- src/lib/repositories/repository-selection.test.ts`

Expected: FAIL because the new repository selector does not exist.

- [ ] **Step 3: Define focused async repository operations**

The contract must expose domain operations rather than full-store replacement:

```ts
export interface AppRepository {
  findUserById(id: string): Promise<User | null>;
  listLiveSessions(): Promise<StoredLiveSession[]>;
  findLiveSession(id: string): Promise<StoredLiveSession | null>;
  createLiveSession(input: CreateLiveRecord): Promise<StoredLiveSession>;
  updateLiveSession(id: string, patch: UpdateLiveRecord): Promise<StoredLiveSession>;
  deleteLiveSession(id: string, actorId: string): Promise<void>;
  joinLive(input: JoinLiveInput): Promise<LiveParticipant>;
  createLiveKitGrant(input: TokenGrantInput): Promise<TokenGrantRecord>;
  createComment(input: CreateCommentInput): Promise<LiveComment>;
  recordAudienceEvent(input: AudienceEventInput): Promise<LiveComment>;
  heartbeat(input: HeartbeatInput): Promise<LiveParticipant>;
  applyForMic(input: ApplyMicInput): Promise<MicRequest>;
  endMic(input: EndMicInput): Promise<MicRequest>;
}
```

The contract must also define explicit methods for listing comments, approving/rejecting/deleting/pinning/marking comments, listing participants, muting/unmuting/kicking participants, listing/approving/rejecting mic requests, reading/updating statistics, reading comment analytics, reading/updating leads, reading share ranking, reading replay data, starting a live, ending a live, and writing audit logs. Never expose `saveWholeStore()` in the Prisma adapter.

- [ ] **Step 4: Implement explicit repository selection**

`DATABASE_STORAGE=postgres|json`; production rejects `json` with `JSON_STORAGE_FORBIDDEN_IN_PRODUCTION`. Database connection failures become `DATABASE_UNAVAILABLE`; there is no automatic fallback.

- [ ] **Step 5: Write failing incremental-write tests**

Use a transaction-shaped fake Prisma client and assert that `createLiveSession` calls `liveSession.create` and `liveStats.create`, and never calls `deleteMany` on unrelated tables.

- [ ] **Step 6: Implement Prisma incremental operations and transactions**

Remove the full-table delete/recreate transaction and `@ts-nocheck`. Map Prisma records through typed mapper functions. Use `$transaction` for live+stats creation, live deletion cascades, moderation+audit, and participant/stat changes.

- [ ] **Step 7: Run repository tests**

Run: `npm run test:repository`

Expected: PASS with no `deleteMany` call in create/update tests.

- [ ] **Step 8: Commit**

```bash
git add LiveKit/src/lib/database.ts LiveKit/src/lib/repositories LiveKit/src/lib/store-repository.ts LiveKit/src/lib/store-repository-prisma.ts
git commit -m "refactor: make postgres the production repository"
```

### Task 5: Migrate authentication and management routes to the DAL

**Files:**
- Modify: `src/auth.ts`
- Modify: `src/lib/auth-helpers.ts`
- Create: `src/lib/auth-helpers.test.ts`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/host/page.tsx`
- Modify: `src/app/api/live-sessions/route.ts`
- Modify: `src/app/api/live-sessions/[id]/route.ts`
- Modify: all management mutation route handlers under `src/app/api/live-sessions/[id]`
- Rename: `src/middleware.ts` to `src/proxy.ts`

- [ ] **Step 1: Write failing role-authorization tests**

For `POST /api/live-sessions`, mock only the session boundary and repository. Assert `AUTH_REQUIRED`/401 for no session, `AUTH_INSUFFICIENT_ROLE`/403 for host and audience, and 201 for `super_admin`, `director`, and `moderator`.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:auth`

Expected: FAIL because POST and PATCH currently omit `requireAuth()`.

- [ ] **Step 3: Make auth helpers async-repository based**

`requireAuth(roles)` must call `auth()`, load the current user through `getRepository().findUserById`, verify active status, and return the database role. Never trust the role copied into an old JWT when it differs from the database.

- [ ] **Step 4: Secure create and update**

At the beginning of POST/PATCH/DELETE:

```ts
const actor = await requireAuth(["super_admin", "director", "moderator"]);
```

Pass `actor.userId` to the service for audit logging. Return 401 for `AUTH_REQUIRED`, 403 for `AUTH_INSUFFICIENT_ROLE`, and never include password material in generic responses.

- [ ] **Step 5: Audit every management mutation route**

Apply explicit roles to start/end, moderation, participant controls, lead updates, mic approval/rejection, replay changes, and room CRUD. Keep audience self-service routes separate.

- [ ] **Step 6: Follow Next.js 16 file convention**

Rename `middleware.ts` to `proxy.ts`, export `proxy`, retain optimistic redirects only, and keep authoritative checks in pages/routes/DAL.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npm run test:auth
npm run test -- src/app/api/live-sessions
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add LiveKit/src/auth.ts LiveKit/src/lib/auth-helpers.ts LiveKit/src/lib/auth-helpers.test.ts LiveKit/src/app LiveKit/src/proxy.ts LiveKit/src/middleware.ts
git commit -m "fix: enforce staff roles at every management boundary"
```

### Task 6: Add public and management DTOs for live sessions

**Files:**
- Create: `src/lib/live-dto.ts`
- Create: `src/lib/live-dto.test.ts`
- Create: `src/app/api/live-sessions/[id]/manage/route.ts`
- Modify: `src/components/admin-console.tsx`

- [ ] **Step 1: Write failing DTO tests**

```ts
it("public DTO omits password material", () => {
  expect(toPublicLiveDto(stored)).not.toHaveProperty("accessPasswordCiphertext");
  expect(toPublicLiveDto(stored)).toEqual(expect.objectContaining({ hasAccessPassword: true }));
});

it("management DTO decrypts for an authorized caller", () => {
  expect(toManagementLiveDto(stored, key).accessPassword).toBe("sale-2026");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- src/lib/live-dto.test.ts`

Expected: FAIL because DTO helpers do not exist.

- [ ] **Step 3: Implement separate DTOs and management endpoint**

The public DTO returns `hasAccessPassword` only. `GET /manage` requires `super_admin|director|moderator` and returns the decrypted value. Update the admin editor to load this endpoint only when edit mode opens.

- [ ] **Step 4: Preserve/set/clear semantics**

PATCH accepts exactly one of:

```ts
{ accessPasswordAction: "keep" }
{ accessPasswordAction: "set", accessPassword: "new value" }
{ accessPasswordAction: "clear" }
```

Setting or clearing increments `accessPasswordVersion`. Editing unrelated fields defaults to `keep`.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test -- src/lib/live-dto.test.ts src/components/admin-console.test.tsx
git add LiveKit/src/lib/live-dto* LiveKit/src/app/api/live-sessions LiveKit/src/components/admin-console*
git commit -m "feat: separate public and management live data"
```

### Task 7: Issue and verify signed room-access cookies

**Files:**
- Create: `src/lib/room-access.ts`
- Create: `src/lib/room-access.test.ts`
- Create: `src/lib/room-access-request.ts`
- Create: `src/app/api/live-sessions/[id]/room-access/route.ts`
- Create: `src/app/api/live-sessions/[id]/room-access/route.test.ts`
- Modify: `src/components/audience-room.tsx`
- Modify: `src/components/audience-room.test.tsx`

- [ ] **Step 1: Write failing token tests**

Test valid, expired, tampered, cross-room, cross-viewer, and old-password-version tokens. Use an injected clock so expiry tests are deterministic.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- src/lib/room-access.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement HMAC-SHA-256 room tokens**

Use a compact versioned payload containing `liveId`, `viewerId`, `passwordVersion`, `iat`, and `exp`. Verify signatures with `timingSafeEqual`. Derive a room-access signing key from `AUTH_SECRET` using HKDF with a fixed context rather than reusing raw secret bytes directly.

- [ ] **Step 4: Write failing Route Handler tests**

Wrong password returns 403 with no `Set-Cookie`; correct password returns 200 and a Cookie named from a stable hash of the live ID with `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, and a bounded max age.

- [ ] **Step 5: Implement the verification endpoint using async cookies**

Use Next.js 16 `await cookies()` in the Route Handler. Decrypt the stored room password, compare with `timingSafeEqual` over digests, sign the token, and set the Cookie.

- [ ] **Step 6: Update the audience prompt**

Call `/room-access` rather than using `/join` as password verification. Keep WeChat authorization as a distinct following step. Do not create a fake `pwd-${Date.now()}` participant.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm run test:room-access
npm run test -- src/components/audience-room.test.tsx
git add LiveKit/src/lib/room-access* LiveKit/src/app/api/live-sessions LiveKit/src/components/audience-room*
git commit -m "feat: issue signed password-room access cookies"
```

### Task 8: Enforce room access on every protected audience capability

**Files:**
- Modify: `src/app/api/live-sessions/[id]/token/route.ts`
- Modify: `src/app/api/live-sessions/[id]/join/route.ts`
- Modify: `src/app/api/live-sessions/[id]/heartbeat/route.ts`
- Modify: `src/app/api/live-sessions/[id]/comments/route.ts`
- Modify: `src/app/api/live-sessions/[id]/audience-events/route.ts`
- Modify: `src/app/api/live-sessions/[id]/mic-requests/route.ts`
- Modify: `src/app/api/live-sessions/[id]/mic-requests/[requestId]/end/route.ts`
- Create: `src/app/api/live-sessions/[id]/room-access-enforcement.test.ts`

- [ ] **Step 1: Write a failing table-driven enforcement test**

For each route, exercise a password room with no Cookie and expect `ROOM_ACCESS_REQUIRED`; use a valid Cookie and expect the route to reach its service dependency. Add controls proving no-password rooms remain accessible.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- src/app/api/live-sessions/[id]/room-access-enforcement.test.ts`

Expected: FAIL first at the Token route, which currently issues a token without password access.

- [ ] **Step 3: Add one request guard**

At each audience route boundary call:

```ts
await requireRoomAccess(request, { liveId: id, viewerId: input.userId, live });
```

The helper returns immediately for rooms without a password. It rejects missing, invalid, expired, wrong-room, wrong-viewer, and stale-version cookies with stable status codes.

- [ ] **Step 4: Remove client-controlled privileged roles**

Audience Token and join schemas must not accept arbitrary staff roles. Staff Token issuance derives role from authenticated staff Session; anonymous viewer flows are always `audience`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test -- src/app/api/live-sessions/[id]/room-access-enforcement.test.ts
git add LiveKit/src/app/api/live-sessions LiveKit/src/lib/room-access-request.ts
git commit -m "fix: enforce password access on audience APIs"
```

### Task 9: Add guarded JSON-to-PostgreSQL import

**Files:**
- Create: `scripts/import-json-to-postgres.ts`
- Create: `src/lib/repositories/import-json.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing import tests**

Test that an empty target imports all collections in one transaction, a non-empty target throws `IMPORT_TARGET_NOT_EMPTY`, and logs contain counts but no password or encryption key.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test -- src/lib/repositories/import-json.test.ts`

Expected: FAIL because the importer does not exist.

- [ ] **Step 3: Implement the importer**

Read `.data/app-store.json`, normalize legacy data, encrypt plaintext room passwords before insert, validate all target core table counts are zero, and import in dependency order inside `$transaction`. Never delete target rows.

- [ ] **Step 4: Add command and dry-run output**

Install `tsx` as a development dependency and add:

```json
"devDependencies": { "tsx": "^4.20.6" },
"data:import-json": "tsx scripts/import-json-to-postgres.ts"
```

The command prints only entity counts and final success/failure.

- [ ] **Step 5: Verify and commit**

```bash
npm run test -- src/lib/repositories/import-json.test.ts
git add LiveKit/scripts/import-json-to-postgres.ts LiveKit/src/lib/repositories/import-json.test.ts LiveKit/package.json LiveKit/package-lock.json
git commit -m "feat: add guarded json to postgres import"
```

### Task 10: Wire production configuration and Docker startup

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `Dockerfile`
- Modify: `README.md`

- [ ] **Step 1: Add explicit non-secret configuration**

Document and pass:

```dotenv
DATABASE_STORAGE=postgres
ROOM_PASSWORD_ENCRYPTION_KEY=replace-with-32-byte-base64-key
```

Do not provide a working default encryption key. Keep `AUTH_SECRET` and database credentials as required production values.

- [ ] **Step 2: Make migration order deterministic**

The app entrypoint must run `prisma migrate deploy` before starting Next.js, fail on migration error, and never generate schema state dynamically in production.

- [ ] **Step 3: Validate Compose configuration**

Run: `docker compose config`

Expected: exit 0; inspect rendered keys without printing secret values.

- [ ] **Step 4: Commit**

```bash
git add LiveKit/.env.example LiveKit/docker-compose.yml LiveKit/Dockerfile LiveKit/README.md
git commit -m "chore: configure postgres-only production runtime"
```

### Task 11: Full verification and local PostgreSQL smoke test

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Run all static and unit quality gates**

```bash
npm run test
npm run lint
npm run build
npm run prisma:validate
git diff --check
```

Expected: every command exits 0 with no failed tests or TypeScript errors.

- [ ] **Step 2: Test migrations on an empty database**

Start an isolated PostgreSQL database, run `npm run prisma:deploy`, and query `_prisma_migrations` plus the new encrypted-password columns.

- [ ] **Step 3: Test upgrade from the initial migration**

Apply only `20260615000000_init`, insert representative old records, then run all migrations and verify records remain and new fields have safe defaults.

- [ ] **Step 4: Test JSON import and persistence across restart**

Import a backed-up JSON fixture into an empty database, verify counts, restart the app container, and confirm the same live room, users, comments, mic requests, and statistics remain.

- [ ] **Step 5: Smoke the full product flow**

Verify:

1. Anonymous `/admin` redirects to sign-in.
2. Moderator logs in and creates a password room.
3. Public live response exposes `hasAccessPassword` but no password material.
4. Wrong password is rejected.
5. Correct password sets the room Cookie.
6. Token, join, comment, like, heartbeat, mic apply, and mic end work with the Cookie.
7. The same calls fail without it.
8. Editing the title preserves the password; setting and clearing increment the password version.
9. PostgreSQL restart preserves the result.

- [ ] **Step 6: Update handoff evidence**

Append exact test counts, migration names, import counts, smoke URLs, container health, and presence-only environment checks to `AGENTS.md`. Never record secret values.

- [ ] **Step 7: Commit verification records**

```bash
git add LiveKit/AGENTS.md
git commit -m "docs: record auth and postgres closure verification"
```

### Task 12: Package and production deployment checkpoint

**Files:**
- Regenerate: `deploy-package.tar.gz`

- [ ] **Step 1: Back up production data**

Back up PostgreSQL and `/opt/wechat-live/current/.data/app-store.json` before migration. Confirm backup paths and sizes.

- [ ] **Step 2: Build a whitelist deployment package**

Include Docker files, Prisma schema and migrations, generated standalone output, static assets, and required source/config files. Inspect archive paths before upload.

- [ ] **Step 3: Stop for deployment authorization if remote access is not already authorized**

Uploading, migrating production data, rebuilding containers, or changing production environment variables requires explicit in-scope authorization and working SSH access.

- [ ] **Step 4: Deploy migration, import, and application in order**

Run database backup, migration, guarded import, count reconciliation, app deployment, and container health verification. Abort before app cutover on any count mismatch.

- [ ] **Step 5: Perform public production smoke checks**

Verify `/admin`, `/host`, a password live room, WeChat OAuth, LiveKit playback, comments, likes, mic flow, and PostgreSQL persistence without exposing secrets in logs.
