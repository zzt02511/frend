# HeyGem / Duix.Avatar 接入方案

当前决定：数字人视频生成优先走 HeyGem，也就是现在上游的 Duix.Avatar，而不是继续依赖仓库里缺失的 `tuilionnx/` 旧链路。

## 为什么选 HeyGem

- 与本项目目标一致：真实人像/数字人口播视频。
- 支持本地离线视频合成。
- 上游已经开源，项目名演进为 Duix.Avatar。
- 能和当前 MVP 的输出自然衔接：`rewritten_script` / `xiaohongshu_note` 可作为口播文本，真实素材可作为封面/背景/剪辑素材。

## 上游来源

- Duix.Avatar / HeyGem 仓库：https://github.com/duixcom/Duix.Heygem
- Duix.Avatar releases：https://github.com/duixcom/Duix.Heygem/releases
- Duix API 文档：https://docs.duix.com/

上游说明里提到：

- HeyGem 原项目已更名为 Duix.Avatar。
- 本地部署依赖 Docker。
- 主要 Docker 镜像包括：
  - `guiji2025/fun-asr`
  - `guiji2025/fish-speech-ziming`
  - `guiji2025/duix.avatar`
- 视频生成服务常见端口：`8383`
- 语音/模型服务常见端口：`18180`
- 视频生成常见接口：`POST http://127.0.0.1:8383/easy/submit`

## 本项目对接目标

当前 MVP 已经能生成：

- `script`
- `rewritten_script`
- `xiaohongshu_note`
- `xiaohongshu_video_plan`
- 上传/登记的真实图片或视频素材

HeyGem 对接后，目标流程变成：

1. 在工作台生成定制家居内容。
2. 选择一条脚本，优先使用 `rewritten_script` 作为数字人口播。
3. 选择 HeyGem 已训练/创建好的数字人模型。
4. 选择声音来源：
   - HeyGem/Duix 里已有声音模型
   - 或上传录好的音频
   - 或后续接 CosyVoice/TTS
5. 调用 HeyGem/Duix 本地 API 生成数字人口播视频。
6. 再把生成的视频与真实素材、小红书封面/标题/图文方案组合成发布包。

## 安装前检查

运行：

```bat
cd /d D:\AI\KrLongAI-master
D:\Python312\python.exe heygem_runtime_audit.py
```

它会检查：

- Docker 是否存在
- Node.js 是否存在
- `8383` 视频生成服务是否监听
- `18180` 语音/模型服务是否监听
- 常见数据目录是否存在
- 三个 Docker 镜像是否已拉取

## 推荐安装方式

先按上游文档安装 Duix.Avatar，而不是把它直接混进当前项目目录。

建议目录：

```text
D:\Duix.Avatar
D:\heygem_data
```

原因：

- Duix/HeyGem 对磁盘空间要求较高。
- 上游默认常使用 D 盘保存数据。
- 与当前 `KrLongAI-master` 解耦，后续升级 Duix 不会污染本项目。

## 安装完成后的接入点

确认以下服务能访问：

```text
http://127.0.0.1:8383
http://127.0.0.1:18180
```

然后再做本项目适配：

- 当前已新增 `cloud_runtime_client.py`。
- 当前已在 `custom_home_server.py` 增加 `/api/cloud/heygem/submit`。
- 当前已在 `custom_home_agent.html` 的内容卡片增加“提交 HeyGem 数字人”按钮。
- 工作台左侧可以配置云主机 HeyGem/Duix 地址、TTS 地址、数字人 ID、声音 ID 和可选 API Key。

## 注意事项

- HeyGem/Duix 的本地 API payload 会随版本变化，必须以你最终安装版本的接口为准。
- 不建议创建假的 `tuilionnx/`、`video_tools/generate_video.py` 来冒充旧链路。
- 如果你安装的是 Duix 官方客户端，先确认客户端能正常生成视频，再接入 API。
- 平台发布仍建议先人工发布，小红书/抖音自动发布后续再接 `social-auto-upload`。

## 与当前 MVP 字段映射

| 当前字段 | HeyGem/Duix 用途 |
| --- | --- |
| `rewritten_script` | 数字人口播文本 |
| `script` | 原始口播脚本备选 |
| `titles[0]` | 视频标题/任务名 |
| `cover` | 封面大字 |
| `xiaohongshu_video_plan` | 后续剪辑真实素材的镜头清单 |
| `custom_home_materials/` | 小红书视频/图文真实素材库 |

## 下一步

1. 安装 Duix.Avatar / HeyGem。
2. 运行 `heygem_runtime_audit.py`。
3. 如果 `8383` 和 `18180` 都通过，在本地工作台保存云端配置。
4. 在内容卡片里点击“提交 HeyGem 数字人”。
5. 根据你实际安装版本返回的任务 ID/视频 URL，继续完善结果轮询和下载。
