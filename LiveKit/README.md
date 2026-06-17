# WeChat Private Live MVP

私域直播 MVP：移动端主播走动讲解产品，观众从微信 H5 链接或二维码进入，场控在后台审核互动、查看分享归因、发言统计和客户跟进。

## Local Development

```bash
npm install
npm run dev
```

默认访问：

- Admin: `http://127.0.0.1:3000/admin`
- Host: `http://127.0.0.1:3000/host`
- Audience: `http://127.0.0.1:3000/live/demo-live`

当前本地预览模式使用 `.data/app-store.json` 保存数据。

## Docker With PostgreSQL

复制环境变量：

```bash
cp .env.example .env
```

至少修改：

```bash
AUTH_SECRET="replace-with-a-real-secret"
AUTH_URL="https://your-domain.example"
POSTGRES_PASSWORD="replace-with-a-strong-password"
```

启动：

```bash
docker compose up -d --build
```

容器启动时会自动执行：

```bash
prisma migrate deploy
```

这会把 `prisma/migrations` 中的表结构迁移到 PostgreSQL。

## Data Storage Status

PostgreSQL schema and migrations are ready for deployment. Runtime data is still routed through `JsonStoreRepository` and persisted in the `app-data` Docker volume at `/app/.data`.

The next implementation step is replacing the JSON repository with a Prisma-backed repository behind the existing `StoreRepository` boundary.

## Verification

```bash
npm run test
npm run lint
npm run build
DATABASE_URL="postgresql://user:pass@localhost:5432/db" npm run prisma:validate
```
