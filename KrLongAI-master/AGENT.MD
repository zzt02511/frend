# AGENT.MD

This file records the working context, environment fixes, and implementation notes for `D:\AI\KrLongAI-master`.

## Current Status Snapshot

## 2026-06-05 Handoff Snapshot: Talking Video AI Auto Edit

Current active workspace:

- Worktree: `D:\AI\3D\.worktrees\ai-content-pack-tool`
- Project: `D:\AI\3D\.worktrees\ai-content-pack-tool\KrLongAI-master`
- Branch: `codex/ai-content-pack-tool`
- Python: `D:\Python312\python.exe`
- Use Git with `git -c safe.directory=D:/AI/3D/.worktrees/ai-content-pack-tool ...` because the sandbox user reports dubious ownership.
- Git status usually prints `C:\Users\78575/.config/git/ignore` permission warnings. Treat them as non-blocking unless changed paths are listed.

User goal now:

- Add AI automatic editing for user-uploaded talking-head videos.
- Workflow: talking video + optional user script/transcript + tagged real materials -> editable `edit_plan.json` -> user confirmation -> FFmpeg-rendered MP4 draft.
- First implementation target is local Windows runtime inside `KrLongAI-master`; cloud deployment comes later.

Confirmed product decisions:

- User uploads a talking-head video plus product/factory/case/store materials.
- Script/transcript supports both modes; prefer user-provided script, fallback to speech-to-text later.
- Two-stage workflow: generate editable edit plan first, render MP4 after confirmation.
- Default output is vertical `9:16`, with selectable aspect ratios.
- FFmpeg is the first render engine; Jianying draft export is deferred.
- Precision draft should support silence trimming, vertical crop, subtitles, title, CTA, B-roll, transitions, BGM, sound effects, keyword highlights, cover, and progress bar over time.
- Material matching uses manual tags plus AI suggestions.

Design and plan docs already committed:

- `3D/docs/superpowers/specs/2026-06-04-talking-video-ai-auto-edit-design.md`
  - Commit: `1814323 docs: specify talking video auto edit workflow`
- `3D/docs/superpowers/plans/2026-06-04-talking-video-ai-auto-edit-implementation.md`
  - Commit: `9f2aa6d docs: plan talking video auto edit implementation`

Implementation progress:

- Task 1 is complete and approved by spec and code-quality review.
  - Files:
    - `talking_video_editor.py`
    - `test_talking_video_editor.py`
  - Current behavior:
    - `MaterialAsset`
    - `safe_project_id`
    - `infer_material_type`
    - `normalize_materials`
    - `segment_script`
    - keyword extraction and intent inference
    - B-roll matching with non-overflowing slot timing
    - `build_edit_plan(..., title=None, cta=None)`
    - `save_edit_plan`
  - Tests: `D:\Python312\python.exe -m unittest test_talking_video_editor.py`
  - Latest result: `Ran 14 tests ... OK`
  - Final Task 1 commit: `971f88f fix: avoid broll timing overflow`
  - Important fixes already made:
    - Added explicit `title` parameter support.
    - Preserved fractional `durationTarget` and final segment end precision.
    - Prevented B-roll slots from exceeding segment duration, including `1.999s` edge case.
    - Added `save_edit_plan` UTF-8 persistence coverage.

- Task 2 implementation is committed but NOT quality-approved yet.
  - Files:
    - `ffmpeg_video_renderer.py`
    - `test_ffmpeg_video_renderer.py`
  - Commit: `bf12af2 feat: add ffmpeg render command generation`
  - Tests: `D:\Python312\python.exe -m unittest test_ffmpeg_video_renderer.py`
  - Latest result: `Ran 4 tests ... OK`
  - Spec review passed.
  - Code-quality review returned `With fixes`; fix these before starting Task 3:
    - `render_edit_plan()` does not catch `OSError` from `subprocess.run()` when `ffmpeg_path` exists but is not executable. It should return JSON `{ok: False, status: "failed", ...}` and write a log instead of crashing.
    - Root-style or URL-style media paths such as `/videos/talking.mp4` can be mis-resolved on Windows. Define the contract and normalize leading-slash project-relative paths or reject unsupported URL paths explicitly.
    - `render_edit_plan()` itself is under-tested. Add focused tests for missing FFmpeg log writing, `execute=False`, subprocess failure/success payloads, and launch-error behavior using temp dirs and `unittest.mock.patch`.
    - Optional cleanup: extract repeated source/captions/output path resolution before Task 3 grows this module.

Next implementation order from the active plan:

1. Finish Task 2 quality fixes, then re-run spec and code-quality review for Task 2.
2. Task 3: add precision render layers to `ffmpeg_video_renderer.py`:
   - B-roll inputs and overlays
   - title and CTA `drawtext`
   - progress bar
   - BGM command planning
   - cover command generation
3. Task 4: add talking-video persistence and API endpoints in `custom_home_server.py`.
4. Task 5: add `talking_video_editor.html` workbench page.
5. Task 6: add runtime ignores and `content_pipeline.py` metadata.
6. Task 7: run full verification and browser smoke test.

Review/process notes:

- User chose option `1`: Subagent-Driven Development.
- Continue task-by-task with implementation, spec review, then code-quality review.
- Do not proceed to the next task while spec or quality review has open Important/Critical issues.
- Use `test-driven-development` for code changes.
- Use `verification-before-completion` before claiming final completion.
- Use `apply_patch` for manual file edits.
- Do not commit real videos, customer assets, API keys, or runtime output folders.
- Do not repeat any server password shared in chat.

Related earlier deployment note:

- A lightweight `ai-ip-content-pack-tool` static app was deployed to `http://218.78.135.21:8090/`.
- Remote app path: `/opt/ai-ip-content-pack-tool/site`
- Container: `ai-ip-content-pack-tool`
- Port mapping: `8090:80`
- Existing `80/443` Caddy deployment was intentionally not touched.

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

Digital-human API adapter updates:

- `cloud_runtime_client.py` now supports payload fields for:
  - `background_url`
  - `avatar_asset_url`
  - `voice_asset_url`
  - `clone_mode`
  - `aspect_ratio`
  - `visual_notes`
- Duix support includes automatic JWT token generation from `appId` and `appKey`.
- The provider template system can pass user-uploaded background/avatar/voice asset URLs into third-party API JSON templates.

Privacy/runtime data:

- `.gitignore` now excludes:
  - `digital_human_assets/`
  - `digital_human_packages/`
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
