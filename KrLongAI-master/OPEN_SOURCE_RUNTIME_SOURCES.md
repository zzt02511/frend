# 原始数字人链路开源依赖来源

本文档整理 `combined_launcher.py` / `app.py` 原始链路缺失资源的上游来源。当前可运行的定制家居 MVP 不依赖这些资源；这些资源用于恢复完整的数字人、语音、视频合成和多平台发布链路。

## 当前本地缺失状态

运行：

```bat
cd /d D:\AI\KrLongAI-master
D:\Python312\python.exe original_runtime_audit.py
```

当前检查结果为 `0/28` 项通过，说明原始数字人链路还没有可运行的外部运行时、源码模块和模型资源。

## 1. FFmpeg

用途：

- 视频合成
- 转码
- 抽帧
- 音视频信息探测

原项目期望路径：

```text
D:\AI\KrLongAI-master\ffmpeg\bin\ffmpeg.exe
D:\AI\KrLongAI-master\ffmpeg\bin\ffprobe.exe
```

上游来源：

- FFmpeg 官方下载页：https://www.ffmpeg.org/download.html
- FFmpeg 官网推荐的 Windows builds 之一，gyan.dev：https://www.gyan.dev/ffmpeg/builds/

建议：

- 下载 Windows essentials build 即可。
- 解压后把包含 `bin\ffmpeg.exe` 的目录整理成：

```text
D:\AI\KrLongAI-master\ffmpeg\bin\ffmpeg.exe
```

## 2. ImageMagick

用途：

- 封面图处理
- 图片合成
- 可能用于字幕/标题渲染辅助

原项目期望路径：

```text
D:\AI\KrLongAI-master\ImageMagick-7.1.1-Q16-HDRI\magick.exe
```

上游来源：

- ImageMagick 官方 Windows 下载页：https://imagemagick.org/script/download.php

建议：

- 下载 portable Q16-HDRI x64 版本。
- 当前官方页面显示的是新版 `ImageMagick-7.1.2-xx-portable-Q16-HDRI-x64.7z`，不一定刚好是项目原来的 `7.1.1`。
- 如果使用新版，为了兼容原启动脚本，可以把解压后的目录重命名为：

```text
ImageMagick-7.1.1-Q16-HDRI
```

或者修改一键启动脚本和 `combined_launcher.py` 中的路径。

## 3. Miniconda / avatar 环境

用途：

- 原始一键启动脚本会调用 `miniconda3\Scripts\activate.bat avatar`
- `combined_launcher.py` 及 Gradio 原链路依赖 PyTorch、OpenCV、Gradio、Playwright 等包

原项目期望路径：

```text
D:\AI\KrLongAI-master\miniconda3\Scripts\activate.bat
D:\AI\KrLongAI-master\miniconda3\envs\avatar\python.exe
```

上游来源：

- Miniconda 官方安装文档：https://www.anaconda.com/docs/getting-started/miniconda/install/overview

建议：

- 如果要完全兼容原批处理，安装或解压到项目内的 `miniconda3/`。
- 环境名需要是 `avatar`。
- 目前仓库没有 `environment.yml` 或 `requirements.txt`，所以依赖需要从源码导入错误中逐步补，或从完整资源包恢复。

## 4. CosyVoice

用途：

- 文本转语音
- 声音克隆/音色生成
- 原项目期望在 `http://localhost:9880` 提供 API

原项目期望路径：

```text
D:\AI\KrLongAI-master\cosyvoice\api.cp312-win_amd64.pyd
D:\AI\KrLongAI-master\cosyvoice\account.txt
D:\AI\KrLongAI-master\cosyvoice\启动接口.bat
```

上游来源：

- FunAudioLLM/CosyVoice：https://github.com/FunAudioLLM/CosyVoice

注意：

- 上游 CosyVoice 是完整开源项目，但本仓库原来使用的是一个被封装/编译过的 `api.cp312-win_amd64.pyd`。
- 直接 clone 上游 CosyVoice 不会自动得到这个 `.pyd` 和原项目的 `account.txt`。
- 如果要接入开源版 CosyVoice，建议新建适配层，而不是假装恢复原 `api.pyd`。

推荐路线：

1. 先从完整资源包恢复原 `cosyvoice/`，最快兼容现有代码。
2. 如果完整资源包不可用，再基于 FunAudioLLM/CosyVoice 重写本项目的 TTS 调用适配。

## 5. 数字人 / HeyGem / Duix

用途：

- 数字人驱动
- 口型同步
- 视频合成

本项目代码线索：

```text
video_tools.generate_video.generate_tuilionnx_video
tuilionnx/app.py
tuilionnx/run.py
tuilionnx/jm_onnx.py
tuilionnx/lstmsync_func.py
```

原项目可能期望路径：

```text
D:\AI\KrLongAI-master\tuilionnx\
```

相关开源来源：

- HeyGem / Duix Avatar releases：https://github.com/duixcom/Duix.Heygem/releases
- HeyGem 相关仓库线索：https://github.com/GuijiAI/HeyGem.ai

注意：

- HeyGem/Duix 是可用的开源数字人方向，但它和本项目提到的 `tuilionnx` 不一定是同一个接口结构。
- 本项目缺失的是 `video_tools/generate_video.py` 和 `tuilionnx/` 目录，直接放一个 HeyGem 仓库并不能保证 `generate_tuilionnx_video()` 可用。

推荐路线：

1. 优先恢复完整资源包里的 `video_tools/` 和 `tuilionnx/`。
2. 如果资源包不可用，再把 HeyGem/Duix 当成新的数字人后端接入，单独写适配器。

## 6. social-auto-upload

用途：

- 抖音
- 小红书
- 视频号
- Bilibili
- TikTok / YouTube 等平台上传

本项目代码线索：

```text
video_tools.publisher.auto_publishing_videos_XHS
video_tools.publisher.auto_publishing_videos_DY
video_tools.publisher.auto_publishing_videos_ALL
```

相关开源来源：

- dreammis/social-auto-upload：https://github.com/dreammis/social-auto-upload

注意：

- 自动发布容易触发平台风控，第一阶段建议仍然人工发布。
- 可以先把本 MVP 生成的小红书图文、视频、标题、标签导出为“发布包”，后续再接自动发布。

## 7. Playwright

用途：

- 连接 Chrome 调试端口
- 自动打开原始 Web UI
- 可能被发布模块用于浏览器自动化

本项目代码线索：

```text
combined_launcher.py
utils/ms-playwright.tar
```

注意：

- `combined_launcher.py` 支持从 `utils/ms-playwright.tar` 离线安装浏览器资源。
- 当前 `utils/` 目录不存在，所以离线包也不存在。
- 恢复 `utils/` 后再检查 Playwright 是否需要在线安装。

## 建议恢复顺序

1. 先下载/恢复完整资源包，因为里面可能包含项目定制过的 `utils/`、`ai_processing/`、`video_tools/`、`cosyvoice/api.pyd`、`tuilionnx/` 和模型文件。
2. 再补通用运行时：
   - FFmpeg
   - ImageMagick
   - Miniconda avatar 环境
3. 运行：

```bat
D:\Python312\python.exe original_runtime_audit.py
```

4. 如果 `utils/ai_processing/video_tools` 仍缺，再考虑用开源仓库重写适配层。
5. 如果 CosyVoice 或 HeyGem/Duix 使用开源新版，也应作为“新后端接入”，不要混进原接口目录里硬冒充旧 `.pyd`。

## 当前判断

可直接从开源/官方补齐：

- FFmpeg
- ImageMagick
- Miniconda
- CosyVoice 源码和模型
- HeyGem/Duix 数字人后端
- social-auto-upload

仍需要项目资源包或重新适配：

- `utils/launcher.py`
- `utils/launcher_webserver.py`
- `utils/video_processor.py`
- `utils/voice_processor.py`
- `utils/service_launcher.py`
- `ai_processing/text_rewriter.py`
- `video_tools/generate_video.py`
- `video_tools/subtitle_utils.py`
- `video_tools/publisher.py`
- `cosyvoice/api.cp312-win_amd64.pyd`
- `tuilionnx/` 里的项目定制数字人接口
