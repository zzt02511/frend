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
