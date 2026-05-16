"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useSSE } from "@/lib/hooks/useSSE";
import { PreviewPlayer } from "@/components/media/PreviewPlayer";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import type { JobResponse, SSEEvent } from "@/lib/api-types";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  queued: { bg: "var(--bg-hover)", color: "var(--text-muted)" },
  running: { bg: "rgba(0,212,255,0.15)", color: "var(--accent-secondary)" },
  completed: { bg: "rgba(0,230,118,0.15)", color: "var(--accent-success)" },
  failed: { bg: "rgba(255,82,82,0.15)", color: "var(--accent-error)" },
  cancelled: { bg: "var(--bg-hover)", color: "var(--text-muted)" },
};

function JobCard({ job, onCancel }: { job: JobResponse; onCancel: (id: string) => void }) {
  const [localJob, setLocalJob] = useState(job);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (event.type === "progress") {
      setLocalJob((prev) => ({
        ...prev,
        progress: event.progress ?? prev.progress,
        current_step: event.step ?? prev.current_step,
        message: event.message ?? "",
      }));
    } else if (event.type === "complete") {
      setLocalJob((prev) => ({ ...prev, status: "completed", progress: 1 }));
    } else if (event.type === "error") {
      setLocalJob((prev) => ({ ...prev, status: "failed", error: event.error ?? "" }));
    } else if (event.type === "cancelled") {
      setLocalJob((prev) => ({ ...prev, status: "cancelled" }));
    }
  }, []);

  useSSE(job.job_id, {
    onEvent: handleSSEEvent,
    enabled: job.status === "queued" || job.status === "running",
  });

  const isActive = localJob.status === "queued" || localJob.status === "running";
  const s = STATUS_STYLES[localJob.status] || STATUS_STYLES.queued;

  return (
    <Card padding="16px 20px">
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Status icon */}
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: s.bg,
            color: s.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {localJob.status === "completed" ? "V" :
           localJob.status === "failed" ? "X" :
           localJob.status === "cancelled" ? "-" :
           isActive ? "~" : "?"}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontWeight: 500, fontSize: "13px" }}>{localJob.job_id}</span>
            <span
              style={{
                padding: "1px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                background: s.bg,
                color: s.color,
              }}
            >
              {localJob.status}
            </span>
          </div>
          {isActive && localJob.current_step && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {localJob.current_step}
            </p>
          )}
          {localJob.error && (
            <p style={{ fontSize: "11px", color: "var(--accent-error)", marginTop: "2px" }}>
              {localJob.error}
            </p>
          )}
        </div>

        {/* Progress bar (active only) */}
        {isActive && (
          <div style={{ width: "120px" }}>
            <div
              style={{
                height: "4px",
                background: "var(--bg-hover)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(localJob.progress || 0) * 100}%`,
                  background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
                  borderRadius: "2px",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", textAlign: "right" }}>
              {Math.round((localJob.progress || 0) * 100)}%
            </p>
          </div>
        )}

        {/* Cancel button */}
        {isActive && (
          <Button variant="danger" size="sm" onClick={() => onCancel(localJob.job_id)}>
            取消
          </Button>
        )}

        {/* Completed preview */}
        {localJob.status === "completed" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <PreviewPlayer
              jobId={localJob.job_id}
              style={{ width: "80px", aspectRatio: "9/16", borderRadius: "6px" }}
              controls={false}
            />
            <Button
              variant="secondary"
              size="sm"
              href={apiClient.getDownloadUrl(localJob.job_id)}
            >
              下载
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => apiClient.getJobs(),
    refetchInterval: 5000,
  });

  const handleCancel = async (jobId: string) => {
    await apiClient.cancelJob(jobId);
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };

  if (isLoading) return <LoadingSpinner fullPage text="加载渲染队列..." />;

  if (!jobs || jobs.length === 0) {
    return (
      <EmptyState
        title="暂无渲染任务"
        description="在项目中提交渲染后，这里将显示进度"
        action={
          <Button variant="primary" size="sm" onClick={() => router.push("/templates")}>
            创建项目
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
        渲染队列
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {jobs.map((job) => (
          <JobCard key={job.job_id} job={job} onCancel={handleCancel} />
        ))}
      </div>
    </div>
  );
}
