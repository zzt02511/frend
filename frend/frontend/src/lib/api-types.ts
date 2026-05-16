// API 类型定义 - 与后端 Pydantic 模型对齐

export interface ParameterVariable {
  name: string;
  label: string;
  type: "text" | "textarea" | "image" | "color" | "number" | "select";
  required: boolean;
  default: string;
  placeholder: string;
  max_length: number;
  options: string[];
  hint: string;
}

export interface SceneDefinition {
  id: string;
  duration: number;
  transition: string;
  elements: Record<string, unknown>[];
}

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  default_duration: number;
  max_duration: number;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  thumbnail: string;
  scene_count: number;
  total_duration: number;
  parameter_count: number;
}

export interface TemplateDetail {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  video: VideoConfig;
  parameters: ParameterVariable[];
  scenes: SceneDefinition[];
  subtitles: { enabled: boolean; [key: string]: unknown };
}

export interface ProjectResponse {
  project_id: string;
  template_id: string;
  template_name: string;
  status: string;
  params: Record<string, string>;
}

export interface RenderResponse {
  job_id: string;
  project_id: string;
  status: string;
  message: string;
}

export interface JobResponse {
  job_id: string;
  project_id: string;
  template_id: string;
  status: string;
  progress: number;
  current_step: string;
  message: string;
  output_path: string;
  error: string;
  created_at: number;
}

export interface BatchJobInfo {
  index: number;
  job_id: string;
  project_id: string;
  params: Record<string, string>;
  status: string;
  progress?: number;
  output_path?: string;
  error?: string;
}

export interface BatchResponse {
  batch_id: string;
  total: number;
  jobs: BatchJobInfo[];
}

export interface BatchStatusResponse {
  batch_id: string;
  template_id: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  jobs: BatchJobInfo[];
  created_at: number;
}

export interface SSEEvent {
  type: "connected" | "progress" | "complete" | "error" | "cancelled";
  job_id: string;
  status?: string;
  progress?: number;
  step?: string;
  message?: string;
  output_path?: string;
  error?: string;
}
