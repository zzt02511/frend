# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Architecture

```
src/
├── lib/
│   ├── domain.ts            # All type definitions + AppStore shape
│   ├── store.ts             # Global store accessor (in-memory singleton)
│   ├── store-persistence.ts # JSON file read/write to .data/app-store.json
│   ├── store-repository.ts  # Repository pattern boundary (JsonStoreRepository)
│   ├── live-service.ts      # Session lifecycle, join, token creation
│   ├── comment-service.ts   # Send, moderate, analytics
│   ├── mic-service.ts       # Mic apply, approve, reject, end
│   ├── lead-service.ts      # Customer lead aggregation + follow-up CRUD
│   ├── share-service.ts     # Share visit recording + ranking
│   ├── livekit-adapter.ts   # LiveKit JWT creation, role→grants mapping
│   ├── audience-viewer.ts   # Browser viewer ID management (localStorage)
│   ├── http.ts              # jsonOk / jsonError / readJson helpers
│   ├── share-url.ts         # URL builder with UTM-style params
│   ├── db.ts                # Prisma client singleton (prepared, not active)
│   └── utils.ts             # cn() for Tailwind class merging
├── components/
│   ├── admin-console.tsx    # PC control room (all tabs)
│   ├── mobile-host-console.tsx # Mobile host broadcasting UI
│   ├── audience-room.tsx    # Viewer H5 room
│   ├── livekit-audience-player.tsx # LiveKit video player for audience
│   └── live-share-panel.tsx # QR code + share URL panel
└── app/
    ├── admin/page.tsx       # Server component → AdminConsole
    ├── host/page.tsx        # Server component → MobileHostConsole
    ├── live/[id]/page.tsx   # Server component → AudienceRoom + share tracking
    └── api/live-sessions/   # REST API routes (see below)
```

## Data flow

1. **Server components** (pages) call service functions directly, reading from `getStore()`.
2. **Client components** fetch API routes, which call the same service functions.
3. **Persistence** goes through `JsonStoreRepository` → `.data/app-store.json`. The repository boundary (`StoreRepository` interface, `setStoreRepository()`) exists so a Prisma-backed implementation can replace it later.
4. **LiveKit** tokens are signed by the server when a client calls `POST /api/live-sessions/[id]/token`. The token includes role-based grants (audience=subscribe-only, host=can publish).

## API routes

All routes under `/api/live-sessions/[id]/`:

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/` | List / create sessions |
| GET/PATCH | `/[id]` | Get / update a single session |
| POST | `/[id]/token` | Sign LiveKit JWT |
| GET/POST | `/[id]/comments` | List / send comments |
| POST/DELETE | `/[id]/comments/[id]/{approve,reject,pin,mark-question}` | Moderate |
| GET/POST | `/[id]/mic-requests` | List / apply mic |
| POST | `/[id]/mic-requests/[id]/{approve,reject,end}` | Process mic |
| GET/POST | `/[id]/participants` | List / join participants |
| POST | `/[id]/participants/[id]/{kick,mute,unmute}` | Moderate participants |
| POST | `/[id]/{start,end}` | Session lifecycle |
| GET | `/[id]/stats` | Live stats |
| GET | `/[id]/share-ranking` | Attribution leaderboard |
| GET | `/[id]/comment-analytics` | Comment statistics |
| GET | `/[id]/leads` | Customer lead board |
| PATCH | `/[id]/leads/[customerId]` | Update follow-up info |

## Commands

```bash
npm run dev           # Start dev server (port 3000)
npm run build         # Production build
npm run test          # Run Vitest once
npm run test:watch    # Run Vitest in watch mode
npm run lint          # ESLint

# Docker
docker compose up -d --build   # Start full stack (app + LiveKit + Postgres)
```

## Key patterns

### Singleton store with persistence

```typescript
import { getStore, persistStore } from "@/lib/store";
const store = getStore();          // Returns the in-memory singleton
// ... mutate store ...
persistStore(store);               // Write to .data/app-store.json
```

Service functions that mutate the store call `persistStoreIfGlobal(store)` internally — it only persists if the store reference matches the global singleton.

### Mutating through repository

```typescript
import { getStoreRepository } from "@/lib/store-repository";
const result = getStoreRepository().mutate((store) => {
  // mutate store in place
  return result;
});
```

### API error handling

All API routes use `jsonOk(data)` / `jsonError(error)` from `@/lib/http`. Service functions throw `Error("CODE")` — the API layer catches and returns `{ ok: false, error: "CODE" }`.

### Viewer identity

Audience viewer IDs are generated in the browser via `getOrCreateAudienceViewerId()` and persisted in `localStorage`. The server accepts whatever `viewerId` is sent — there's no server-side auth in MVP.

### LiveKit identity convention

`${roomName}-${userId}` — this is how the host track is identified in audience players: `hostIdentity = roomName + "-" + hostUserId`.

## Testing

- Framework: Vitest
- Environment: Node (`vitest.config.ts` sets `environment: "node"`)
- Test files: `src/**/*.test.ts` and `src/**/*.test.tsx`
- Single worker (`maxWorkers: 1`) because tests mutate a shared JSON store
- Service tests use `createDemoStore()` to get a fresh in-memory store per test
