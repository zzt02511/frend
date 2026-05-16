"""模板 Pydantic 模型 - 定义模板 YAML 的结构"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ElementType(str, Enum):
    BACKGROUND = "background"
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    SHAPE = "shape"


class TransitionType(str, Enum):
    FADE_IN = "fade_in"
    FADE_OUT = "fade_out"
    SLIDE_LEFT = "slide_left"
    SLIDE_RIGHT = "slide_right"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    NONE = "none"


class AnimationType(str, Enum):
    SCALE_IN = "scale_in"
    SLIDE_UP = "slide_up"
    SLIDE_LEFT = "slide_left"
    TYPEWRITER = "typewriter"
    FADE_IN = "fade_in"
    ZOOM_IN = "zoom_in"
    NONE = "none"


class ParameterType(str, Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    IMAGE = "image"
    COLOR = "color"
    NUMBER = "number"
    SELECT = "select"


class ParameterVariable(BaseModel):
    """模板参数变量 - 用户在 UI 中填写"""
    name: str = Field(pattern=r'^[a-z_][a-z0-9_]*$')
    label: str
    type: ParameterType = ParameterType.TEXT
    required: bool = True
    default: str = ""
    placeholder: str = ""
    max_length: int = 200
    options: list[str] = []
    hint: str = ""


class BackgroundElement(BaseModel):
    type: ElementType = ElementType.BACKGROUND
    fill: str = "#1a1a2e"
    gradient: Optional[dict] = None  # {type, colors, angle}


class TextElement(BaseModel):
    type: ElementType = ElementType.TEXT
    content: str = ""
    font: str = ""
    font_size: int = 48
    color: str = "#ffffff"
    align: str = "center"
    x: str = "center"
    y: str = "center"
    width: Optional[int] = None
    animation: AnimationType = AnimationType.NONE
    bold: bool = False


class ImageElement(BaseModel):
    type: ElementType = ElementType.IMAGE
    source: str = "auto"  # "auto" | 参数名 | URL
    x: str = "center"
    y: str = "center"
    width: int = 400
    height: int = 400
    animation: AnimationType = AnimationType.ZOOM_IN
    fit: str = "cover"  # cover | contain | fill


SceneElement = BackgroundElement | TextElement | ImageElement


class SceneDefinition(BaseModel):
    """场景定义"""
    id: str = Field(pattern=r'^[a-z_][a-z0-9_]*$')
    duration: float = Field(gt=0, le=60)
    transition: TransitionType = TransitionType.FADE_IN
    elements: list[dict] = Field(min_length=1)

    @field_validator('elements')
    @classmethod
    def validate_elements(cls, v: list) -> list:
        for el in v:
            if 'type' not in el:
                raise ValueError('每个元素必须包含 type 字段')
            if el['type'] not in [t.value for t in ElementType]:
                raise ValueError(f'未知元素类型: {el["type"]}')
        return v


class AudioConfig(BaseModel):
    """音频配置"""
    bgm_default: str = ""
    bgm_volume: float = Field(default=0.3, ge=0, le=1)
    narration_voice: str = "zh-CN-XiaoxiaoNeural"
    narration_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    narration_volume: float = Field(default=1.0, ge=0, le=1)
    customer_voice: str = ""
    customer_volume: float = Field(default=0.7, ge=0, le=1)


class SubtitlesConfig(BaseModel):
    """字幕配置"""
    enabled: bool = True
    font: str = ""
    font_size: int = 28
    color: str = "#ffffff"
    position: str = "bottom"  # top | bottom | overlay
    language: str = "zh-CN"


class VideoConfig(BaseModel):
    """视频属性"""
    width: int = Field(default=1920, ge=1, le=7680)
    height: int = Field(default=1080, ge=1, le=7680)
    fps: int = Field(default=30, ge=1, le=120)
    default_duration: int = Field(default=15, ge=1, le=300)
    max_duration: int = Field(default=60, ge=1, le=600)


class TemplateSchema(BaseModel):
    """完整模板 Schema - Pydantic 验证"""
    model_config = {"extra": "forbid"}

    id: str = Field(pattern=r'^[a-z0-9_-]+$')
    name: str = Field(min_length=1, max_length=100)
    version: str = Field(default="1.0.0", pattern=r'^\d+\.\d+\.\d+$')
    description: str = ""
    category: str = ""
    thumbnail: str = ""

    video: VideoConfig = VideoConfig()
    parameters: list[ParameterVariable] = Field(default_factory=list)
    scenes: list[SceneDefinition] = Field(min_length=1)
    audio: AudioConfig = AudioConfig()
    subtitles: SubtitlesConfig = SubtitlesConfig()

    @field_validator('scenes')
    @classmethod
    def validate_total_duration(cls, v: list) -> list:
        total = sum(s.duration for s in v)
        if total > 120:
            raise ValueError(f'总时长 {total}s 超过 120s 上限')
        return v


class TemplateSummary(BaseModel):
    """模板摘要 - 用于列表展示"""
    id: str
    name: str
    description: str
    category: str
    version: str
    thumbnail: str
    scene_count: int
    total_duration: float
    parameter_count: int
