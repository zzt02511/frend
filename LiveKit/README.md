# 微信私域直播 MVP

面向微信公众号私域运营的直播系统。后台人员登录后可创建、编辑和管理直播；直播间可设置访问密码；观众通过微信 H5 链接进入并完成公众号授权；主播和观众使用 LiveKit 进行直播与连麦。

## 当前功能

- `/admin`：后台登录、直播间管理、留言审核、连麦管理、在线用户、分享归因和客户线索。
- `/host`：移动主播开播、设备控制、留言和连麦处理。
- `/live/[id]`：微信观众页、公众号 OAuth、密码房验证、互动与连麦。
- 管理端角色：`super_admin`、`director`、`moderator` 可新建和修改直播；主播操作需要 `host` 或更高权限。
- 房间密码使用 AES-256-GCM 加密保存；公开接口仅返回 `hasAccessPassword`，后台管理接口经鉴权后才解密展示。
- PostgreSQL 模式在应用启动时加载数据库，连接失败会终止启动，不会静默回退 JSON。

## 本地开发

要求 Node.js 22.12 或更高版本。

```bash
npm ci
npm run prisma:generate
npm run dev
```

本地默认不设置 `DATABASE_STORAGE`，数据保存在 `.data/app-store.json`。常用入口：

- 后台：`http://127.0.0.1:3000/admin`
- 主播：`http://127.0.0.1:3000/host`
- 观众：`http://127.0.0.1:3000/live/demo-live`

演示账号仅用于本地开发：`admin-1/admin123`、`director-1/director123`、`host-1/host123`、`moderator-1/mod123`。生产部署后必须修改密码。

## 生产环境变量

从 `.env.example` 创建 `.env`。以下变量不可使用示例值：

```dotenv
DATABASE_STORAGE=true
DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/wechat_private_live
AUTH_SECRET=<至少 32 字节的随机值>
AUTH_URL=https://live.example.com
ROOM_PASSWORD_ENCRYPTION_KEY=<32 字节随机值的 Base64>
LIVEKIT_API_KEY=<真实密钥>
LIVEKIT_API_SECRET=<足够长的真实密钥>
LIVEKIT_URL=wss://live.example.com
WECHAT_OAUTH_APP_ID=<公众号 AppID>
WECHAT_OAUTH_APP_SECRET=<公众号 AppSecret>
```

生成房间密码密钥：

```bash
openssl rand -base64 32
```

`ROOM_PASSWORD_ENCRYPTION_KEY` 丢失后，已有密码房无法解密；轮换密钥前必须先安排数据重加密。

## PostgreSQL 迁移与启动

首次启用或每次升级都必须先执行迁移，再启动应用：

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:deploy
docker compose up -d --build
```

当前生产模式在 `DATABASE_STORAGE=true`（兼容旧值 `enabled`）时以 PostgreSQL 为唯一持久化来源。`.data/app-store.json` 只用于本地开发和迁移前备份，生产数据库为空时不会自动用演示 JSON 填充。

上线前应先备份 PostgreSQL。数据库迁移回滚采用“恢复数据库备份 + 切回上一版应用镜像”，不要手工删除迁移记录。应用入口会在镜像包含 Prisma CLI 时尝试执行迁移；部署流程仍必须显式执行 `npm run prisma:deploy` 并检查退出码。

## 密码房访问流程

1. 后台创建或编辑直播时提交密码，服务端加密后写入数据库。
2. 观众提交密码到 `/api/live-sessions/[id]/room-access`。
3. 验证成功后服务端签发绑定 `liveId + viewerId + passwordVersion` 的 HttpOnly Cookie，有效期 2 小时。
4. 加入直播、心跳、留言、点赞、申请/结束连麦和 LiveKit 观众令牌均校验该 Cookie。
5. 后台修改或清除密码会递增 `passwordVersion`，旧 Cookie 自动失效。

## 验证

提交前依次执行：

```bash
npm run test
npm run lint
npm run build
npm run prisma:validate
```

生产发布后至少检查 `/admin`、`/host`、一个无密码直播间、一个密码直播间、微信公众号 OAuth 回跳和 PostgreSQL 数据是否在容器重启后保留。

## 已知架构边界

当前领域服务仍使用单进程内存快照，保存时由 Prisma 在事务中同步快照。它适合当前单实例 MVP，但不适合多实例并发写入。扩容前必须把服务层改为请求级异步 Prisma 查询与增量写入，并增加数据库约束和并发测试。

详细设计和执行记录见：

- `docs/superpowers/specs/2026-07-23-auth-room-password-postgres-closure-design.md`
- `docs/superpowers/plans/2026-07-23-auth-room-password-postgres-closure.md`
- `docs/SAAS-TENANT-ACCOUNT-MANAGEMENT.md`：SaaS 租户、账号层级、数据隔离与迁移说明。
# 修改观众播放、苹果/安卓分流、腾讯云证书、LiveKit 连麦或部署流程前，必须先阅读 `docs/PLAYBACK-ROUTING-AND-DEPLOYMENT.md`。
