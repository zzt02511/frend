# WeChat Private Live MVP Design

**Goal:** Build the first runnable version of a WeChat private-domain interactive live streaming system using a single full-stack application.

**Decision:** Use a single Next.js full-stack MVP for the first product version. It will include the WeChat H5 audience room, mobile host room, PC moderation console, API routes, data model, and a LiveKit adapter layer in one repository.

**Date:** 2026-06-15

---

## Product Scope

The MVP implements the P0 loop from the PRD:

- Admin creates a live session.
- Host starts and ends the live session.
- Audience joins the H5 live room and watches.
- Audience sends comments, likes, and applies for mic access.
- Audience comments enter the moderation workflow before they are shown publicly by default.
- Moderator reviews comments and interaction messages, mutes users, kicks users, and approves or rejects mic requests.
- Approved mic requests grant publish permission through the LiveKit adapter.
- Ending a live session creates a replay record in a local mock-ready state and updates basic statistics.

The MVP excludes the P1/P2 marketing and platform features:

- WeChat OAuth, official account menu, and mini program entry.
- Enterprise WeChat customer recognition.
- Lead forms, posters, coupons, product cards, lottery, and questionnaire modules.
- Full LiveKit Ingress, Egress deployment automation, OBS ingest, CDN distribution, CRM/SCRM integration, and AI recap.

## Architecture

The application will be a single Next.js App Router project with TypeScript. UI pages and backend API handlers live in one app so the first version can be developed and verified quickly.

The system keeps a clear internal boundary around LiveKit. Product logic calls a `livekitAdapter` interface for token generation, room lifecycle, participant permission updates, mute, and kick operations. During local development, the adapter can run in mock mode when LiveKit credentials are not configured; with credentials present, it can call the real LiveKit SDK.

Persistent data uses Prisma. SQLite is the default local database so the app can run immediately. The Prisma schema is kept compatible with PostgreSQL-oriented field types and names so production migration to PostgreSQL stays straightforward.

## Applications And Pages

### Audience H5

Path: `/live/[id]`

The audience page is optimized for WeChat H5 but remains usable in normal mobile browsers. It includes:

- Live video area.
- Live title, status, host information, and online count.
- Comment list and send box.
- Comment submission state showing pending review, approved, or rejected messages.
- Like button.
- Apply/cancel mic request button.
- Mic request status.
- Muted, kicked, ended, and replay states.

In the MVP, video playback can show a LiveKit connection panel or mock live surface depending on environment configuration. The page must still exercise the same token and participant APIs.

### Mobile Host

Path: `/host`

The host side is mobile-first because hosts need to walk around and introduce products on camera. It includes:

- Host live session list.
- Enter live room action.
- Device readiness panel for camera and microphone.
- Start live and end live actions.
- Front/back camera switching.
- Portrait-first live preview.
- Network and reconnection status.
- Comment viewing panel.
- Connected guest/mic participant area.

Screen sharing is not part of the mobile-first MVP host flow. If screen sharing or PPT presentation is needed, it should be handled by a separate PC guest/assistant role in a follow-up version.

The mobile host page should work in modern mobile browsers and be tested inside WeChat where possible. Because WeChat H5 WebRTC behavior varies by iOS, Android, and WeChat version, the page must include a clear fallback state that tells the host to open the same link in the system browser when camera or microphone capture is blocked.

### Moderation Console

Path: `/admin`

The moderation console includes:

- Live session list and create/edit live session form.
- Live control dashboard.
- Online participant list.
- Comment moderation queue.
- Interaction moderation queue for audience messages that need review before public display.
- Mic request queue.
- Actions for approve/reject comment, pin/delete comment, mute/unmute user, kick user, approve/reject mic request, and end mic access.
- High-value question marker so moderators can surface useful audience questions to the host view.
- Basic live statistics.

The UI should feel like an operations console: dense, clear, and fast to scan. It should avoid marketing-style hero sections.

## Roles And Permissions

The MVP supports these roles:

- `super_admin`
- `director`
- `host`
- `moderator`
- `audience`

LiveKit permission mapping:

- Audience can join and subscribe, but cannot publish audio/video by default.
- Host can join, subscribe, publish mobile camera/microphone audio/video, and publish data.
- Moderator can join, subscribe, publish data, and perform room administration through backend APIs.
- Director and super admin can perform all moderation and management actions.

The system must never force-enable a user's microphone or camera. It can grant publish permission, revoke publish permission, mute tracks, or kick participants, but device capture requires user action and browser permission.

## Data Model

The MVP stores the following entities:

- `User`: profile, role, status, optional WeChat identifiers, and optional mobile.
- `LiveSession`: title, cover, description, room name, status, planned time, actual start/end time, host, comment settings, mic settings, recording settings, and replay URL.
- `LiveParticipant`: live session user state, LiveKit identity, role in session, join/leave time, watch duration, muted/banned flags, and publish permission.
- `LiveComment`: content, status, pinned flag, sensitive-word hit fields, reviewer, and timestamps.
- `MicRequest`: request status, reason, approver, connection time, and end time.
- `LiveStats`: PV, UV, peak online, average watch duration, comments, likes, mic applications, leads, and replay views.
- `ReplayRecord`: recording/replay status, URL, visibility, and timestamps.
- `AuditLog`: actor, action, target, metadata, and timestamp for moderation actions.

## API Surface

The MVP API will include:

- `GET /api/live-sessions`
- `POST /api/live-sessions`
- `GET /api/live-sessions/[id]`
- `PATCH /api/live-sessions/[id]`
- `POST /api/live-sessions/[id]/start`
- `POST /api/live-sessions/[id]/end`
- `POST /api/live-sessions/[id]/join`
- `POST /api/live-sessions/[id]/token`
- `GET /api/live-sessions/[id]/participants`
- `PATCH /api/live-sessions/[id]/participants/[participantId]`
- `POST /api/live-sessions/[id]/participants/[participantId]/mute`
- `POST /api/live-sessions/[id]/participants/[participantId]/unmute`
- `POST /api/live-sessions/[id]/participants/[participantId]/kick`
- `GET /api/live-sessions/[id]/comments`
- `POST /api/live-sessions/[id]/comments`
- `POST /api/live-sessions/[id]/comments/[commentId]/approve`
- `POST /api/live-sessions/[id]/comments/[commentId]/reject`
- `POST /api/live-sessions/[id]/comments/[commentId]/pin`
- `POST /api/live-sessions/[id]/comments/[commentId]/mark-question`
- `DELETE /api/live-sessions/[id]/comments/[commentId]`
- `GET /api/live-sessions/[id]/mic-requests`
- `POST /api/live-sessions/[id]/mic-requests`
- `POST /api/live-sessions/[id]/mic-requests/[requestId]/approve`
- `POST /api/live-sessions/[id]/mic-requests/[requestId]/reject`
- `POST /api/live-sessions/[id]/mic-requests/[requestId]/end`
- `GET /api/live-sessions/[id]/stats`
- `GET /api/live-sessions/[id]/replay`

Authentication is intentionally simple in the first local MVP. The app can seed demo users and allow switching roles through a development-only user selector. Production authentication is out of scope for this first loop.

## Comment Rules

The default MVP comment mode is `review`. Audience comments are saved immediately but are not shown in the public audience comment stream until a moderator approves them. The sender can see their own pending comment state so the product feels responsive.

Supported comment modes:

- `free`: comments are approved immediately.
- `review`: comments are created as `pending` and require moderator approval.
- `host_only`: comments are visible in host/admin views but not audience public list.
- `closed`: audience cannot send comments.

The moderation console must support approving, rejecting, deleting, pinning, and marking a comment as a high-value question. Host view should show approved public comments and a separate high-value question list.

Muted or banned users cannot send comments. Sensitive-word management is P1, but the MVP schema and service interface should include fields for future sensitive-word hits.

## Mic Flow

The MVP mic request state machine:

- `applied`
- `approved`
- `rejected`
- `connected`
- `cancelled`
- `ended`
- `kicked`

When a moderator approves a request, the backend updates the participant state and calls the LiveKit adapter to grant publish permission. The audience page then prompts the user to grant browser microphone/camera permission. Ending mic access revokes publish permission.

## Replay And Recording

The MVP creates replay metadata when a live session ends. Full LiveKit Egress recording is represented behind the `livekitAdapter` and can be mocked locally. The UI should show replay states:

- `recording`
- `processing`
- `ready`
- `failed`
- `hidden`
- `deleted`

The first version can use a sample replay URL in seed data.

## Statistics

The MVP statistics dashboard includes:

- Current online count.
- Peak online count.
- UV/PV.
- Comment count.
- Like count.
- Mic request count.
- Successful mic count.
- Replay view count.

Statistics can be updated by API-side service calls rather than a real-time analytics pipeline in the first version.

## Testing Strategy

Use test-first implementation for product logic:

- Data validation and status transitions.
- Comment mode behavior.
- Muted/banned user restrictions.
- Mic request approval/rejection/end transitions.
- LiveKit permission mapping.
- Live session start/end behavior.

UI behavior should be verified with focused component or page tests where the project tooling supports it, and with browser checks after the app runs.

## Acceptance Criteria

The MVP is accepted when:

- A demo admin can create a live session.
- A demo host can start and end the live session.
- A demo audience user can join the live room.
- An audience user cannot publish by default.
- An audience user can send comments according to the configured comment mode.
- In the default `review` mode, an audience comment is not publicly visible until moderator approval.
- The sender can see that their submitted comment is pending review.
- A moderator can approve, reject, delete, and pin comments.
- A moderator can mark a comment as a high-value question for the host.
- The host can see approved comments and high-value questions.
- A moderator can mute and kick a participant.
- A muted audience user cannot comment.
- A kicked audience user cannot continue in the same live session.
- An audience user can apply for mic access.
- A moderator can approve or reject the mic request.
- Approval grants publish permission in the app state and LiveKit adapter call.
- Ending mic access revokes publish permission.
- Ending a live session creates a replay record and updates the session status.
- A mobile host can start live video from a phone camera, switch camera direction, and recover from a refresh or short disconnect.
- The admin dashboard shows basic live statistics.

## Open Constraints

The current workspace contains only the PRD document and no existing app code. The implementation plan should start by scaffolding the Next.js project and selecting the local test runner. Network access may be needed to install dependencies.
