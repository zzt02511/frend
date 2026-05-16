"use client";

import React, { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useSSE } from "@/lib/hooks/useSSE";
import { PreviewPlayer } from "@/components/media/PreviewPlayer";
import type { JobResponse, SSEEvent } from "@/lib/api-types";

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.getProject(projectId),
  });

  const [job, setJob] = useState<JobResponse | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // SSE event handler
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (event.type === "progress") {
      setJob((prev) =>
        prev ? { ...prev, progress: event.progress ?? 0, current_step: event.step ?? "", message: event.message ?? "" } : prev
      );
    } else if (event.type === "complete") {
      setJob((prev) =>
        prev ? { ...prev, status: "completed", progress: 1, output_path: event.output_path ?? "" } : prev
      );
      setIsRendering(false);
    } else if (event.type === "error") {
      setJob((prev) =>
        prev ? { ...prev, status: "failed", error: event.error ?? "" } : prev
      );
      setIsRendering(false);
    } else if (event.type === "cancelled") {
      setJob((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      setIsRendering(false);
    }
  }, []);

  useSSE(job?.job_id ?? null, {
    onEvent: handleSSEEvent,
    enabled: !!job && (job.status === "queued" || job.status === "running"),
  });

  const handleStartRender = async () => {
    setIsRendering(true);
    try {
      const result = await apiClient.submitRender(projectId);
      setJob({
        job_id: result.job_id,
        project_id: projectId,
        template_id: project?.template_id ?? "",
        status: "queued",
        progress: 0,
        current_step: "pending",
        message: "排队中...",
        output_path: "",
        error: "",
        created_at: Date.now() / 1000,
      });
    } catch {
      setIsRendering(false);
    }
  };

  const handleCancel = async () => {
    if (job) {
      await apiClient.cancelJob(job.job_id);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
        加载中...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
        <p style={{ fontSize: "24px" }}>😿</p>
        <p>项目不存在</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "var(--text-muted)",
    rendering: "var(--accent-secondary)",
    completed: "var(--accent-success)",
    failed: "var(--accent-error)",
  };

  return (
    <div>
      {/* Project Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
            {project.template_name || project.template_id}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {project.project_id}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              background: `${statusColors[project.status] || "#666"}20`,
              color: statusColors[project.status] || "var(--text-secondary)",
            }}
          >
            {project.status}
          </span>
        </div>
      </div>

      {/* Project Params */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--border-radius-lg)",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
          参数配置
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {Object.entries(project.params).map(([key, value]) => (
            <div
              key={key}
              style={{
                background: "var(--bg-hover)",
                padding: "4px 12px",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>{key}: </span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Render Controls */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--border-radius-lg)",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
          渲染控制
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleStartRender}
            disabled={isRendering}
            style={{
              padding: "10px 24px",
              background: isRendering
                ? "var(--text-muted)"
                : "linear-gradient(135deg, var(--accent-primary), #ff6b6b)",
              color: "#fff",
              borderRadius: "var(--border-radius)",
              fontSize: "14px",
              fontWeight: 600,
              opacity: isRendering ? 0.7 : 1,
            }}
          >
            {isRendering ? "渲染中..." : "生成视频"}
          </button>

          {job && (job.status === "queued" || job.status === "running") && (
            <button
              onClick={handleCancel}
              style={{
                padding: "10px 24px",
                background: "transparent",
                color: "var(--accent-error)",
                borderRadius: "var(--border-radius)",
                fontSize: "14px",
                border: "1px solid var(--accent-error)",
              }}
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* Job Progress */}
      {job && job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--border-radius-lg)",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {job.current_step || "pending"}
            </span>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {Math.round((job.progress || 0) * 100)}%
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "6px",
              background: "var(--bg-hover)",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(job.progress || 0) * 100}%`,
                background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
                borderRadius: "3px",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          {job.message && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              {job.message}
            </p>
          )}
        </div>
      )}

      {/* Completed - 视频预览 */}
      {job?.status === "completed" && job.job_id && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--border-radius-lg)",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <PreviewPlayer
              jobId={job.job_id}
              title={project.template_id}
              controls
            />
            <div style={{ flex: 1, minWidth: "200px" }}>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                渲染完成
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginBottom: "16px",
                }}
              >
                视频已就绪，可在浏览器中预览或下载
              </p>
              <a
                href={apiClient.getDownloadUrl(job.job_id)}
                download
                style={{
                  display: "inline-block",
                  padding: "8px 20px",
                  background: "linear-gradient(135deg, var(--accent-primary), #ff6b6b)",
                  color: "#fff",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                下载视频
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Failed */}
      {job?.status === "failed" && (
        <div
          style={{
            background: "rgba(255, 82, 82, 0.06)",
            border: "1px solid var(--accent-error)",
            borderRadius: "var(--border-radius-lg)",
            padding: "20px",
          }}
        >
          <p style={{ color: "var(--accent-error)", fontWeight: 600, marginBottom: "4px" }}>
            渲染失败
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {job.error}
          </p>
        </div>
      )}
    </div>
  );
}
