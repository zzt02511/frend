# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Frend - 短视频工厂

DEERFLOW 架构驱动的模板化短视频制作平台。通过 LangGraph 编排 7 个 Skill，将 YAML 模板逐级解析为可渲染的视频。

## 技术栈

- **Backend**: Python 3.12+, FastAPI, LangGraph (状态图编排), SQLite, FFmpeg, Pydantic v2, httpx, PyYAML, Jinja2, sse-starlette
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, @tanstack/react-query, CSS Variables (无 Tailwind)
- **Dev**: pytest (asyncio), uvicorn

## 核心架构

```
用户请求 → Projects API → Job Queue → LangGraph StateGraph
                                            ↓
    template_parse → script_generate → collect_assets → generate_tts → generate_srt → ffmpeg_render → finalize
                                            ↓
                                     FFmpeg Sandbox → 输出视频
```

### Backend 模块设计

模块化架构，各层职责分明：

```
backend/
├── app/api/          # FastAPI 路由层（templates / projects / jobs / llm / batch）
│   ├── router.py     # 路由聚合，挂载到 /api/v1
│   ├── templates.py  # 模板 CRUD
│   ├── projects.py   # 项目管理 + 渲染触发（异步编排）
│   ├── jobs.py       # 作业状态查询 + SSE 实时流 + 取消/下载
│   ├── llm_proxy.py  # LLM BFF 代理（前端→后端→LLM API）
│   └── batch.py      # 批量生成（CSV/JSON→多视频+ZIP）
├── app/agents/       # LangGraph 工作流图
│   ├── state.py      # AgentState TypedDict（项目/脚本/资产/错误/进度）
│   ├── graph.py      # 7 节点线性 StateGraph 定义
│   └── coordinator.py # 初始状态工厂 + finalize 节点
├── app/skills/       # DEERFLOW 风格技能（基类 + 7 个实现）
│   ├── base.py       # BaseSkill 抽象基类 + SkillContext/SkillResult
│   ├── registry.py   # 全局技能注册表（代码 + YAML 双注册）
│   ├── template_parser.py  # YAML 模板加载 + {{var}} 占位符解析
│   ├── script_writer.py    # LLM 驱动脚本生成（含回退模板）
│   ├── image_gen.py        # AI 图像生成（SiliconFlow API / 占位图降级）
│   ├── tts_speaker.py      # TTS 合成（OpenAI 兼容 API / FFmpeg 静音降级）
│   ├── subtitle_gen.py     # SRT 字幕生成（文本分段 + 时间轴）
│   ├── ffmpeg_renderer.py  # FFmpeg 全流水线（逐场景→拼接→音频→字幕→输出）
│   └── asset_manager.py    # 资产验证/缓存/清理/元数据记录
├── app/sandbox/      # 执行沙箱
│   ├── job_queue.py   # SQLite 持久化队列 + 并发控制(Semaphore) + SSE 广播 + 超时/重试/周期性清理
│   └── local_sandbox.py # FFmpeg 子进程沙箱（LocalSandbox 类）
├── app/services/     # 外部服务
│   └── llm_service.py    # LLM API 客户端（重试/缓存/JSON 解析）
├── app/models/       # Pydantic 数据模型
│   └── template.py   # TemplateSchema/SceneDefinition/ParameterVariable 等
├── app/utils/        # 工具函数
│   ├── ffmpeg.py     # FFmpeg 命令构建（场景/拼接/音频混合/字幕烧录）
│   ├── media.py      # ffprobe 封装（MediaInfo 探测器）
│   └── templates.py  # Jinja2 FFmpeg 模板环境
├── app/main.py       # FastAPI 应用入口 + 生命周期（DB/技能注册/队列/超时检测）
├── app/config.py     # pydantic-settings 集中配置
├── app/db.py         # 异步 SQLite CRUD（线程池包装 + WAL 模式）
└── tests/            # pytest 异步测试
```

### Frontend 模块设计

```
frontend/
├── src/app/               # Next.js 16 App Router
│   ├── page.tsx           # 首页重定向到 /templates
│   ├── layout.tsx         # 根布局 + Providers
│   ├── providers.tsx      # @tanstack/react-query 客户端
│   ├── templates/         # 模板库列表 + 模板编辑/参数填写
│   ├── projects/          # 项目管理 + 渲染触发 + 进度追踪
│   ├── jobs/              # 渲染队列 + SSE 实时进度 + 预览下载
│   └── batch/             # 批量生成 CSV/JSON 导入 + 进度面板 + ZIP 下载
├── src/components/        # 组件
│   ├── layout/            # AppShell / Sidebar / TopBar
│   ├── templates/         # TemplateLibrary 卡片网格
│   ├── batch/             # BatchProgress 面板
│   ├── media/             # PreviewPlayer / AssetManager
│   ├── settings/          # ApiKeyModal
│   └── shared/            # Button / Card / EmptyState / ErrorBoundary / LoadingSpinner
└── src/lib/               # 共享库
    ├── api-client.ts      # FrendClient 类（所有 API 方法）
    ├── api-types.ts       # TypeScript 接口（与后端 Pydantic 对齐）
    └── hooks/useSSE.ts    # SSE 实时事件 Hook
```

## FFmpeg 渲染流水线 (ffmpeg_renderer.py)

5 个子步骤, 使用 `LocalSandbox` (asyncio 子进程):
1. **逐场景渲染** → 2. **场景拼接 (concat)** → 3. **音频混合 (TTS + BGM)** → 4. **字幕烧录 (SRT hardsub)** → 5. **最终输出 + media probe 验证**

每场景渲染失败自动降级为占位视频（灰色背景 + 错误文本）。

## AgentState 关键字段

| 字段 | 类型 | 来源阶段 |
|------|------|----------|
| project_id, template_id | str | init |
| user_params | dict | UI 输入 |
| template | dict | template_parse |
| script | list[dict] | script_generate |
| assets | list[dict] | collect_assets |
| tts_audio | list[str] | generate_tts |
| subtitles | list[dict] | generate_srt |
| ffmpeg_command / output_path | str | ffmpeg_render |
| progress | float (0→1) | 全阶段追踪 |
| errors / warnings | list[str] | 全阶段 |

## 关键设计决策

1. **DEERFLOW Skill 模式**: 每个技能继承 `BaseSkill`，实现 `skill_id` 和 `execute(SkillContext) → SkillResult`。技能通过全局 `registry` 注册，支持代码 + YAML 双注册路径。
2. **LangGraph 线性流水线**: 视频生成是 7 节点线性图（template_parse → script_generate → collect_assets → generate_tts → generate_srt → ffmpeg_render → finalize），每个节点调用对应的 Skill。状态通过 `AgentState` TypedDict 传递。
3. **SQLite + 线程池**: 所有数据库操作通过 `asyncio.to_thread` 在独立线程中运行同步 SQLite（WAL 模式 + busy_timeout=5000），避免 GIL 阻塞事件循环。
4. **Job Queue + SSE**: `JobQueue` 类管理 asyncio.Semaphore 并发控制 + SQLite 持久化状态 + asyncio.Queue SSE 广播 + 超时检测 + 重试(指数退避) + 周期性清理(保留50条最新)。
5. **多级降级**: TTS 失败→FFmpeg 静音音频；图像生成失败→SVG 占位图；脚本生成无 LLM→模板回退。
6. **LLM BFF 代理**: 前端通过 `/api/v1/llm/chat` 代理调用 LLM API（默认 MiniMax M2.1），API Key 由前端传入不持久化。

## 开发命令

### 启动后端
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

### 启动前端
```bash
cd frontend
npm install
npm run dev    # 默认 localhost:3000
```

### 运行测试
```bash
cd backend
pip install -e ".[dev]"
pytest                              # 全部测试
pytest tests/test_graph.py          # 特定文件
pytest -k "template_parse"          # 关键词过滤
pytest --coverage -v                # 带覆盖率
```

### 依赖管理
- **Backend**: 编辑 `backend/pyproject.toml`，然后 `cd backend && pip install -e ".[dev]"`
- **Frontend**: 编辑 `frontend/package.json`，然后 `cd frontend && npm install`

## API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/v1/templates` | GET | 模板列表 |
| `/api/v1/templates/{id}` | GET | 模板详情 |
| `/api/v1/projects` | GET/POST | 项目 CRUD |
| `/api/v1/projects/{id}/render` | POST | 提交渲染（异步触发 LangGraph） |
| `/api/v1/jobs` | GET | 渲染作业列表 |
| `/api/v1/jobs/{id}` | GET | 作业状态 |
| `/api/v1/jobs/{id}/stream` | GET | SSE 实时进度 |
| `/api/v1/jobs/{id}/download` | GET | 下载视频 |
| `/api/v1/jobs/{id}/cancel` | POST | 取消作业 |
| `/api/v1/batch/json` | POST | JSON 批量渲染 |
| `/api/v1/batch/csv` | POST | CSV 批量渲染 |
| `/api/v1/batch/{id}` | GET | 批次状态 |
| `/api/v1/batch/{id}/download` | GET | ZIP 下载 |
| `/api/v1/llm/chat` | POST | LLM BFF 代理 |

## 模板格式

模板存储在 `templates/*.yaml`，遵循 `templates/_schema.yaml` 定义的 Schema。核心结构：元数据 → video 配置 → parameters（用户填写的参数变量，在模板中以 `{{var}}` 引用）→ scenes（场景列表，每个场景包含 duration/transition/elements）→ audio → subtitles。

目前可用模板：`knowledge-short`、`daily-vlog`、`product-promo`、`showroom-sales`、`talking-head`、`tutorial`

## 配置 (pydantic-settings)

所有配置在 `backend/app/config.py`，前缀 `FREND_`:
- `FREND_DEBUG`, `FREND_HOST` (默认 0.0.0.0), `FREND_PORT` (8000), `FREND_CORS_ORIGINS` (默认 localhost:3000)
- `FREND_DATA_DIR`, `FREND_TEMPLATES_DIR`, `FREND_DB_PATH` (data/frend.db)
- `FREND_MAX_CONCURRENT_JOBS` (默认 2), `FREND_MAX_JOB_DURATION_SECONDS` (300)
- `FREND_FFMPEG_PATH`, `FREND_FPROBE_PATH`
- 也支持 `.env` 文件

## 测试架构

```bash
pytest                           # 全部测试 (asyncio_mode=auto)
pytest tests/test_graph.py -v    # 单个文件
pytest -k "template_parse"       # 关键词过滤
pytest tests/test_db.py          # 12 个 CRUD 测试 (project/job)
pytest tests/test_job_queue.py   # 12 个 JobQueue 测试 (超时/重试/SSE/并发)
```

## 约定

- 配置通过 `FREND_` 环境变量前缀覆盖 `app/config.py` 中的 Settings
- Next.js `next.config.ts` 将 `/api/*` 通过 rewrites 代理到 `http://127.0.0.1:8000/api/*`
- `frontend/AGENTS.md` 注: 当前 Next.js 16 有非标准 API 变更, 参考 `node_modules/next/dist/docs/`
- 运行时数据存储在 `data/` 目录（gitignored）
- 所有技能实例在 `app/main.py` 的 lifespan 中注册
- 前端使用 CSS Variables 主题（见 `globals.css`），无 Tailwind CSS
- SSE 端点发送心跳（30s 超时）保持长连接
- 渲染作业使用指数退避重试（最多 2 次）
- `skills_yaml/` 和 `ffmpeg_templates/` 目录已配置路径但尚未创建
- `data/assets/fonts/.gitkeep` 占位保留，字体文件被 gitignore 排除
