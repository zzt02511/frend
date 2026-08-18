# 直播播放、连麦、证书与部署基线（V1.02，2026-08-18 更新）

## 多直播间独立腾讯流（2026-08-18）

- 每个直播间必须持久化唯一 `tencentStreamName`；新建房间默认使用房间 ID（例如 `live-abcd1234`）。
- 播放地址固定由该流名称组成：`webrtc://play.fuguilong.cn/live/<tencentStreamName>`；Apple 客户端仍派生为同流名称的 HTTPS HLS 地址。
- 服务器仅保存推流域名的鉴权 Key `TENCENT_RTMP_PUSH_KEY`。开播时按腾讯官方规则 `MD5(Key + StreamName + txTime)` 动态签发短期 RTMP 地址。
- 禁止再配置或复用全局 `TENCENT_RTMP_PUSH_URL`；多个房间共用完整推流地址会互相覆盖。

本文是修改直播播放链路前的必读文档，用于避免把观众主画面误切到自建 LiveKit、误用苹果兼容性较差的 WebRTC 播放，或因证书问题造成 iPhone 黑屏。

## 1. V1.02 最终架构

| 场景 | 通道 | 播放地址/房间 | 说明 |
| --- | --- | --- | --- |
| 苹果手机观看主播主画面 | 腾讯云直播 HLS | `https://play.fuguilong.cn/live/<tencentStreamName>.m3u8` | iPhone/iPad/iPod 从当前直播间的 `webrtc://` 地址派生 `.m3u8` |
| 安卓及其他非 Apple 设备观看主播主画面 | 腾讯云直播 WebRTC | `webrtc://play.fuguilong.cn/live/<tencentStreamName>` | 由 TCPlayer 播放，保持低延迟 |
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

- Android/非 Apple 的腾讯 WebRTC 使用 TCPlayer：监听 `playing` 与 `error`；收到播放错误后重新设置当前直播间播放 URL 并调用 `play()`。
- 上述自动重设 `src` 只允许用于 Android/非 Apple 的腾讯 WebRTC。苹果 HLS 首次缓冲可能超过 5 秒，禁止 watchdog 在缓冲期间反复重设 HLS 地址。
- Apple HLS 使用页面中的原生 `<video>`，不创建 TCPlayer。iOS 自动播放受限时显示“点击恢复”，并在用户点击事件中直接调用该原生视频元素的 `play()`；不得在点击时重建播放器或替换 `src`，否则会丢失 iOS 的用户手势播放权限。
- Android TCPlayer 首次初始化后 5 秒仍未收到 `playing` 时触发恢复，播放错误后按 4 秒间隔自动恢复；Apple HLS 等待 12 秒后只提示用户点击恢复，不自动重置 HLS。
- “主播端有画面、腾讯云控制台有画面、HLS 清单持续产生新分片”同时成立时，应优先排查观众端播放器初始化/自动播放，不要改动 LiveKit 或切换播放架构。
- 直播结束会调用 StopEgress，此后 HLS 可能为空响应；必须先确认直播间仍为 `live`，再用 HLS 响应判断黑屏原因。
- 从 `ended` 再次开播时，主播端必须先确保设备已连接并发布 LiveKit 轨道，再调用 `/egress/start`；不能只把数据库状态改成 `live`。开播按钮在设备未连接时应自动完成设备连接，然后等待 Egress 真正成功。
- “已开播，腾讯云转推已启动”只能在 `/egress/start` 返回成功后显示。服务端用 `[egress/start] requested|active|failed` 日志记录结果，但不得记录完整 RTMP 地址或鉴权 Key。

- Apple UA：把当前直播间的 `webrtc://play.fuguilong.cn/live/<tencentStreamName>` 转换为 `https://play.fuguilong.cn/live/<tencentStreamName>.m3u8`。
- Apple HLS 直接交给 iOS 原生 `<video>` 播放，不等待 TCPlayer SDK 下载；Android/非 Apple 的 `webrtc://` 仍使用 TCPlayer。此优化只减少客户端初始化时间，不改变 Apple HLS 架构。
- 非 Apple UA：保留原始 `webrtc://` 地址。
- Apple 原生 HLS 与 Android TCPlayer 的源容器都必须是 `<video>`，保留 `muted`、`autoplay`、`preload="auto"`、`playsinline` 和 `webkit-playsinline`；Android 还必须加载播放器 SDK CSS 并隐藏原生控制层。
- TCPlayer 5 会把源 `<video>` 替换成 Video.js 包装层；百分比尺寸可能被 SDK 生成成 `100px × 100px`。`.tencent-player-shell` 必须用 `!important` 将 `.video-js` 和 `.vjs-tech` 固定为父容器的 `100% × 100%`，视频使用 `object-fit: cover`，否则画面会缩在左上角。
- Android 使用 TCPlayer 5.0.0 及以上时必须配置 Web License URL；缺少时会在媒体加载前报 `Error Code 55 / LICENSE_ERR / Lack license url`，此时重试播放无效。Apple 原生 HLS 不依赖 TCPlayer License。
- License 在“腾讯云视立方控制台 → License 管理 → Web 端 License → 播放器”申请。基础版可免费申请，精准域名应绑定播放器页面域名 `live.fuguilong.cn`。
- 配置名为 `NEXT_PUBLIC_TENCENT_PLAYER_LICENSE_URL`，属于 Next.js 构建期变量，修改后必须重新执行生产构建和部署。
- 在 License 尚未配置时，代码使用腾讯仍维护的 TCPlayer 4.5.1，并按官方接入说明先加载 `TXLivePlayer-1.2.0` 和 HLS 依赖；获得 License URL 后自动使用 TCPlayer 5.3.4。
- LiveKit Egress 转推使用 2 秒关键帧间隔（GOP）；不得恢复为流式编码默认 4 秒。腾讯云 HLS 延迟配置建议选择“低”（2 秒 × 3 片），对应预计延迟约 6–8 秒；更低延迟需评估 LL-HLS 的费用、HTTP/2 和兼容性后单独上线。

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
  https://play.fuguilong.cn/live/certificate-check.m3u8
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

- iPhone 15.x UA → 原生 `<video>` HLS `.m3u8`，且不创建 TCPlayer。
- iPhone 18.x UA → 原生 `<video>` HLS `.m3u8`，且不创建 TCPlayer。
- Android/非 Apple UA → TCPlayer `webrtc://`。
- Egress 高级编码参数 → H.264 720p/30fps、`keyFrameInterval=2`。
- 任意两个直播间 → `tencentStreamName`、RTMP 推流路径和 `cdnPlayUrl` 均不相同，包括不同租户和同租户多个直播间。
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

## 9. 2026-08-18 苹果黑屏与首屏慢复盘（以后修改前必读）

### 9.1 最终要求适用于所有租户和所有直播间

这不是 `demo-live`、`ljmy` 或默认租户的特殊逻辑。播放器组件和 Egress 参数是全局实现，每个租户、每个直播间都必须满足：

| 客户端/用途 | 固定链路 | 每个直播间的隔离字段 |
| --- | --- | --- |
| Apple 主画面 | 腾讯云原生 HLS | `https://play.fuguilong.cn/live/<tencentStreamName>.m3u8` |
| Android/非 Apple 主画面 | 腾讯云 TCPlayer WebRTC | `webrtc://play.fuguilong.cn/live/<tencentStreamName>` |
| 主播发布和所有观众连麦 | 自建 LiveKit | `roomName` 与 participant identity |
| 腾讯云转推 | LiveKit Egress → 腾讯云 RTMP | `rtmp://push.fuguilong.cn/live/<tencentStreamName>?签名` |

创建直播间时必须持久化唯一 `roomName` 和 `tencentStreamName`。任何地方都不得回退为全局固定流名 `IHQDAT`，否则不同租户或不同直播间会互相覆盖、串画面。

### 9.2 这次实际碰到的坑

1. **Apple 不能稳定使用腾讯 WebRTC。** 部分 iOS 微信 WebView 会黑屏，所以不能因追求低延迟把苹果切回 `webrtc://`。
2. **Apple 主画面不能回退到 LiveKit。** 这样会把普通观看流量压到自建服务器，LiveKit 通道必须优先留给主播和连麦。
3. **HLS 慢不一定是播放器故障。** 标准 HLS 需要等待多个完整分片；腾讯官方低延迟档在 GOP=2 秒时预计仍为 6–8 秒，不可能按 Android WebRTC 的 2–3 秒标准验收。
4. **Egress 流式编码默认 GOP 为 4 秒。** 腾讯云单个 HLS 分片至少包含一个 GOP，4 秒 GOP 会直接放大首屏等待，因此代码必须显式使用 `keyFrameInterval=2`。
5. **TCPlayer SDK 会增加 Apple 首次初始化步骤。** iOS 原生支持 HLS，Apple 应直接给原生 `<video>` 设置 `.m3u8`，不必先下载 TCPlayer JS/CSS；Android WebRTC 仍必须使用 TCPlayer。
6. **错误 watchdog 曾经造成反复黑屏。** Apple HLS 缓冲超过 5 秒时反复执行 `player.src(url)` 会清空已经下载的分片，导致永远无法进入 `playing`。Apple 只能等待或由用户点击后直接 `video.play()`。
7. **点击恢复必须保留用户手势。** 点击处理函数中若重建播放器、切换 React key 或异步替换 `src`，iOS 会失去这次用户手势授权，`play()` 仍会被拦截。
8. **首次 `play()` 太早时，分片就绪后不一定自动再播。** 2026-08-18 真机表现为等待 5–6 秒后点击“恢复”立即出画面，证明 HLS 已就绪但 iOS 微信没有自动重试。原生 `<video>` 必须在 HTML 初始就带 `autoplay` 和 `muted`，并在 `loadedmetadata`、`canplay`、`WeixinJSBridgeReady` 时对同一元素再次调用 `play()`。
9. **加载期间不应诱导用户点击恢复。** 正常缓冲只显示“画面加载中…”，隐藏恢复按钮；只有自动播放持续被系统拦截或发生播放错误时才显示“点击恢复”兜底。
10. **新 GOP 只对新 Egress 生效。** 应用部署时不会重启正在运行的 Egress 任务；正在直播的旧任务仍使用旧参数。必须正常结束直播后重新开播，再测试 2 秒 GOP。
11. **直播结束后不能用 HLS 空响应判断故障。** StopEgress 后腾讯云停止产生分片，`.m3u8` 超时或非 200 属正常现象；检查前先确认直播间状态和 Egress 是否 active。
12. **播放器尺寸和 License 是另外两类故障。** 画面缩在左上角是 TCPlayer 生成层尺寸问题；`Error Code 55` 是 Web License 问题；两者都不能通过切换播放架构解决。

### 9.3 本次实测证据

2026-08-18 优化前，正在直播的 `live-ii8kvkt` HLS 清单返回：

```text
#EXT-X-TARGETDURATION:8
#EXTINF:7.639
#EXTINF:3.483
#EXTINF:1.3
```

三个可见分片合计 `12.422` 秒，与用户反馈“苹果进入要 10 秒以上”一致。由此确认主要瓶颈是旧 Egress GOP/HLS 分片，而不是租户路由、证书或 LiveKit 订阅。

### 9.4 已落地的最终修复

- `src/components/tencent-cloud-live-player.tsx`
  - Apple UA 从每个房间的 `webrtc://` 地址派生对应 `.m3u8`。
  - Apple 使用原生 `<video>` 立即 `load()`/`play()`，不加载、不创建 TCPlayer。
  - 原生视频初始包含 `autoplay`、`muted`、`preload="auto"`、`playsinline`；在 `loadedmetadata`、`canplay` 和 `WeixinJSBridgeReady` 时自动重试同一元素的 `play()`。
  - 正常缓冲只显示“画面加载中…”，不显示恢复按钮。
  - Apple HLS 错误或 12 秒未播放时只显示恢复入口，不自动重设 `src`。
  - 用户点击恢复时直接调用同一个原生视频元素 `play()`。
  - Android/非 Apple 继续使用 TCPlayer WebRTC，并保留自动重连。
- `src/lib/tencent-egress.ts`
  - 保持 H.264 720p、30fps、3000kbps。
  - 显式设置 `keyFrameInterval=2`，不要恢复为默认 4 秒。
- 腾讯云控制台
  - HLS 延迟配置应选择“低”（2 秒 × 3 片）。该设置属于腾讯云域名配置，不在应用服务器环境变量中。
  - 若未来要求稳定低于 6 秒，需要单独评估 LL-HLS；它会产生额外封装费用，并要求 iOS/Safari 链路开启 HTTP/2，不能直接替换现有地址后上线。

### 9.5 每次上线后的验收顺序

1. 选择至少两个不同租户，并各选择一个直播间；再选择同一租户的两个直播间做唯一性检查。
2. 确认这些直播间的 `roomName`、`tencentStreamName` 和 `cdnPlayUrl` 均不同。
3. 主播开启设备并开播，等待 `/egress/start` 返回 active；不要只看数据库 `status=live`。
4. 用 Android 微信进入：确认主画面走本房间 `webrtc://`，能低延迟播放。
5. 用新、旧两个 iOS 版本的微信进入：确认主画面走本房间 `.m3u8`，先显示“画面加载中…”，媒体就绪后自动出画面；正常加载阶段不显示恢复按钮，不调用 TCPlayer，也不自动重置 HLS。
6. 抓取正在直播的 `.m3u8`，检查 `#EXTINF`。新 Egress 的分片应围绕 2 秒 GOP 产生；若仍长期出现 4 秒以上分片，检查腾讯云 HLS 延迟档位和 Egress 是否确实为部署后新建。
7. 分别测试 Apple/Android 申请连麦，确认连麦仍进入对应 `roomName` 的 LiveKit，不影响腾讯云主画面。
8. 结束直播后确认 Egress complete、录播 MP4 可下载；不要再用已结束流的 HLS 响应做播放验收。

### 9.6 延迟验收口径

- Android 腾讯 WebRTC：目标约 2–3 秒，网络波动时允许短暂重连。
- Apple 标准 HLS 低延迟档：目标约 6–8 秒；首次进入偶发更慢时先检查分片和网络，不要切换架构。
- Apple 若持续超过 10 秒：依次检查当前 Egress 是否为新任务、`keyFrameInterval=2`、HLS 是否为低延迟档、清单分片总时长、播放器是否错误重置 `src`。
- 需要稳定低于 6 秒：作为 LL-HLS 独立需求评估成本、HTTP/2、域名配置和多版本 iOS 微信兼容性。

### 9.7 2026-08-18 Android 偶发黑屏后自动恢复

**现象：** Android 微信观看腾讯 WebRTC 时偶尔短暂黑屏，稍后播放器自行恢复。

**本次服务器证据：** Egress `EG_Rs37sximxsyF` 在 13:46:51–13:47:21 期间连续出现以下错误并自动重连：

```text
Connection error: Socket I/O timed out
Failed to connect: Error resolving “push.fuguilong.cn”: Temporary failure in name resolution
resetting stream
```

这会造成“自建 LiveKit 主播画面仍正常，但腾讯云观众主画面短暂没有源”的窗口。Android TCPlayer 的自动恢复使画面稍后重新出现，因此该现象不能直接归因于 Android 手机或播放器路由。

排查与处理顺序：

1. 先查看当前 Egress ID 的日志；不要把不同场次的 Egress 错误混在一起。
2. 若同一时间出现 `rtmpconnection error`、`Socket I/O timed out`、`Temporary failure in name resolution` 或 `resetting stream`，优先判断为服务器到腾讯推流节点的上游波动。
3. 在宿主机和 `current-egress-1` 内分别重复解析 `push.fuguilong.cn`，并采样 TCP 1935 端口。一次解析成功不能排除间歇性 DNS 故障。
4. 不要因此把 Android 主画面改走 LiveKit 或 HLS；Android 仍固定使用腾讯 WebRTC，TCPlayer 保留自动重连。
5. 不要在直播中重启 Egress、LiveKit 或 Docker 网络；这会主动中断当前推流和录播。只有故障持续复现且直播已结束时，才评估给 Egress 增加显式备用 DNS 或进行网络维护。
6. 新建 Egress 后重新按 Egress ID 检查。本次后续任务 `EG_pnVnvbgFXKoU` 启动后未再出现上述 RTMP/DNS 错误，说明故障为间歇性上游连接波动，而非持续配置错误。
