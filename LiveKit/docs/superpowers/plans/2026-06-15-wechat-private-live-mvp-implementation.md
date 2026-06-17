# WeChat Private Live MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable single-app MVP for WeChat private-domain live streaming with mobile host, H5 audience room, PC moderation console, comment review, mic request control, and replay/statistics records.

**Architecture:** Create a Next.js App Router application in the workspace root. Keep UI pages, API handlers, domain services, Auth.js integration, Prisma persistence, and a mock-ready LiveKit adapter in one TypeScript app. Use mature libraries for UI, validation, auth, database access, and LiveKit connectivity; custom code should focus on the private-domain live business workflow.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui on Radix primitives, lucide-react, Prisma, Auth.js/NextAuth, Zod, Vitest, Testing Library, LiveKit official SDKs.

---

## File Structure

- Create `package.json`: scripts and dependencies.
- Create `tsconfig.json`: TypeScript configuration.
- Create `next.config.mjs`: Next.js configuration.
- Create `vitest.config.ts`: Vitest configuration.
- Create `src/app/layout.tsx`: app shell metadata.
- Create `src/app/page.tsx`: landing redirect/dashboard entry.
- Create `src/app/globals.css`: product UI styling.
- Create `src/app/live/[id]/page.tsx`: mobile audience H5 live room.
- Create `src/app/host/page.tsx`: mobile-first host room.
- Create `src/app/admin/page.tsx`: PC moderation console.
- Create `src/app/api/live-sessions/route.ts`: list/create live sessions.
- Create `src/app/api/live-sessions/[id]/route.ts`: live session detail/update.
- Create `src/app/api/live-sessions/[id]/start/route.ts`: start live.
- Create `src/app/api/live-sessions/[id]/end/route.ts`: end live and create replay record.
- Create `src/app/api/live-sessions/[id]/join/route.ts`: participant join.
- Create `src/app/api/live-sessions/[id]/token/route.ts`: role-based LiveKit token.
- Create `src/app/api/live-sessions/[id]/comments/route.ts`: list/create comments.
- Create `src/app/api/live-sessions/[id]/comments/[commentId]/approve/route.ts`: approve comment.
- Create `src/app/api/live-sessions/[id]/comments/[commentId]/reject/route.ts`: reject comment.
- Create `src/app/api/live-sessions/[id]/comments/[commentId]/pin/route.ts`: pin comment.
- Create `src/app/api/live-sessions/[id]/comments/[commentId]/mark-question/route.ts`: mark high-value question.
- Create `src/app/api/live-sessions/[id]/comments/[commentId]/route.ts`: delete comment.
- Create `src/app/api/live-sessions/[id]/mic-requests/route.ts`: list/create mic requests.
- Create `src/app/api/live-sessions/[id]/mic-requests/[requestId]/approve/route.ts`: approve mic request.
- Create `src/app/api/live-sessions/[id]/mic-requests/[requestId]/reject/route.ts`: reject mic request.
- Create `src/app/api/live-sessions/[id]/mic-requests/[requestId]/end/route.ts`: end mic access.
- Create `src/app/api/live-sessions/[id]/participants/route.ts`: list participants.
- Create `src/app/api/live-sessions/[id]/participants/[participantId]/mute/route.ts`: mute participant.
- Create `src/app/api/live-sessions/[id]/participants/[participantId]/unmute/route.ts`: unmute participant.
- Create `src/app/api/live-sessions/[id]/participants/[participantId]/kick/route.ts`: kick participant.
- Create `src/app/api/live-sessions/[id]/stats/route.ts`: live statistics.
- Create `src/lib/domain.ts`: product types and constants.
- Create `prisma/schema.prisma`: production-shaped relational model.
- Create `src/lib/store.ts`: repository abstraction with seeded development data for first local run.
- Create `src/lib/auth.ts`: Auth.js configuration with demo credentials provider and role mapping.
- Create `src/lib/livekit-adapter.ts`: mock-ready LiveKit operations.
- Create `src/lib/live-service.ts`: session, participant, token, and stats behavior.
- Create `src/lib/comment-service.ts`: comment review behavior.
- Create `src/lib/mic-service.ts`: mic request state machine.
- Create `src/lib/http.ts`: API JSON helpers.
- Create `src/lib/*.test.ts`: unit tests for services.

## Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Add project configuration**

Create the Next.js/TypeScript/Tailwind/Vitest configuration and scripts:

```json
{
  "scripts": {
    "dev": "next dev --hostname 127.0.0.1",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: Next.js, React, Tailwind, shadcn/Radix dependencies, Prisma, Auth.js, Zod, LiveKit SDKs, Vitest, and `package-lock.json` are installed.

- [ ] **Step 3: Run initial test command**

Run: `npm run test`

Expected: Vitest runs with no tests or a pass result once test files exist.

## Task 2: Domain And Test-First Services

**Files:**
- Create: `src/lib/domain.ts`
- Create: `prisma/schema.prisma`
- Create: `src/lib/store.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/livekit-adapter.ts`
- Create: `src/lib/live-service.ts`
- Create: `src/lib/comment-service.ts`
- Create: `src/lib/mic-service.ts`
- Create: `src/lib/live-service.test.ts`
- Create: `src/lib/comment-service.test.ts`
- Create: `src/lib/mic-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Cover:

```ts
expect(createTokenForRole("audience").canPublish).toBe(false);
expect(createTokenForRole("host").canPublish).toBe(true);
expect(sendComment({ mode: "review" }).status).toBe("pending");
expect(publicComments).not.toContain(pendingComment);
expect(approveMicRequest(requestId).participant.canPublish).toBe(true);
expect(endMicRequest(requestId).participant.canPublish).toBe(false);
expect(mutedUserComment).toThrow("USER_MUTED");
expect(kickedUserJoin).toThrow("USER_BANNED");
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test`

Expected: tests fail because services do not exist yet.

- [ ] **Step 3: Implement minimal domain services**

Implement Prisma-shaped types, seeded repository behavior, Auth.js demo role mapping, and typed services for session lifecycle, comment moderation, mic approval, participant moderation, token permission mapping, and statistics counters.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm run test`

Expected: all service tests pass.

## Task 3: API Routes

**Files:**
- Create all `src/app/api/live-sessions/**/route.ts` files listed in File Structure.
- Create: `src/lib/http.ts`

- [ ] **Step 1: Add JSON helper**

Implement consistent JSON success/error responses.

- [ ] **Step 2: Wire session APIs**

Expose list, create, detail, update, start, end, join, token, participants, stats, and replay behavior through route handlers.

- [ ] **Step 3: Wire moderation APIs**

Expose comment approve/reject/pin/delete/mark-question, mic approve/reject/end, participant mute/unmute/kick.

- [ ] **Step 4: Verify API TypeScript**

Run: `npm run build`

Expected: route handlers compile.

## Task 4: Product Pages

**Files:**
- Create: `src/app/live/[id]/page.tsx`
- Create: `src/app/host/page.tsx`
- Create: `src/app/admin/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Implement H5 audience page**

Use Tailwind and shadcn/Radix primitives where appropriate. Show live status, video surface, comments with pending/review states, like action, mic application state, muted/kicked/ended messages, and replay entry.

- [ ] **Step 2: Implement mobile host page**

Use browser media APIs through a small client component and keep LiveKit connection behind the adapter boundary. Show mobile-first live preview, camera/microphone readiness, front/back camera switch UI, start/end live controls, reconnect notice, approved comments, and high-value questions.

- [ ] **Step 3: Implement PC moderation console**

Use shadcn-style cards, badges, tabs, tables, dialogs, and buttons. Show live session list/create form, control dashboard, participants, comment review queue, mic request queue, and stats.

- [ ] **Step 4: Verify responsive layout**

Run the app and check:

- `/live/demo-live`
- `/host`
- `/admin`

Expected: pages are readable at mobile and desktop widths, and no text overlaps controls.

## Task 5: Final Verification

**Files:**
- All project files.

- [ ] **Step 1: Run unit tests**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 3: Start dev server**

Run: `npm run dev`

Expected: app serves on `http://127.0.0.1:3000`.

- [ ] **Step 4: Browser smoke test**

Open:

- `http://127.0.0.1:3000/live/demo-live`
- `http://127.0.0.1:3000/host`
- `http://127.0.0.1:3000/admin`

Expected: all MVP surfaces load and show seeded live data.
