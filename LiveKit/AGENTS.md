<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Development Status

## Product Goal

Build a WeChat private-domain live streaming MVP for product sales:

- Mobile host can walk around and introduce products.
- Audience enters from WeChat H5 share links or QR codes.
- Control room can create live rooms, start/end sessions, moderate comments, manage mic requests, and view live status.
- Operations can attribute viewers/customers to the person who shared the room.
- MVP must be maintainable and ready to evolve toward real database, auth, WeChat integration, and LiveKit production usage.

## Current Tech Stack

- Next.js App Router, React, TypeScript.
- Tailwind CSS with shadcn/Radix-style UI primitives.
- Local JSON persistence in `.data/app-store.json` for fast MVP iteration.
- Prisma schema prepared for later database migration.
- Vitest for domain/service tests.

## Completed Progress

- Project scaffold and core live room domain model.
- Admin control room at `/admin`.
- Mobile host console at `/host`.
- Audience H5 room at `/live/[id]`.
- Live session creation and status display: draft, scheduled, live, ended, closed.
- Comment moderation: pending, approve, reject, delete, pin, mark high-value question.
- Mic request flow and participant management.
- WeChat share URL and QR code generation.
- Share attribution with `source` and `sharedBy`.
- Share ranking API and admin ranking table.
- Local persistence for live sessions, comments, stats, share visits, and moderation state.
- Comment analytics API and admin "发言统计" tab.
- Customer lead aggregation API and admin "客户线索" tab.
- Customer follow-up board: room entry, watch duration, questions asked, interest temperature, WeCom status, lead stage, follow-up owner, follow-up status, and follow-up note.
- Customer follow-up state is persisted in local JSON and reflected in the Prisma schema.
- Data repository boundary added: current runtime uses `JsonStoreRepository`, while service/API code can later move to a Prisma-backed repository without changing product flows.
- Docker deployment plumbing added: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, production entrypoint, standalone Next build, and initial Prisma migration for PostgreSQL.
- Deployed to server `218.78.135.21` under `/opt/wechat-live/current` with Docker Compose. App is bound to host port `3001` because host port `3000` is already used by an existing service. Server-local health check `http://127.0.0.1:3001/admin` returns 200; public access requires opening port `3001` in the cloud security group.
- Mobile host console controls now show clear device, start, end, success, and error feedback. The host page also explains that mobile camera/microphone access is blocked on plain HTTP and requires HTTPS for real phone broadcasting.
- HTTPS production entry moved to `live.fuguilong.cn` to avoid overriding the existing `fuguilong.cn` website. The project does not start its own Caddy container in production; the server's existing Caddy is configured to proxy `live.fuguilong.cn` to this app and `/rtc` to self-hosted LiveKit.
- Self-hosted LiveKit Docker service added to Compose. The existing Caddy proxies `/rtc` to LiveKit on the same `live.fuguilong.cn` HTTPS origin, the app signs real LiveKit JWTs, mobile host publishes camera/mic tracks, and audience rooms subscribe to the host stream while keeping existing comment moderation and interaction flows.
- Docker image build now uses locally generated Next.js standalone output instead of building Next.js on the server. This keeps deployment lighter for the 7.5 GB RAM cloud host.
- LiveKit UDP media range is limited to `50000-50100/udp` for MVP deployment to avoid Docker spending a long time creating thousands of port mappings on the cloud host.
- `live.fuguilong.cn` DNS A record is configured and Caddy has obtained a valid Let's Encrypt certificate for the HTTPS production entry. Server-side checks confirm `/host` and `/live/demo-live` return HTTPS 200 through Caddy.
- Product decision: mic request approval belongs on the mobile host console, not the control-room admin. The admin can inspect request status, while the host accepts/rejects during the live session.
- Audience comments in review mode are visible to the sender immediately but hidden from other viewers until approved; the audience UI must not expose the word "审核".
- Audience comment cards must not show backend moderation states such as "已发送", "已展示", or "未展示"; those states are operational metadata and should stay out of the viewer-facing room.
- Approved mic viewers receive LiveKit publish permission and their video appears as a picture-in-picture tile on the host/audience live screen.
- Latest local change before session handoff: `src/components/audience-room.tsx` removed the moderation status badge beside audience comments, and `src/components/audience-room.test.tsx` covers that "已展示/已发送/未展示" are not visible in the audience room.
- Latest verification before session handoff: `npm run test` passed with 11 files / 34 tests, `npm run lint` passed, and `npm run build` passed.
- Latest deployment package before session handoff: `deploy-package.tar.gz` was rebuilt locally and confirmed to include `Dockerfile`, `docker-compose.yml`, `AGENTS.md`, `src/components/audience-room.tsx`, `src/components/audience-room.test.tsx`, and `.next/standalone/node_modules/next/package.json`. It has not yet been uploaded or deployed in this handoff state.
- Production redeploy completed on 2026-06-16: `deploy-package.tar.gz` was uploaded to `/opt/wechat-live/releases/deploy-package.tar.gz`, `/opt/wechat-live/current` was redeployed with Docker Compose, and `.env` kept `RUNTIME_BASE=current-app:latest`.
- Audience LiveKit playback now passes the exact host identity (`roomName-hostUserId`) into `LiveKitAudiencePlayer`, so the host camera track is rendered as the main video instead of being mistaken for a mic guest.
- Mobile host console now polls mic requests every 3 seconds, so new audience mic applications appear without the host leaving and re-entering the live room.
- Mobile host console no longer repeats the live title/status in two stacked top areas on phone screens; the visible title/status lives in the video overlay.
- Latest production verification: `https://live.fuguilong.cn/live/demo-live` and `https://live.fuguilong.cn/host` both returned HTTP 200 through Caddy; deployed bundles were checked for absence of audience comment status labels `已展示`, `已发送`, and `未展示`.
- Latest local verification after the production fixes: `npm run test` passed with 11 files / 37 tests, `npm run lint` passed, and `npm run build` passed.
- Production redeploy completed again on 2026-06-16 for the follow-up live-room fixes: audience online count now polls `/api/live-sessions/[id]/stats` every 3 seconds; `LiveKitAudiencePlayer` has iPhone inline playback attributes, click-to-recover playback messaging, and remote track/participant cleanup; mobile host console has first-screen mic requests, compact 36px controls, first-screen comment visibility, exact host identity filtering, and mic guest preview cleanup on track unsubscribe/participant disconnect.
- Latest production verification on 2026-06-16: `deploy-package.tar.gz` was rebuilt, uploaded to `/opt/wechat-live/releases/deploy-package.tar.gz`, extracted after cleaning remote `.next/standalone` and `.next/static`, and redeployed with Docker Compose while keeping `RUNTIME_BASE=current-app:latest`. `http://127.0.0.1:3001/host`, `https://live.fuguilong.cn/host`, and `https://live.fuguilong.cn/live/demo-live` returned 200; app logs showed Next ready; host HTML includes first-screen mic/comment markers and compact button classes; audience live HTML contains no `已展示`, `已发送`, or `未展示`; stats API returned `ok: true`.
- Latest local fixes pending deployment on 2026-06-16: mobile host console now removes the lower "高价值问题" section, keeps the video area clear and larger, moves mic requests below the video, keeps the four device/live buttons compact below the video, shows the audience interaction area as three compact rows with user ID plus message content and no row borders, and polls host-visible comments every 3 seconds. Mic requests now require a fresh host approval after an earlier approved/connected request; a new application ends stale approved/connected access and revokes audience publish permission until the host taps "通过". Admin comment review now polls live data every 3 seconds and sorts pending comments to the top. Audience and host video elements now set stricter mobile inline playback properties (`defaultMuted` via DOM, `preload=auto`, `playsinline`, `webkit-playsinline`, and a short retry after blocked playback) to reduce iPhone/WeChat no-picture cases.
- Latest local verification for the pending deployment: targeted red/green tests passed, full `npm run test` passed with 13 files / 46 tests, `npm run lint` passed, `npm run build` passed, and local mobile `/host` check on `http://127.0.0.1:4018/host` returned 200 with a 622px video area, mic request panel below the video, four 36px buttons, no "高价值问题", and the interaction panel in the first screen.

- CODE-AUDIT-REPORT.md remediation completed locally on 2026-06-16, pending package/deploy confirmation: live-session PATCH now whitelists editable fields instead of allowing `id`/`roomName`/`status`/`hostUserId` overwrite; whitespace-only comments are rejected before persistence/stats changes; JSON API helpers add baseline security headers; production LiveKit token creation rejects default or too-short secrets; mic approval now requires an `applied` request and refuses muted/banned participants; successful mic count is incremented only on the first valid approval; audience rooms keep the sender's own pending comment during polling; audience rooms send heartbeat POSTs to update watch duration/average watch duration; first share visits no longer collapse to `audience-1` when no viewer id is supplied; replay URLs are generated per live id; `normalizeStore` caches/clones the demo fallback instead of recreating it for every normalization; unused `recordPermissionUpdate` and the unused `questions` host prop were removed.
- Latest audit-remediation verification on 2026-06-16: targeted audit tests passed, full `npm run test` passed with 16 files / 57 tests, `npm run lint` passed, `npm run build` passed, `http://127.0.0.1:4018/host` returned 200 with host video/mic/comment markers present, `http://127.0.0.1:4018/api/live-sessions/demo-live/heartbeat` returned 200, and local `/live/demo-live` rendered without audience-facing `已展示` / `已发送` / `未展示` status labels.
- Production redeploy completed on 2026-06-16 after CODE-AUDIT-REPORT.md remediation: `deploy-package.tar.gz` was rebuilt and checked to contain `Dockerfile`, `docker-compose.yml`, `AGENTS.md`, `src/components/audience-room.tsx`, `src/app/api/live-sessions/[id]/heartbeat/route.ts`, and `.next/standalone/node_modules/next/package.json`; it was uploaded to `/opt/wechat-live/releases/deploy-package.tar.gz`, extracted into `/opt/wechat-live/current` after cleaning remote `.next/standalone` and `.next/static`, and redeployed with Docker Compose while keeping `RUNTIME_BASE=current-app:latest`.
- Latest production verification on 2026-06-16 after audit remediation: server-local `http://127.0.0.1:3001/host`, `/admin`, and `/live/demo-live` returned 200; app logs showed Next ready; public `https://live.fuguilong.cn/host`, `/admin`, and `/live/demo-live` returned 200; public host HTML contained `first-screen-mic-requests` and `host-first-screen-comments`; public stats API returned `ok: true`; and public audience live HTML contained no `已展示` / `已发送` / `未展示` status labels.
- Audit items intentionally left as next-stage architecture/security work rather than half-fixed MVP patches: real authentication/role-based authorization, full request-scoped repository isolation/Prisma storage, and richer route-level loading/error boundaries. Keep these in the Next Development Queue and do not treat the current local JSON MVP as production-auth complete.
- Latest local fixes pending deployment on 2026-06-16: host and audience interaction lists now render oldest-to-newest with the newest message at the bottom, auto-scroll to the bottom on new messages, remain manually scrollable, remove row/card borders, and display the viewer's WeChat-style nickname from `users.name` via enriched comment payloads. Host device/live status text is consolidated into one compact horizontal line below the four 36px controls. Host and audience online displays use refreshed `currentOnline` stats, and participant heartbeats now update `lastActiveAt` so stale viewers drop out of real-time online counts while peak online remains historical.
- Latest local verification for these pending interaction/online-count fixes: targeted tests passed with 4 files / 33 tests, full `npm run test` passed with 16 files / 61 tests, `npm run lint` passed, `npm run build` passed, local `http://127.0.0.1:4018/host`, `/live/demo-live`, and `/api/live-sessions/demo-live/stats` returned 200, and browser smoke checks at a 390px mobile viewport confirmed the host 36px controls, one-line status, no-border interaction area, audience no-border scrollable comments, WeChat nickname rendering, and `currentOnline` display.
- Production redeploy completed on 2026-06-16 for the interaction/online-count fixes: `deploy-package.tar.gz` was rebuilt locally and confirmed to include `Dockerfile`, `docker-compose.yml`, `AGENTS.md`, `src/components/mobile-host-console.tsx`, `src/components/audience-room.tsx`, `.next/static`, and `.next/standalone/node_modules/next/package.json`; it was uploaded to `/opt/wechat-live/releases/deploy-package.tar.gz`; remote `.next/standalone` and `.next/static` were cleaned before extraction into `/opt/wechat-live/current`; `.env` kept `RUNTIME_BASE=current-app:latest`; Docker Compose rebuilt `current-app:latest` and restarted `app`.
- Latest production verification on 2026-06-16 for the interaction/online-count fixes: app logs showed `Next.js 16.2.9` ready; server-local `http://127.0.0.1:3001/host`, `/live/demo-live`, and `/api/live-sessions/demo-live/stats` returned 200; public `https://live.fuguilong.cn/host`, `https://live.fuguilong.cn/live/demo-live`, and public stats API returned 200; public host HTML contained `host-status-line` and `host-first-screen-comments`; public audience HTML contained `audience-comments-panel` and no `已展示` / `已发送` / `未展示` status labels.
- Production disk maintenance completed on 2026-06-17: server disk check showed `/` at 100G total, 49G used, 52G available, 49% usage before cleanup, with inode usage at 4%. Safe Docker cleanup removed stopped containers, dangling images, unused networks, and all unused BuildKit cache; Docker volumes were intentionally not pruned to avoid deleting PostgreSQL/app data. After cleanup `/` was 36G used, 65G available, 36% usage; `docker system df` showed Build Cache `0B`, running Compose services stayed up, server-local `/host`, `/live/demo-live`, and stats returned 200, and public `https://live.fuguilong.cn/host`, `/live/demo-live`, and stats returned 200.
- Latest local fixes pending deployment on 2026-06-17: audience room bottom action changed from like count to "留言互动" and focuses the comment input; audience comment input is borderless with the "发送" button on the same row; the subtitle/description under the audience live title was removed; audience mic button now shows `申请连麦` / `申请中` / `连麦中` state, and a connected audience can end their own mic session through `/mic-requests/[requestId]/end`; host console now shows connected mic guests with a per-guest "结束连麦" action; host and audience LiveKit players now support multiple remote mic video tiles instead of a single guest preview.
- Latest local verification for these pending audience/mic fixes: targeted tests passed with 3 files / 21 tests, full `npm run test` passed with 16 files / 65 tests, `npm run lint` passed, `npm run build` passed, local `http://127.0.0.1:4018/host` and `/live/demo-live` returned 200, host HTML contained `host-connected-mic-guests`, audience HTML contained `audience-comment-compose`, and visible server-rendered audience text no longer contained the live description under the title. These changes have not been packaged or deployed yet.
- Production redeploy completed on 2026-06-17 for the audience interaction and multi-mic fixes: `deploy-package.tar.gz` was rebuilt locally and confirmed to include `Dockerfile`, `docker-compose.yml`, `AGENTS.md`, `src/components/audience-room.tsx`, `src/components/mobile-host-console.tsx`, `src/components/livekit-audience-player.tsx`, `.next/static`, and `.next/standalone/node_modules/next/package.json`; it was uploaded to `/opt/wechat-live/releases/deploy-package.tar.gz`; remote `.next/standalone` and `.next/static` were cleaned before extraction into `/opt/wechat-live/current`; `.env` kept `RUNTIME_BASE=current-app:latest`; Docker Compose rebuilt `current-app:latest` and restarted `app`.
- Latest production verification on 2026-06-17 for the audience interaction and multi-mic fixes: app logs showed `Next.js 16.2.9` ready; server-local `http://127.0.0.1:3001/host`, `/live/demo-live`, and `/api/live-sessions/demo-live/stats` returned 200; server-local host HTML contained `host-connected-mic-guests`, audience HTML contained `audience-comment-compose`, and the live description was not present in visible server-rendered text; public `https://live.fuguilong.cn/host`, `https://live.fuguilong.cn/live/demo-live`, and public stats API returned 200; public host HTML contained `host-connected-mic-guests`, public audience HTML contained `audience-comment-compose`, visible audience text did not contain the live description, and no `已展示` / `已发送` / `未展示` status labels were present.

## Active Development

- Implement the Prisma-backed repository behind the store repository boundary.
- Keep the new follow-up state model aligned between local JSON and Prisma.
- Keep the local JSON store as the fast preview mode until database setup is ready.

## Deployment Pitfalls Log

- Server port `3000` may already be occupied by another service. Keep this app bound to host port `3001` through Docker Compose and expose it publicly through the existing Caddy reverse proxy.
- Do not overwrite the existing `fuguilong.cn` website. Production live streaming entry is `live.fuguilong.cn`; Caddy routes this subdomain to the live app and routes `/rtc` to LiveKit.
- `live.fuguilong.cn` must have its own DNS `A` record pointing to `218.78.135.21`. Having only the root domain `fuguilong.cn` resolved is not enough; Caddy/Let's Encrypt will fail with `no valid A records found for live.fuguilong.cn`.
- After adding DNS, authoritative DNS can show the new record before recursive resolvers refresh. Verify both `nslookup live.fuguilong.cn a.ezdnscenter.com` and normal `nslookup live.fuguilong.cn`; use `curl --resolve live.fuguilong.cn:443:218.78.135.21` when checking Caddy before caches catch up.
- Mobile camera and microphone capture will not work from plain HTTP on real phones. Use HTTPS (`https://live.fuguilong.cn`) for host broadcasting and audience playback.
- A very large LiveKit UDP range such as `50000-60000/udp` can make Docker spend a long time creating thousands of port mappings on the cloud host and appear stuck during `docker compose up`. The MVP range is limited to `50000-50100/udp`; expand only when capacity testing shows it is needed.
- `50000-50100/udp` does not mean only 100 viewers can watch. It is a UDP media port allocation range. Actual concurrency depends on CPU, bandwidth, LiveKit routing behavior, video bitrate, and client networks.
- The production Docker image depends on local `.next/standalone`. Do not exclude `.next/standalone/node_modules` from the Docker build context or tar package. Root `node_modules` can be excluded, but `.dockerignore` must use `/node_modules` instead of `node_modules`.
- When packaging for deployment, prefer an explicit tar include list containing `.next/standalone` and `.next/static`. Avoid broad `--exclude=node_modules`, because it can also remove `.next/standalone/node_modules` and cause runtime errors such as `Cannot find module 'next'`.
- When redeploying a tar package into `/opt/wechat-live/current`, do not only overlay-extract the new package. Old `.next/static` chunks can remain on disk and still contain removed client code such as audience status badges. Before extracting the package, clean only the generated build artifact directories: `cd /opt/wechat-live/current && rm -rf .next/standalone .next/static`, then extract the tar and rebuild the Docker image.
- When verifying removal of audience-facing comment status labels, avoid a broad deployed-bundle grep alone. The host console can legitimately contain text such as `暂无已展示留言。`; verify the audience live HTML or audience component chunk specifically for absence of `已展示`, `已发送`, and `未展示` near viewer comments.
- Do not run `next build` on the small cloud host during deploy. Build locally first, upload the standalone output, then let Docker build a lightweight runtime image.
- Docker registry mirrors can return `429 Too Many Requests` while resolving `node:22-alpine`. If the server already has `current-app:latest`, set `RUNTIME_BASE=current-app:latest` in `/opt/wechat-live/current/.env` before `docker compose build app` to rebuild from the local runtime image and avoid remote base-image metadata requests.
- For routine Docker disk cleanup, prefer `docker container prune -f`, `docker image prune -f`, `docker network prune -f`, and `docker builder prune -af`. Do not run `docker volume prune` or `docker system prune --volumes` unless there is a verified backup and a deliberate decision to remove database/app data volumes.
- Next 16 may auto-add `.next/dev/types/**/*.ts` to `tsconfig.json`. If `npm run build` fails inside `.next/dev/types/validator.ts` with a generated-type error such as `Cannot find name 'IsExpected'`, treat `.next/dev` as stale dev-server output and regenerate/clean the generated artifact before changing application source.
- The project no longer starts its own Caddy container in production. The existing `weblj-caddy-1` container must be connected to the `current_default` Docker network so it can reach `app:3000` and `livekit:7880`.
- A plain `HEAD /rtc` request can return `404`; that does not prove LiveKit is down. Verify the LiveKit proxy with a WebSocket upgrade request to `/rtc?access_token=bad`; the expected proxy-level signal is LiveKit returning `401 invalid authorization token` and logging the `/rtc` request.
- Be careful when sending remote shell commands from local PowerShell: expressions such as `$(date ...)` can be expanded locally before SSH execution. Avoid `$()` in remote command strings or escape it explicitly.
- Local defaults (`devkey` / `secret`) are development-only. The server `.env` should use a generated `LIVEKIT_API_SECRET` with at least 32 characters; otherwise LiveKit logs `secret is too short`.
- Local `git status` / `git diff` can fail with Git "dubious ownership" because the workspace may be owned by another Windows user while Codex runs as a sandbox user. Do not change global git config just for this; rely on targeted file inspection unless the user explicitly asks to fix git safe.directory.

## Current Session Handoff

- Production deployment is complete for the host layout simplification, mic/manual approval fixes, admin pending-comment polling/top sorting, iPhone playback hardening, and CODE-AUDIT-REPORT.md remediation.
- Verified locally on 2026-06-16 before deploy: `npm run test` passed with 16 files / 57 tests, `npm run lint` passed, `npm run build` passed, `/host` and `/api/live-sessions/demo-live/stats` returned 200 on local dev server `http://127.0.0.1:4018`, heartbeat POST returned 200, and browser smoke checks confirmed host video/mic/comment markers plus no audience-facing comment status labels on `/live/demo-live`.
- Verified in production on 2026-06-16 after deploy: `/opt/wechat-live/current/.env` kept `RUNTIME_BASE=current-app:latest`; Docker Compose rebuilt `current-app:latest` and restarted `app`; server-local `/host`, `/admin`, and `/live/demo-live` returned 200; public `https://live.fuguilong.cn/host`, `https://live.fuguilong.cn/admin`, and `https://live.fuguilong.cn/live/demo-live` returned 200; public `/live/demo-live` did not contain `已展示` / `已发送` / `未展示`; public host HTML contained first-screen mic/comment markers; public stats API returned `ok: true`; app logs showed Next ready.
- Production deployment is complete for the interaction list layout, WeChat nickname display, one-line host status, and real-time online-count fixes.
- Verified in production on 2026-06-16 after deploy: `/opt/wechat-live/current/.env` kept `RUNTIME_BASE=current-app:latest`; Docker Compose rebuilt `current-app:latest` and restarted `app`; server-local `/host`, `/live/demo-live`, and stats API returned 200; public `https://live.fuguilong.cn/host`, `https://live.fuguilong.cn/live/demo-live`, and public stats API returned 200; public host HTML contained `host-status-line` and `host-first-screen-comments`; public audience HTML contained `audience-comments-panel` and no `已展示` / `已发送` / `未展示` status labels.
- Production disk maintenance is complete as of 2026-06-17: safe Docker cleanup reclaimed space from stopped containers, dangling images, unused networks, and BuildKit cache only; volumes were not pruned. Root disk usage went from 49% to 36%, and local/public app health checks still returned 200.
- Production deployment is complete for the audience interaction and multi-mic fixes: audience bottom action now focuses the comment input, the comment composer is inline and borderless, audience mic state can move through apply/pending/connected/reset, audience and host can end a connected mic session, multiple mic video tiles are supported, and the audience title subtitle is hidden.
- Next recommended product step: manually smoke-test with two phones over HTTPS, including the specific iPhone models that previously had no picture, because iPhone playback can still vary by iOS/WeChat version and network path even after inline playback hardening.

## Next Development Queue

1. Replace local JSON persistence with Prisma-backed database storage.
2. Add authentication and role-based permissions for admin, moderator, host, and audience.
3. Add WeChat JS-SDK/share landing integration.
4. Add export and search for comments, share ranking, and customer leads.
5. Rotate LiveKit API key/secret for production and add TURN/TLS if WeChat/corporate networks need stronger connectivity.

## Verification Rule

Before reporting development complete, run:

- `npm run test`
- `npm run lint`
- `npm run build`

Also smoke-test the touched API/page when a local dev server is available.
