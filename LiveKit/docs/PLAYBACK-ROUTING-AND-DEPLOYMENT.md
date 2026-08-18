# 直播播放、连麦、证书与部署基线（V1.02）

## 多直播间独立腾讯流（2026-08-18）

- 每个直播间必须持久化唯一 `tencentStreamName`；新建房间默认使用房间 ID（例如 `live-abcd1234`）。
- 播放地址固定由该流名称组成：`webrtc://play.fuguilong.cn/live/<tencentStreamName>`；Apple 客户端仍派生为同流名称的 HTTPS HLS 地址。
- 服务器仅保存推流域名的鉴权 Key `TENCENT_RTMP_PUSH_KEY`。开播时按腾讯官方规则 `MD5(Key + StreamName + txTime)` 动态签发短期 RTMP 地址。
- 禁止再配置或复用全局 `TENCENT_RTMP_PUSH_URL`；多个房间共用完整推流地址会互相覆盖。

本文是修改直播播放链路前的必读文档，用于避免把观众主画面误切到自建 LiveKit、误用苹果兼容性较差的 WebRTC 播放，或因证书问题造成 iPhone 黑屏。

## 1. V1.02 最终架构

| 场景 | 通道 | 播放地址/房间 | 说明 |
| --- | --- | --- | --- |
| 苹果手机观看主播主画面 | 腾讯云直播 HLS | `https://play.fuguilong.cn/live/IHQDAT.m3u8` | iPhone/iPad/iPod 从 `webrtc://` 地址派生 `.m3u8` |
| 安卓及其他非 Apple 设备观看主播主画面 | 腾讯云直播 WebRTC | `webrtc://play.fuguilong.cn/live/IHQDAT` | 由 TCPlayer 播放，保持低延迟 |
| 主播推流及所有观众连麦 | 自建 LiveKit | 应用签发对应房间的 LiveKit 令牌 | LiveKit 承担主播/连麦实时轨道，不作为普通观众主画面分发通道 |
| Web 管理与观众页面 | Next.js 应用 | `https://live.fuguilong.cn` | Caddy 反向代理到 `127.0.0.1:3001` |

容量原则：普通观众主画面必须走腾讯云，避免自建服务器的 LiveKit 下行通道被大量观看占用；LiveKit 容量优先留给主播实时发布和观众连麦。

## 2. 代码分流位置

### `src/components/livekit-audience-player.tsx`

- 只要直播间存在 `cdnPlayUrl`，主画面就渲染 `TencentCloudLivePlayer`。
- LiveKit 房间仍保持连接，用于观众申请连麦、本地摄像头预览以及订阅其他连麦者。
- 腾讯主画面模式下，主播的 LiveKit 视频轨道不得重复附加到主视频。
- 已连麦观众的本地预览必须始终显示，不能因为出现其他远端连麦者而隐藏。

### `src/components/tencent-cloud-live-player.tsx`

- TCPlayer 不能只初始化一次：监听 `playing` 与 `error`；收到播放错误后重新设置当前直播间播放 URL 并调用 `play()`。
- 首次初始化后 5 秒仍未收到 `playing` 时触发一次恢复，播放错误后按 4 秒间隔自动恢复；页面同时保留“点击恢复”入口处理微信 WebView 自动播放受限。
- “主播端有画面、腾讯云控制台有画面、HLS 清单持续产生新分片”同时成立时，应优先排查观众端播放器初始化/自动播放，不要改动 LiveKit 或切换播放架构。
- 直播结束会调用 StopEgress，此后 HLS 可能为空响应；必须先确认直播间仍为 `live`，再用 HLS 响应判断黑屏原因。
- 从 `ended` 再次开播时，主播端必须先确保设备已连接并发布 LiveKit 轨道，再调用 `/egress/start`；不能只把数据库状态改成 `live`。开播按钮在设备未连接时应自动完成设备连接，然后等待 Egress 真正成功。
- “已开播，腾讯云转推已启动”只能在 `/egress/start` 返回成功后显示。服务端用 `[egress/start] requested|active|failed` 日志记录结果，但不得记录完整 RTMP 地址或鉴权 Key。

- Apple UA：把 `webrtc://play.fuguilong.cn/live/IHQDAT` 转换为 `https://play.fuguilong.cn/live/IHQDAT.m3u8`。
- 非 Apple UA：保留原始 `webrtc://` 地址。
- TCPlayer 容器必须是 `<video>`，保留 `playsinline`、`webkit-playsinline`、播放器 SDK CSS 和隐藏原生控制层的样式。

### `src/components/audience-room.tsx`

- 页面保持 `overflow-x-hidden`。
- 底部操作栏使用可收缩列，避免 iPhone 页面发生横向溢出。

禁止事项：

1. 不要按 iOS 版本把“新 iPhone”切回腾讯 WebRTC；部分 iOS 微信 WebView 会黑屏。
2. 不要把 Apple 主画面切回 LiveKit 后忘记恢复，这会占用自建服务器通道。
3. 不要直接把 `webrtc://` 写入原生 `<video src>`；必须通过 TCPlayer。
4. 不要在 `play.fuguilong.cn` 证书失效时强行上线 HLS。

## 3. 腾讯云证书与域名

播放域名是 `play.fuguilong.cn`，注意不是 `pay.fuguilong.cn`。

腾讯云控制台路径：

`云直播 → 域名管理 → play.fuguilong.cn → 高级配置 → HTTPS 配置`

V1.02 发布前确认结果：

- HTTPS 已开启。
- 证书主题和 SAN 均包含 `play.fuguilong.cn`。
- 签发机构：TrustAsia。
- 有效期：2026-08-08 至 2026-11-06。
- 公网 SSL 校验结果为 0（通过）。

证书检查命令：

```bash
echo | openssl s_client -connect play.fuguilong.cn:443 -servername play.fuguilong.cn 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
curl -sS -o /dev/null -w 'hls:%{http_code} ssl:%{ssl_verify_result}\n' \
  https://play.fuguilong.cn/live/IHQDAT.m3u8
```

没有推流时 HLS 可能返回空响应或非 200；判断证书是否正确应以域名匹配以及 `ssl_verify_result=0` 为准。测试实际画面必须在腾讯云对应 StreamName 正在推流时进行。

`live.fuguilong.cn` 使用服务器 Caddy 自动维护的 Let's Encrypt 证书，与腾讯播放域名证书不是同一张。

## 4. 连麦画面与人数规则

- 主播端、观众端的连麦身份以 LiveKit participant identity 区分。
- 观众自己发布的摄像头是本地轨道，不会作为远端轨道回传给自己；观众端总画面数应按“自己的本地预览 + 其他远端连麦者”渲染。
- 本地预览和远端连麦 tile 位于同一横向容器，本地预览不得因远端 tile 出现而隐藏。
- 主播身份必须通过精确的 `hostIdentity` 判断，不能把连麦观众误认为主播主画面。
- 所有观众连麦（苹果和安卓）都通过自建 LiveKit，不通过腾讯云 HLS/WebRTC 播放地址发布。

## 5. 录播当前边界

- 后台直播间编辑支持“录播启用/关闭”。
- 关闭时，结束直播不生成 replay 元数据。
- 开启时，结束直播生成 replay 元数据，管理端提供“下载录播”入口；文件尚不可用时显示“录播处理中”。
- 当前仓库没有部署 LiveKit Egress 或腾讯云录制回调下载器。要获得真实 MP4 文件，必须接入腾讯云直播录制模板与回调/COS 文件地址，或部署 LiveKit Egress，并将真实文件 URL 写入 replay 记录。不要把 replay 元数据接口误认为真实视频文件。

## 6. 必跑验证

修改相关代码后至少运行：

```bash
npm run test
npm run lint
npm run build
node scripts/fix-standalone-prisma-alias.mjs
```

关键回归断言：

- iPhone 15.x UA → TCPlayer HLS `.m3u8`。
- iPhone 18.x UA → TCPlayer HLS `.m3u8`。
- Android/非 Apple UA → TCPlayer `webrtc://`。
- 腾讯云主画面模式下，LiveKit 主播轨道不附加到主视频。
- 连麦观众本地预览与远端连麦 tile 同时存在。
- 服务端渲染不得直接读取 `window`。

## 7. 生产部署基线

服务器：`218.78.135.21`

- 发布目录：`/opt/wechat-live/releases/<release-name>`
- 应用端口：`127.0.0.1:3001`
- Compose 项目：`current`
- 应用镜像：`current-app:latest`
- 生产数据库：PostgreSQL（`DATABASE_STORAGE=true`）

部署原则：

1. 在本地完成 Next.js standalone 构建，不在小规格服务器运行 Next.js 编译。
2. 打包必须包含 `Dockerfile`、`docker-compose.yml`、`docker/entrypoint.sh`、`.next/standalone`、`.next/static`、`public`、`prisma`、`scripts` 和 `src`。
3. 新建独立 release 目录并复制当前 `.env`，不要覆盖数据库卷。
4. 构建应用时使用 `RUNTIME_BASE=node:22-alpine docker compose -p current build app`，避免生产 `.env` 中 `RUNTIME_BASE=current-app:latest` 导致循环构建或 Prisma 别名冲突。
5. 只执行 `docker compose -p current up -d --no-deps --no-build app`，不要重建 PostgreSQL 或 LiveKit。
6. 检查容器 healthy、Next ready、服务器本地与公网直播页 HTTP 200。

回滚时使用上一版 release 对应的应用镜像重新启动 app；不要删除 PostgreSQL 数据卷，不要对数据库执行破坏性回滚。

## 8. V1.02 验收结论

- 苹果主画面固定走腾讯云 HLS。
- 安卓主画面固定走腾讯云 WebRTC。
- 所有连麦固定走自建 LiveKit。
- 腾讯播放域名 HTTPS 证书已验证匹配。
- 观众本地连麦预览不再被其他连麦画面替换。
- 管理端支持录播开关、录播入口，并将直播间操作按钮固定为同一行。
