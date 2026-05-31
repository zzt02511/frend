# AGENT.MD

This file records the working context, environment fixes, and implementation notes from the current Codex session for `D:\AI\KrLongAI-master`.

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

## Python Environment Fix

The user originally had a broken Python registration:

- `py -0p` pointed to `C:\Python312\python.exe`.
- That file did not exist.
- `where python` only showed the Windows Store alias.

The correct fix was to install **Python 3.12.10 64-bit**, not Python 3.14 and not `Python-3.12.13.tar.xz`.

Important note:

- `Python-3.12.13.tar.xz` is a source package and is not suitable for direct Windows installation.
- Python 3.12.13 is source-only on python.org.
- Python 3.12.10 is the last Python 3.12 release with a Windows installer.

Installed path:

```text
D:\Python312
```

Recommended installer options:

```text
[x] Install Python 3.12 for all users
[x] Associate files with Python
[x] Create shortcuts for installed applications
[x] Add Python to environment variables
[ ] Precompile standard library
[ ] Download debugging symbols
[ ] Download debug binaries
```

After installation, the user verified:

```bat
python --version
py -3.12 --version
pip --version
where.exe python
```

Expected/current result:

```text
Python 3.12.10
pip 25.0.1 from D:\Python312\Lib\site-packages\pip (python 3.12)
D:\Python312\python.exe
C:\Users\78575\AppData\Local\Microsoft\WindowsApps\python.exe
```

The Windows Store alias appears after `D:\Python312\python.exe`, so it does not interfere.

In this Codex session, `python` may still be unavailable because the Codex process started before PATH was refreshed. Use the absolute path when needed:

```bat
D:\Python312\python.exe
```

## Node Environment Finding

Node.js is installed and works outside the sandbox:

```bat
C:\Program Files\nodejs\node.exe -v
```

Verified output:

```text
v24.9.0
```

Inside the Codex sandbox, `node` may resolve to the Codex App bundled resource path or be denied access to `C:\Program Files\nodejs`. This is a sandbox visibility issue, not a broken Node installation.

If Node commands are needed from Codex, run them with escalated permission or use a Node installation under a user/workspace path that the sandbox can access.

## Implemented MVP: Custom Home Local Lead Agent

Because the original KrLongAI resource package is incomplete, this session implemented a standalone MVP for the selected vertical:

**Non-standard custom home / whole-house customization local lead-generation content agent**

Target customer:

- Local custom-home stores and dealers.
- Whole-house customization, wardrobes, cabinets, woodwork, wall-door-cabinet integration.

Primary scenario:

- Local short-video lead generation.
- Goal: private messages, inquiries, store visits, and measurement appointments.

Implemented files:

- `custom_home_agent.py`: Dependency-free Python generation core.
- `custom_home_agent.html`: Local browser-based workbench.
- `custom_home_case.sample.json`: Sample custom-home case input.
- `test_custom_home_agent.py`: Unit tests.
- `CUSTOM_HOME_AGENT.md`: Usage and handoff documentation.

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
- Optional OpenAI-compatible browser rewrite workflow.
- AI rewrite prompts include the full store/case context, including pain points, selling points, budget wording, promotion, contact info, and benchmark copy.

Risky phrases checked include:

- `0甲醛`
- `零甲醛`
- `绝对环保`
- `100%环保`
- `最低价`
- `全网最低`
- `保证成交`
- `稳赚`
- `省一半`
- `省50%`
- `免费送`
- `虚假房源`

## How To Use The MVP

Open the local workbench directly in a browser:

```text
D:\AI\KrLongAI-master\custom_home_agent.html
```

No server is required for the HTML version.

Run from command line:

```bat
cd /d D:\AI\KrLongAI-master
python custom_home_agent.py --input custom_home_case.sample.json --json
```

Generate Markdown output:

```bat
cd /d D:\AI\KrLongAI-master
python custom_home_agent.py --input custom_home_case.sample.json --output custom_home_scripts.md
```

Run tests:

```bat
cd /d D:\AI\KrLongAI-master
python -m unittest test_custom_home_agent.py
```

If running from the existing Codex session, use:

```bat
cd /d D:\AI\KrLongAI-master
D:\Python312\python.exe -m unittest test_custom_home_agent.py
D:\Python312\python.exe custom_home_agent.py --input custom_home_case.sample.json --json
```

Do not run the tests from `D:\` directly. If you do, Python will not find `test_custom_home_agent.py`.

Wrong:

```bat
cd /d D:\
python -m unittest test_custom_home_agent.py
```

Right:

```bat
cd /d D:\AI\KrLongAI-master
python -m unittest test_custom_home_agent.py
```

## Verification Performed

The MVP was verified with:

```bat
D:\Python312\python.exe -m unittest test_custom_home_agent.py
```

Result:

```text
Ran 4 tests in 0.195s
OK
```

Sample JSON generation also succeeded:

```bat
D:\Python312\python.exe custom_home_agent.py --input custom_home_case.sample.json --json
```

It generated 10 custom-home local lead-generation content items.

One bug was fixed during verification:

- Windows/Codex subprocess output had an encoding issue with Chinese JSON.
- `custom_home_agent.py` now reconfigures `stdout` to UTF-8 in `main()`.

## Product Direction From Discussion

The user wants to build software similar to the KrLongAI/轻语IP智能体 style, but narrowed to:

- Main industry: 非标定制家居.
- First customer type: 本地门店/经销商.
- First scenario: 同城获客.
- Delivery model: 服务 + 软件.
- Long-term shape: 本地部署 + 云端 SaaS.

Recommended first commercial package:

1. Collect 3 real local cases from a store.
2. Generate 10 scripts per case.
3. Produce 5 finished videos manually or semi-automatically.
4. Help publish manually.
5. Track comments, private messages, inquiries, visits, and measurement appointments.
6. Validate whether the store will pay for stable monthly content output.

Do not prioritize these in v1:

- Full multi-platform automated publishing.
- Complex account matrix operations.
- All-industry templates.
- Fully autonomous video generation before the original resource package is restored.

## Development Notes For Future Agents

- Prefer extending `custom_home_agent.py` for script/content generation logic.
- Prefer extending `custom_home_agent.html` for demo/workbench UX.
- Keep the Python MVP dependency-free. The HTML workbench has optional OpenAI-compatible browser rewrite settings stored in localStorage.
- If integrating with original KrLongAI later, map fields like this:
  - `script` -> digital-human spoken text.
  - `titles` -> publish title candidates.
  - `cover` -> cover large text.
  - `comment_prompt` -> caption/comment guidance.
  - `dm_keyword` -> private-message keyword.
  - `compliance_notes` -> human review checklist.
  - `storyboard` -> shot list for case-material editing.
  - `llm_prompt` -> prompt for OpenAI/Tongyi/Doubao/DeepSeek rewrite.
  - `score` -> review priority and content selection.
  - `rewritten_script` -> locally rewritten consultant-style copy.
- The original project is Windows-first. Avoid Linux/macOS assumptions.
- Do not delete `.pyd` files unless the user explicitly requests source-only debugging.
- Use `rg` for searching when available.
- Use `D:\Python312\python.exe` in this Codex session if `python` is still not visible.
