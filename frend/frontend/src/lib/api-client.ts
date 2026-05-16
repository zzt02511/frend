// 基于类的 API 客户端 - 参照 Banana 的 MiniMaxAPI 模式

import type {
  TemplateSummary,
  TemplateDetail,
  ProjectResponse,
  RenderResponse,
  JobResponse,
  BatchResponse,
  BatchStatusResponse,
} from "./api-types";

class FrendClient {
  private baseUrl: string;

  constructor(baseUrl = "/api/v1") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      ...init,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  // === 模板 ===
  async getTemplates(): Promise<TemplateSummary[]> {
    return this.request("/templates");
  }

  async getTemplate(id: string): Promise<TemplateDetail> {
    return this.request(`/templates/${id}`);
  }

  // === 项目 ===
  async createProject(
    templateId: string,
    params: Record<string, string> = {}
  ): Promise<ProjectResponse> {
    return this.request("/projects", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, params }),
    });
  }

  async getProjects(): Promise<ProjectResponse[]> {
    return this.request("/projects");
  }

  async getProject(id: string): Promise<ProjectResponse> {
    return this.request(`/projects/${id}`);
  }

  // === 渲染 ===
  async submitRender(projectId: string): Promise<RenderResponse> {
    return this.request(`/projects/${projectId}/render`, {
      method: "POST",
    });
  }

  async getJobs(): Promise<JobResponse[]> {
    return this.request("/jobs");
  }

  async getJob(id: string): Promise<JobResponse> {
    return this.request(`/jobs/${id}`);
  }

  async cancelJob(id: string): Promise<void> {
    await this.request(`/jobs/${id}/cancel`, { method: "POST" });
  }

  getJobStreamUrl(jobId: string): string {
    return `${this.baseUrl}/jobs/${jobId}/stream`;
  }

  getDownloadUrl(jobId: string): string {
    return `${this.baseUrl}/jobs/${jobId}/download`;
  }

  // === 批量生成 ===
  async createBatchJson(
    templateId: string,
    paramsList: Record<string, string>[]
  ): Promise<BatchResponse> {
    return this.request("/batch/json", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, params_list: paramsList }),
    });
  }

  async createBatchCsv(
    templateId: string,
    csvContent: string
  ): Promise<BatchResponse> {
    return this.request("/batch/csv", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, csv_content: csvContent }),
    });
  }

  async getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
    return this.request(`/batch/${batchId}`);
  }

  getBatchDownloadUrl(batchId: string): string {
    return `${this.baseUrl}/batch/${batchId}/download`;
  }
}

export const apiClient = new FrendClient();
