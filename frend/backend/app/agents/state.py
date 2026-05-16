"""AgentState - DEERFLOW 风格的 Sub-Agent 状态定义"""

from typing import TypedDict


class AgentState(TypedDict):
    """LangGraph Agent 状态 - 在子代理间传递的工作流上下文"""

    # 项目标识
    project_id: str
    template_id: str

    # 用户输入
    user_params: dict  # 来自 UI 的参数化输入

    # 阶段输出
    template: dict          # 解析后的模板结构
    script: list[dict]      # 脚本生成器输出（每个场景的文本）
    assets: list[dict]      # 采集的资产清单
    tts_audio: list[str]    # TTS 生成音频路径
    subtitles: list[dict]   # SRT 字幕条目

    # 渲染
    ffmpeg_command: str     # 生成的 FFmpeg 命令
    output_path: str        # 最终视频路径

    # 执行追踪
    errors: list[str]
    warnings: list[str]
    current_step: str
    progress: float          # 0.0 → 1.0

    # 上下文
    working_memory: dict     # 代理间传递的共享上下文
    config: dict             # 运行时配置
