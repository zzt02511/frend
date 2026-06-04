# AGENT.MD

This file records the working context, environment fixes, and implementation notes for `D:\AI\KrLongAI-master`.

## Current Status Snapshot

Current working direction:

- Build a software product similar in spirit to KrLongAI / 轻语AI / 旗博士, but not as a generic all-industry digital-human tool.
- First vertical: 非标定制家居.
- First customer: 本地全屋定制、衣柜橱柜、木作定制、门墙柜一体门店/经销商.
- First business goal: 同城短视频获客, leading to 私信、咨询、到店、预约量尺.
- First product shape: 服务 + 软件. The software helps generate scripts, titles, cover copy, comments/private-message hooks, rewrite prompts, and project files; humans still review, edit, publish, and track results.
- Current technical reality: the original KrLongAI runtime package is incomplete, so the immediately runnable deliverable is a standalone custom-home lead-generation MVP.

Current usable MVP entry points:

- Browser workbench: `D:\AI\KrLongAI-master\custom_home_agent.html`
- Local server workbench: `D:\AI\KrLongAI-master\custom_home_server.py`
- Python generator: `D:\AI\KrLongAI-master\custom_home_agent.py`
- Sample input: `D:\AI\KrLongAI-master\custom_home_case.sample.json`
- Tests: `D:\AI\KrLongAI-master\test_custom_home_agent.py`
- User-facing MVP guide: `D:\AI\KrLongAI-master\CUSTOM_HOME_AGENT.md`
- Local project folder: `D:\AI\KrLongAI-master\custom_home_projects`
- Local material folder: `D:\AI\KrLongAI-master\custom_home_materials`

Latest work:

- Added the digital-human studio three-task button split:
  - `提交形象克隆` calls `POST /api/cloud/avatar-clone/submit`.
  - `提交声音克隆` calls `POST /api/cloud/voice-clone/submit`.
  - `生成口播视频` calls `POST /api/cloud/avatar-video/submit`.
  - Cloud API templates can branch on `task_type`: `avatar_clone`, `voice_clone`, or `avatar_video`.
- Fixed乱码 in the custom-home MVP generator, tests, sample JSON, docs, and workbench copy.
- Improved generated Chinese copy quality for the first vertical.
- Rebuilt the HTML workbench with a clearer product interface, project strip, metrics, content cards, rewrite panels, and server/localStorage status.
- Added real-material workflow for Xiaohongshu: register/upload real photos and videos, generate note drafts, and generate video material matching plans.
- Added `custom_home_server.py`, a dependency-free local HTTP server with:
  - `POST /api/generate`
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/projects/<name>`
  - `DELETE /api/projects/<name>`
  - `POST /api/materials`
- Project saving now writes JSON files under `custom_home_projects/` when the workbench is opened through the local server.

## Project Reality

This repository is a partial delivery of a Windows-first AI digital-human short-video automation project. The original project appears to target this workflow:

1. Extract or input benchmark copy.
2. Rewrite short-video scripts.
3. Generate or clone voice.
4. Generate digital-human talking-head video.
5. Add subtitles, BGM, title, and cover copy.
6. Export videos for manual or automated publishing.

The current checked-out directory is incomplete. It contains entry files and compiled modules, but is missing several runtime directories required by the original launcher.

Present files include:

- `app.py`: Gradio/FastAPI UI and event wiring.
- `combined_launcher.py`: Main launcher for the original local app.
- `一键启动旗博士追爆智能体.bat`: Windows one-click launcher.
- `start_cosyvoice_service.py`: CosyVoice service launcher/checker.
- `start_cosyvoice_api.py`: CosyVoice API module launcher.
- `restore_source_files.py`: Restores `.py` files from `python_source_backup/` if available.
- `selective_compile_to_pyd.py`: Compiles selected Python modules to `.pyd`.
- `setup_apppy.cp312-win_amd64.pyd`, `setup_modules.cp312-win_amd64.pyd`, `start_robot.cp312-win_amd64.pyd`: Windows CPython 3.12 compiled modules.
- `代码地址.txt`: Baidu Netdisk link for the full resource package.

Missing runtime directories include:

- `miniconda3/`
- `utils/`
- `ffmpeg/`
- `ImageMagick-7.1.1-Q16-HDRI/`
- `cosyvoice/`
- `ai_processing/`
- `video_tools/`
- `tuilionnx/` or other digital-human model directories
- `python_source_backup/`

Because of these missing directories, the original `combined_launcher.py` flow cannot fully run until the full resource package is restored.

## Original Project Startup

After the full resource package is restored, expected startup is:

```bat
cd /d D:\AI\KrLongAI-master
一键启动旗博士追爆智能体.bat
```

The batch file is expected to:

1. Activate `miniconda3\envs\avatar`.
2. Add `ffmpeg\bin` to `PATH`.
3. Add `ImageMagick-7.1.1-Q16-HDRI` to `PATH`.
4. Set `IMAGEMAGICK_BINARY`.
5. Launch `combined_launcher.py`.
6. Open Chrome with remote debugging on port `9222`.
7. Visit `http://127.0.0.1:8000`.

Important ports:

- Main local UI: `http://127.0.0.1:8000`
- CosyVoice API docs: `http://localhost:9880/docs`
- Chrome remote debugging: `http://localhost:9222`

The full resource package link found in `代码地址.txt` is:

```text
https://pan.baidu.com/s/12kNd-iKyWLku9HWNCRccGQ?pwd=1234
```

## Python Environment

Use Python 3.12.10 64-bit installed at:

```text
D:\Python312
```

In this Codex session, prefer the absolute path:

```bat
D:\Python312\python.exe
```

Useful commands:

```bat
D:\Python312\python.exe -m unittest test_custom_home_agent.py
D:\Python312\python.exe custom_home_agent.py --input custom_home_case.sample.json --json
D:\Python312\python.exe custom_home_server.py --port 8765
```

## Implemented MVP: Custom Home Local Lead Agent

Target customer:

- Local custom-home stores and dealers.
- Whole-house customization, wardrobes, cabinets, woodwork, wall-door-cabinet integration.

Primary scenario:

- Local short-video lead generation.
- Goal: private messages, inquiries, store visits, and measurement appointments.

Implemented content pillars:

- 装修避坑
- 案例讲解
- 价格解释
- 工艺展示
- 本地信任

Each generated item includes:

- 15-45 second talking script.
- 3 video titles.
- 1 cover line.
- Comment/private-message prompt.
- Private-message keyword.
- Compliance notes.
- Editing storyboard suggestions.
- LLM rewrite prompt.
- Content score.
- One-click rewritten script.
- Xiaohongshu note draft.
- Xiaohongshu video material matching plan.
- Optional OpenAI-compatible browser rewrite workflow.

Frontend workbench features:

- Fill custom-home case parameters in the left panel.
- Generate 5, 10, or 15 content items.
- Show generated scripts directly on the page.
- Show editable rewritten copy for each item.
- Support offline one-click rewrite.
- Support optional OpenAI-compatible AI rewrite.
- Register/upload real photos and videos for Xiaohongshu content.
- Generate Xiaohongshu note drafts and real-material video edit plans.
- Copy all content or copy a single LLM prompt/rewrite.
- Save/load/delete content projects.
- Use local JSON files when opened through `custom_home_server.py`.
- Fall back to browser `localStorage` when opened directly as a file.

## Implemented Add-On: Digital Human Talking-Video Studio

New goal implemented:

- Build a dedicated workflow for creating a digital-human talking video from user-provided copy.
- Support user-owned clone materials:
  - avatar/image clone material: portrait photo or front-facing video.
  - voice clone material: audio or video with clear speech.
  - real background material: user-uploaded store, jobsite, product, or customer-space photo/video.
- Assemble these into a local production package that can be submitted to the configured digital-human API.

New entry point:

```text
D:\AI\KrLongAI-master\digital_human_studio.html
```

Additional one-stop production pipeline entry point:

```text
D:\AI\KrLongAI-master\video_pipeline_studio.html
```

Recommended URL after starting the local server:

```text
http://127.0.0.1:8765/digital_human_studio.html
```

New local server APIs:

- `POST /api/digital-human/assets`
  - Saves avatar, voice, and background assets under `digital_human_assets/`.
- `GET /api/digital-human/packages`
  - Lists saved digital-human production packages.
- `POST /api/digital-human/packages`
  - Saves a digital-human production package JSON under `digital_human_packages/`.
- `GET /api/digital-human/packages/<name>`
  - Loads a saved production package.
- `DELETE /api/digital-human/packages/<name>`
  - Deletes a saved production package.
- `POST /api/cloud/avatar-video/submit`
  - Converts the studio package into a digital-human task row and submits it through `cloud_runtime_client.submit_heygem_task`.
- `POST /api/cloud/avatar-clone/submit`
  - Submits the image/avatar clone task row with `task_type=avatar_clone`.
- `POST /api/cloud/voice-clone/submit`
  - Submits the voice clone task row with `task_type=voice_clone`.
- `POST /api/pipeline/tts`
  - Uses Doubao/Volcengine Seed TTS V3 settings to synthesize narration audio and save it under `digital_human_assets/voice/generated/`.
- `POST /api/pipeline/avatar-video`
  - Submits the current package to the configured avatar/lip-sync provider.
- `POST /api/pipeline/compose`
  - Uses local FFmpeg to combine background media, local avatar/lip-sync video, generated narration audio, and generated SRT subtitles into `digital_human_outputs/`.
- `GET /api/pipeline/outputs`
  - Lists recent local MP4 outputs and subtitle files from `digital_human_outputs/`.
- `DELETE /api/pipeline/outputs/<name>`
  - Deletes one local output folder from `digital_human_outputs/`.
- `GET /api/pipeline/outputs/<name>/zip`
  - Builds and downloads a delivery ZIP containing the local MP4, subtitles, and manifest JSON.

Digital-human API adapter updates:

- `cloud_runtime_client.py` now supports payload fields for:
  - `background_url`
  - `avatar_asset_url`
  - `voice_asset_url`
  - `clone_mode`
  - `aspect_ratio`
  - `visual_notes`
- Duix support includes automatic JWT token generation from `appId` and `appKey`.
- Duix official API docs currently expose `POST /duix-openapi-v2/sdk/v2/createAvatar` for avatar creation and `GET /duix-openapi-v2/sdk/v2/queryAvatar?taskId=...` for creation status. Treat this as avatar/conversation creation, not a confirmed one-call "script + avatar + voice -> finished MP4" endpoint.
- Doubao/Volcengine Seed TTS V3 is supported through `video_pipeline.py`; use `X-Api-Key`, `X-Api-Resource-Id` (for example `seed-tts-2.0`), and `voice_type`.
- The provider template system can pass user-uploaded background/avatar/voice asset URLs into third-party API JSON templates.
- FFmpeg Windows prebuilt runtime is installed at `ffmpeg/bin/ffmpeg.exe` from gyan.dev essentials build. Do not commit the `ffmpeg/` runtime directory.

Privacy/runtime data:

- `.gitignore` now excludes:
  - `digital_human_assets/`
  - `digital_human_packages/`
  - `digital_human_outputs/`
  - existing local material/export/runtime folders.
- Do not commit real user photos, voice samples, videos, API keys, or generated customer packages.

Current limitation:

- The studio completes local upload, preview, package save/load, and API task submission.
- Actual finished video generation depends on the configured vendor endpoint. If Duix/Baidu/another provider gives a dedicated "script + avatar/voice/background -> finished 9:16 video" endpoint, put that endpoint and JSON schema into the settings page's digital-human API template.

## How To Use The MVP

Recommended local server mode:

```bat
cd /d D:\AI\KrLongAI-master
D:\Python312\python.exe custom_home_server.py --port 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

Direct HTML mode also works:

```text
D:\AI\KrLongAI-master\custom_home_agent.html
```

No server is required for direct HTML mode, but projects only persist in the current browser.

## Verification Performed

Verified with:

```bat
D:\Python312\python.exe -m unittest test_custom_home_agent.py
D:\Python312\python.exe -m py_compile custom_home_agent.py custom_home_server.py
D:\Python312\python.exe custom_home_agent.py --input custom_home_case.sample.json --json
```

Local server API was also smoke-tested:

- `POST /api/generate`
- `POST /api/projects`
- `GET /api/projects/<name>`
- `DELETE /api/projects/<name>`
- `POST /api/materials`

Frontend inline script syntax was checked with Node's `vm.Script`.

Latest digital-human studio verification:

```bat
D:\Python312\python.exe -m py_compile custom_home_server.py cloud_runtime_client.py custom_home_agent.py
D:\Python312\python.exe -m unittest test_cloud_runtime_client.py test_custom_home_agent.py
```

Result:

```text
14 tests OK
digital_human_studio.html inline script OK
custom_home_settings.html inline script OK
custom_home_agent.html inline script OK
```

Latest video pipeline verification:

```bat
D:\Python312\python.exe -m unittest test_cloud_runtime_client.py test_custom_home_agent.py test_video_pipeline.py
D:\Python312\python.exe -m py_compile cloud_runtime_client.py custom_home_server.py video_pipeline.py
```

Result:

```text
29 tests OK
FFmpeg compose smoke test generated a playable 1080x1920 MP4 with video and audio streams.
Pipeline HTTP endpoints `/api/pipeline/tts` and `/api/pipeline/compose` are covered by smoke tests.
`/api/pipeline/compose` is also covered by a real HTTP-to-FFmpeg compose smoke test.
Pipeline output history, manifest files, and output deletion are covered by unit and HTTP endpoint smoke tests.
FFprobe media probing is covered and adds duration, resolution, and audio-presence metadata to output history.
Delivery ZIP packaging and HTTP download are covered by unit and endpoint smoke tests.
```

## Recommended Next Implementation Order

1. Add editable industry template library.
2. Add material upload and simple shot-list binding.
3. Add task/history page for weekly delivery batches.
4. Add lead conversion assets: private-message replies, comment replies, appointment/measurement scripts.
5. Add data loop: record published video URL, views, comments, private messages, leads, visits, and appointments.
6. Add video assembly integration only after original KrLongAI resources are restored or a new video stack is chosen.

## Development Notes For Future Agents

- Prefer extending `custom_home_agent.py` for script/content generation logic.
- Prefer extending `custom_home_agent.html` for demo/workbench UX.
- Prefer extending `custom_home_server.py` for local persistence/API behavior.
- Keep the MVP dependency-free unless the user explicitly chooses a larger stack.
- The original project is Windows-first. Avoid Linux/macOS assumptions.
- Do not delete `.pyd` files unless the user explicitly requests source-only debugging.
- Use `rg` for searching when available.
- Use `D:\Python312\python.exe` in this Codex session if `python` is not visible.
