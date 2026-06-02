# 内容生产流水线架构

目标不是堆一堆孤立工具，而是把开源软件组合成一条可交付的内容生产流水线：

```text
真实素材 + 门店案例
        ↓
行业化文案生成
        ↓
小红书图文 / 视频脚本 / 数字人口播稿
        ↓
TTS 或录音
        ↓
HeyGem / Duix.Avatar 数字人口播视频
        ↓
FFmpeg + ImageMagick 合成封面、字幕、素材混剪
        ↓
小红书发布包
        ↓
人工发布，后续再接 social-auto-upload
```

## 当前已完成

### 1. 行业化文案生成

文件：

- `custom_home_agent.py`
- `custom_home_agent.html`
- `custom_home_server.py`

能力：

- 非标定制家居案例输入
- 5 类内容栏目
- 口播脚本
- 标题/封面
- 私信引导
- 合规提示
- 小红书图文笔记
- 小红书视频素材搭配方案

### 2. 真实素材登记与上传

文件：

- `custom_home_agent.html`
- `custom_home_server.py`

目录：

```text
custom_home_materials/<项目名>/
```

用途：

- 保存实拍图片
- 保存实拍视频
- 让小红书图文/视频方案引用真实素材

### 3. 项目保存

目录：

```text
custom_home_projects/
```

用途：

- 保存案例字段
- 保存生成内容
- 保存改写稿
- 保存小红书图文

### 4. 流水线任务包导出

文件：

- `content_pipeline.py`

运行：

```bat
cd /d D:\AI\KrLongAI-master
D:\Python312\python.exe content_pipeline.py --case custom_home_case.sample.json
```

输出目录：

```text
content_pipeline_exports/<项目名>/
```

输出内容：

- `pipeline.json`：流水线阶段定义
- `case.json`：案例输入
- `rows.json`：全部内容条目
- `xiaohongshu_notes/*.md`：小红书图文笔记
- `scripts/*.txt`：数字人口播脚本
- `heygem_tasks/*.json`：HeyGem/Duix 数字人任务草稿
- `ffmpeg_tasks/*.json`：剪辑合成任务草稿
- `publish_manifest.json`：发布清单
- `materials/`：导出的真实素材

### 5. 本地调用云主机能力

文件：

- `cloud_runtime_client.py`
- `custom_home_server.py`
- `custom_home_agent.html`

新增接口：

```text
GET  /api/cloud/settings
POST /api/cloud/settings
GET  /api/cloud/health
POST /api/cloud/tts/submit
POST /api/cloud/heygem/submit
```

工作方式：

```text
本地浏览器工作台
        ↓
本地 custom_home_server.py
        ↓
云主机 HeyGem / Duix / TTS
```

也就是说，本地电脑仍然负责开发、写案例、整理素材、生成文案；云主机只负责语音和数字人视频生成。

推荐云端配置：

```text
HeyGem/Duix 地址：http://云主机IP:8383
TTS/语音地址：http://云主机IP:18180
```

开发期更安全的方式是 SSH 隧道：

```powershell
ssh -L 8383:127.0.0.1:8383 -L 18180:127.0.0.1:18180 root@云主机IP
```

然后本地工作台里填：

```text
HeyGem/Duix 地址：http://127.0.0.1:8383
TTS/语音地址：http://127.0.0.1:18180
```

## 开源工具分工

### HeyGem / Duix.Avatar

用途：

- 数字人口播视频
- 真人形象/口型同步
- 声音模型或上传音频驱动

当前状态：

- 已写接入说明：`HEYGEM_INTEGRATION.md`
- 已写运行时检查：`heygem_runtime_audit.py`
- 等 HeyGem/Duix 安装完成后再写真正 API adapter

本项目字段映射：

| 本项目字段 | HeyGem 用途 |
| --- | --- |
| `rewritten_script` | 口播文本 |
| `titles[0]` | 任务名/视频标题 |
| `custom_home_materials/` | 可作为背景/剪辑素材 |
| `heygem_tasks/*.json` | 后续 API 请求草稿 |

### FFmpeg

用途：

- 视频剪辑
- 素材拼接
- 音视频合成
- 转码
- 抽帧

期望路径：

```text
ffmpeg/bin/ffmpeg.exe
ffmpeg/bin/ffprobe.exe
```

接入点：

- `ffmpeg_tasks/*.json`
- 后续新增 `ffmpeg_pipeline.py`

### ImageMagick

用途：

- 封面图生成
- 标题大字渲染
- 图片格式转换

期望路径：

```text
ImageMagick-7.1.1-Q16-HDRI/magick.exe
```

接入点：

- 后续新增封面生成器
- 与 `cover` 字段、小红书封面字结合

### CosyVoice

用途：

- TTS
- 声音克隆
- 生成口播音频

当前判断：

- 原项目使用的是定制/编译过的 `cosyvoice/api.cp312-win_amd64.pyd`
- 开源上游是 `FunAudioLLM/CosyVoice`
- 若资源包无法恢复，需要写新的 CosyVoice adapter

### social-auto-upload

用途：

- 多平台自动发布
- 小红书/抖音/B站等上传

当前策略：

- 第一阶段不自动发布，先导出发布包人工发布。
- 等账号和内容流程稳定后，再接自动发布。

## 为什么先做任务包，而不是直接全自动

因为 HeyGem、CosyVoice、FFmpeg、ImageMagick 的安装状态和 API 版本都可能不同。任务包让每一段先有稳定的输入/输出契约：

- 文案生成先稳定
- 素材整理先稳定
- HeyGem 安装完成后只替换 `heygem_tasks` 执行器
- FFmpeg 可用后只替换 `ffmpeg_tasks` 执行器
- 发布稳定后再接自动发布

这样不会因为某个开源工具没装好，影响整条产品链路继续推进。

## 下一步开发顺序

1. 安装并启动 HeyGem / Duix.Avatar。
2. 运行 `heygem_runtime_audit.py`，确认 `8383` 和 `18180` 可用。
3. 新增 `heygem_client.py`，读取 `heygem_tasks/*.json` 并提交生成任务。
4. 安装 FFmpeg 和 ImageMagick。
5. 新增 `ffmpeg_pipeline.py`，读取 `ffmpeg_tasks/*.json` 生成成片。
6. 在 HTML 工作台里加入“导出流水线包”和“生成数字人视频”按钮。
7. 最后再接 `social-auto-upload`。
