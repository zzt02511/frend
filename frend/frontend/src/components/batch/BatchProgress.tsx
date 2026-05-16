"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { BatchJobInfo } from "@/lib/api-types";

interface BatchProgressProps {
  batchId: string;
  onComplete: (completed: number, failed: number) => void;
}

export function BatchProgress({ batchId, onComplete }: BatchProgressProps) {
  const [jobs, setJobs] = useState<BatchJobInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);

  const poll = useCallback(async () => {
    try {
      const status = await apiClient.getBatchStatus(batchId);
      setJobs(status.jobs);
      setTotal(status.total);
      setCompleted(status.completed);
      setFailed(status.failed);
      if (status.completed + status.failed === status.total) {
        onComplete(status.completed, status.failed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [batchId, onComplete]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, 1500);
    poll(); // immediate first poll
    return () => clearInterval(interval);
  }, [poll]);

  const progress = total > 0 ? ((completed + failed) / total) * 100 : 0;

  return (
    <div style={{ marginTop: "24px" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
        批量渲染进度
      </h3>

      {/* 进度条 */}
      <div
        style={{
          height: "8px",
          background: "var(--bg-input)",
          borderRadius: "4px",
          overflow: "hidden",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(progress, 100)}%`,
            background: failed > 0
              ? "linear-gradient(90deg, var(--accent-primary), var(--accent-danger))"
              : "var(--accent-primary)",
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
        {completed}/{total} 完成
        {failed > 0 && `, ${failed} 失败`}
        {completed + failed < total && `, ${total - completed - failed} 进行中`}
      </p>

      {/* 作业列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {jobs.map((job) => (
          <div
            key={job.job_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              background: "var(--bg-input)",
              borderRadius: "var(--border-radius)",
              fontSize: "13px",
            }}
          >
            {/* 状态指示器 */}
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                flexShrink: 0,
                background:
                  job.status === "completed" ? "var(--accent-success)" :
                  job.status === "failed" || job.status === "cancelled" ? "var(--accent-danger)" :
                  job.status === "running" ? "var(--accent-primary)" :
                  "var(--text-muted)",
              }}
            />

            {/* 参数信息 */}
            <span style={{ flex: 1, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {Object.values(job.params || {}).join(" | ") || `视频 ${job.index + 1}`}
            </span>

            {/* 状态 */}
            <span
              style={{
                color:
                  job.status === "completed" ? "var(--accent-success)" :
                  job.status === "failed" ? "var(--accent-danger)" :
                  "var(--text-secondary)",
                fontSize: "12px",
                whiteSpace: "nowrap",
              }}
            >
              {job.status === "completed" ? "完成" :
               job.status === "failed" ? "失败" :
               job.status === "running" ? `${Math.round((job.progress || 0) * 100)}%` :
               job.status === "cancelled" ? "已取消" :
               "等待中"}
            </span>

            {/* 错误信息 */}
            {job.error && (
              <span style={{ color: "var(--accent-danger)", fontSize: "11px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {job.error}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
