# 微信私域直播系统 — 代码审计报告

> 审计日期：2026-06-16  
> 审计范围：`src/` 全部源代码（lib + components + app）  
> 发现 Bug：7 个（严重 2 / 中等 3 / 轻微 2）  
> 改进建议：12 条（架构 4 / 安全 3 / 健壮性 5）

---

## 一、Bug 清单

### 🔴 严重

#### B1. `PATCH /api/live-sessions/[id]` 无字段白名单，可越权修改任意字段

**文件**: `src/app/api/live-sessions/[id]/route.ts:20`

```typescript
Object.assign(live, await readJson(request));
```

客户端可以发送任意 JSON，覆盖 `id`、`roomName`、`status` 等敏感字段。例如攻击者可以把已结束的直播状态改回 `"live"`，或修改 `hostUserId` 窃取主播身份。

**建议修复**:
```typescript
const allowed = pick(body, ["title", "description", "coverUrl", "enableComment", "commentMode", "enableMicApply"]);
Object.assign(live, allowed);
```

---

#### B2. 共享内存 Store 在并发写入时存在竞态条件

**文件**: `src/lib/store.ts:107-115`

`getStore()` 返回全局单例，所有 API 路由共享同一个 `AppStore` 对象。多个请求并发调用 `persistStore()` 时，会互相覆盖 `.data/app-store.json` 文件：

1. 请求 A 读取 store，修改 comments，保存到文件
2. 请求 B 读取 store（在 A 保存之前），修改 micRequests，保存到文件
3. 结果：A 的修改丢失

**建议修复**: 在 `saveStoreToFile` 中加入文件锁（如 `proper-lockfile`），或改用 Repository 的 `mutate()` 方法（当前 `mutate` 方法虽然在同一进程内原子，但 service 层并未统一使用它）。

---

### 🟡 中等

#### B3. 发送纯空白评论可通过 Zod 校验但内容为空

**文件**: `src/app/api/live-sessions/[id]/comments/route.ts:28` + `src/lib/comment-service.ts:22`

- Zod schema: `z.string().min(1)` — 一个空格就满足
- Service: `content: input.content.trim()` — trim 后变为空字符串

**复现**: 发送 `{ content: "   " }` → Zod 通过 → 数据库存入空字符串。

**建议修复**: Zod schema 加 `.refine(s => s.trim().length > 0, "内容不能为空白")` 或 service 层校验 trimmed content 非空。

---

#### B4. 观众观看时长几乎始终为 0

**文件**: `src/lib/lead-service.ts:140-143` + `src/lib/live-service.ts:47-65`

```typescript
function getWatchDurationSeconds(participant) {
  if (participant.watchDuration > 0) return Math.round(participant.watchDuration);
  if (!participant.leaveTime) return 0;  // ← 观众离开时 leaveTime 不会被设置
  // ...
}
```

当前代码中，`leaveTime` 只在 `kickParticipant()` 中被设置。正常观众关闭页面/离开直播间时，没有任何逻辑更新 `leaveTime` 和 `watchDuration`。结果客户跟进看板中的"观看时长"列几乎全部显示 `0` 或 `"未统计"`。

**建议修复**: 增加一个 API 端点（如 `POST /api/live-sessions/[id]/heartbeat`），客户端定期心跳上报，服务端累加 `watchDuration`；或客户端离开时调用 `leave` 端点。

---

#### B5. 已踢出/已禁言用户仍可被批准连麦

**文件**: `src/lib/mic-service.ts:61-79`

`approveMicRequest()` 查找或创建 participant 后直接设置 `canPublish = true`，不检查 `participant.isBanned` 或 `participant.isMuted` 状态。

**复现**: 
1. 场控踢出用户 A
2. 用户 A 重新提交连麦申请（`applyForMic` 同理也不检查 `isBanned`，但实际上 `joinLiveSession` 会检查 → 会抛出 `USER_BANNED`）
3. 等等... 从 `applyForMic` 看，line 21 确实检查了 `participant.isBanned`。但 `approveMicRequest` line 63-68 的 `joinLiveSession` 调用会在被踢用户场景抛出 `USER_BANNED`。

更隐蔽的问题：`approveMicRequest` 的 `joinLiveSession` 传入的是 `request.userId`，但 `joinLiveSession` 在查找 existing participant 时如果找到 `isBanned: true` 的 participant 会抛出 `USER_BANNED`。这是对的。但 `approveMicRequest` 没有 try-catch，会导致 API 返回 500 错误。

**建议修复**: 在 `approveMicRequest` 中明确检查 participant 的状态，抛出语义明确的错误（如 `"USER_BANNED_CANNOT_APPROVE_MIC"`）而非依赖隐式传播。

---

### 🟢 轻微

#### B6. 首次分享访问的 viewerId 被错误记录为 `"audience-1"`

**文件**: `src/app/live/[id]/page.tsx:27-29`

```typescript
recordShareVisit(store, {
  liveId: id,
  viewerId: viewerId || "audience-1",  // ← 绝大多数首次访问者
  source: firstParam(query.source),
  sharedBy: firstParam(query.sharedBy),
});
```

这是服务端渲染时执行的。URL 参数中的 `viewerId` 只有通过分享链接显式传入才会存在，而客户端生成的 `wxv-*` ID 是在页面加载后通过 `localStorage` 生成的。因此所有直接访问和首次扫码的用户，其 share visit 都会被记录为 `"audience-1"`。

**建议修复**: 服务端在 URL 无 `viewerId` 时生成服务端 UUID 并下发给客户端（通过 cookie 或响应头），客户端优先使用服务端生成的 ID。

---

#### B7. `normalizeStore` 在每次 `getStore()` 调用时重新创建 demo 数据

**文件**: `src/lib/store-persistence.ts:20-34` + `src/lib/store.ts:108-114`

```typescript
export function getStore() {
  if (!globalStore.__wechatLiveStore) {
    globalStore.__wechatLiveStore = getStoreRepository().load();
  }
  globalStore.__wechatLiveStore = normalizeStore(globalStore.__wechatLiveStore);
  return globalStore.__wechatLiveStore;
}
```

`normalizeStore` 内部调用 `createDemoStore()` 作为 fallback，而 `createDemoStore()` 每次都创建新的 demo 对象和 shareVisit 时间戳。虽然每次调用 `getStore()` 都会执行一次完整的数据合并和 demo 数据重建（无意义的 CPU 消耗）。在 MVP 阶段影响不大，但高频调用的 API 路由会累积开销。

**建议修复**: 只在首次加载或文件不存在时 normalize；或让 normalize 不依赖 `createDemoStore()` 的每次调用。

---

## 二、安全建议

### S1. 所有操作者的 actorId 均为硬编码

**影响文件**: `admin-console.tsx` (lines 233, 243, 280)、`mobile-host-console.tsx` (line 309)、`live/[id]/page.tsx` (line 27)

当前 MVP 没有认证系统，"actorId" 由前端自行声明。攻击者可以：
- 伪造 `actorId: "host-1"` 来开播/关播
- 伪造 `actorId: "moderator-1"` 来审核评论

**建议**: MVP 阶段可接受，但在接入真实数据库后应立即实现服务端 session 认证。

---

### S2. LiveKit API key/secret 硬编码默认值

**文件**: `src/lib/livekit-adapter.ts:4-6`

```typescript
const DEFAULT_LIVEKIT_API_KEY = "devkey";
const DEFAULT_LIVEKIT_API_SECRET = "secret";
```

生产环境如果没有设置环境变量，会使用 `devkey/secret`。虽然 `AGENTS.md` 记录了需要在 `.env` 中设置，但代码层面缺乏强制校验。

**建议**: 在 `createLiveKitToken` 开头检查：如果使用的仍是默认值且 `NODE_ENV === "production"`，抛出错误。

---

### S3. API 响应未设置安全头

所有 API 路由的 `jsonOk` / `jsonError` 未设置 `X-Content-Type-Options`、`X-Frame-Options` 等。虽然 Next.js 有一定默认保护，但建议在 `http.ts` 的 response helpers 中统一添加。

---

## 三、架构建议

### A1. Store 的 `mutate` 模式未被 Service 层统一使用

`JsonStoreRepository.mutate()` 提供了原子性读写模式，但所有 service 函数都是直接操作 `getStore()` 返回的内存对象然后调用 `persistStoreIfGlobal`。这导致：

- 无法平滑切换到 Prisma（Prisma repository 的 `mutate` 需要包裹事务）
- 并发写入不安全

**建议**: 重构所有 service 函数使用 `getStoreRepository().mutate(store => { ... })` 模式。

---

### A2. 缺少请求级别的 Store 隔离

当前全局单例意味着开发时所有请求共享数据。Next.js 在生产环境的 serverless/edge 模式下，不同请求可能运行在不同进程中，数据一致性取决于部署模式。

**建议**: 短期可接受，中期应迁移到 Prisma + PostgreSQL（Prisma schema 已就绪）。

---

### A3. 客户端状态的"乐观更新"与轮询刷新互相冲突

**文件**: `src/components/audience-room.tsx:126`

`sendComment` 做乐观更新：`setComments((items) => [payload.data, ...items])`，但 `fetchVisibleComments` 每 5 秒覆盖整个列表。在审核模式下，新发送的评论状态是 `"pending"`，而 poll 回来的公开列表只包含 `"approved"` 评论 → 用户刚发出的评论会短暂出现然后消失。

**建议**: 
1. 分离"我的评论"和"公开评论"两个列表
2. 或者 poll 时保留本地已发送的评论不被覆盖

---

### A4. 缺少全局错误边界和加载状态

所有页面组件（`AdminConsole`、`MobileHostConsole`、`AudienceRoom`）都没有：
- `error.tsx` 错误边界
- `loading.tsx` 加载骨架屏
- 网络请求失败时的用户友好提示（部分有，如 cameraState）

---

## 四、健壮性建议

### R1. `createLiveKitToken` 中的 `canPublishOverride` 逻辑有冗余

**文件**: `src/lib/livekit-adapter.ts:49-51`

```typescript
const grants = {
  ...grantsForRole(input.role),
  ...(input.canPublishOverride === undefined ? {} : { canPublish: input.canPublishOverride }),
};
```

`live-service.ts:80` 总是传入 `canPublishOverride: participant.canPublish`。当 role 是 audience 且 canPublish 为 false 时（与 grantsForRole 结果相同），没必要传 override。但当 mic 被批准设 `canPublish = true` 时这行才有效。

当前逻辑正确，但建议去除 `canPublishOverride` 参数，直接让调用方传入计算好的 `canPublish` 值，减少适配层的条件分支。

---

### R2. `livekit-adapter.ts` 的 `recordPermissionUpdate` 是死代码

**文件**: `src/lib/livekit-adapter.ts:81-83`

```typescript
export function recordPermissionUpdate() {
  return { ok: true };
}
```

全仓库无任何引用。建议删除或实现。

---

### R3. Mic 审批后 `successfulMicCount` 递增逻辑不严谨

**文件**: `src/lib/mic-service.ts:75`

每次调用 `approveMicRequest` 都递增 `successfulMicCount`。但同一用户可多次申请-批准-结束-再申请-再批准，每次批准都递增 → 统计值虚高。

**建议**: 改为只对首次从 `"applied"` 变为 `"approved"` 且之前没有 `"connected"` 状态记录的情况递增。

---

### R4. `mobile-host-console.tsx` 传入 `questions` prop 但从未在组件内使用

**文件**: `src/app/host/page.tsx:12` + `src/components/mobile-host-console.tsx:58`

```typescript
// host/page.tsx
const questions = comments.filter((item) => item.isHighValueQuestion);
return <MobileHostConsole live={live} comments={comments} questions={questions} ... />;

// MobileHostConsole props
{ live, comments, questions, micRequests }: {
  live: LiveSession;
  comments: LiveComment[];
  questions: LiveComment[];  // ← 从未被使用
  micRequests: MicRequest[];
}
```

`questions` prop 定义了但组件内部毫无引用。

---

### R5. `endLiveSession` 硬编码回放 URL

**文件**: `src/lib/live-service.ts:96`

```typescript
live.replayUrl = "/sample-replay.mp4";
```

每次结束直播都生成同一个回放 URL，且文件不存在。

---

## 五、总结

| 类别 | 数量 | 说明 |
|------|------|------|
| 🔴 严重 Bug | 2 | PATCH 无字段白名单、并发写竞态 |
| 🟡 中等 Bug | 3 | 空白评论、观看时长为0、踢出后连麦审批异常 |
| 🟢 轻微 Bug | 2 | viewerId 错误记录、normalizeStore 重复计算 |
| 🔒 安全建议 | 3 | 无认证、默认密钥、缺少安全头 |
| 🏗️ 架构建议 | 4 | mutate 模式未统一、store 隔离、乐观更新冲突、缺少错误边界 |
| 💪 健壮性建议 | 5 | 死代码、统计不严谨、未使用 prop、硬编码 |

**整体评价**: 代码结构清晰，服务层/API 层/组件层职责分明。Repository 边界已经预留好为 Prisma 迁移做准备。MVP 阶段的核心 Bug 集中在数据安全（PATCH 越权）和统计准确性（观看时长、viewerId）上。建议优先修复 B1 和 B4，然后推进 Prisma + 认证的下一阶段开发。
