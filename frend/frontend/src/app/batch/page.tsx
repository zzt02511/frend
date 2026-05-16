"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { BatchProgress } from "@/components/batch/BatchProgress";
import type { TemplateSummary } from "@/lib/api-types";

type InputMode = "json" | "csv";

export default function BatchPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [mode, setMode] = useState<InputMode>("csv");
  const [csvText, setCsvText] = useState("topic,tone\n量子计算,轻松\n人工智能,专业");
  const [jsonText, setJsonText] = useState("");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [allDone, setAllDone] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    apiClient.getTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  const parseJsonToParams = (): Record<string, string>[] | null => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setError("JSON 必须是数组格式");
        return null;
      }
      return parsed;
    } catch {
      setError("JSON 格式错误");
      return null;
    }
  };

  const parseCsvToParams = (): Record<string, string>[] | null => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      setError("CSV 至少需要标题行和一行数据");
      return null;
    }
    const headers = lines[0].split(",").map(h => h.trim());
    const params: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (idx < values.length) row[h] = values[idx];
      });
      params.push(row);
    }
    if (params.length === 0) {
      setError("CSV 没有有效的数据行");
      return null;
    }
    return params;
  };

  const handleSubmit = async () => {
    setError("");
    setBatchId(null);
    setAllDone(false);

    if (!selectedTemplate) {
      setError("请选择模板");
      return;
    }

    const params = mode === "json" ? parseJsonToParams() : parseCsvToParams();
    if (!params) return;

    if (params.length > 50) {
      setError("批量最多支持 50 个视频");
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.createBatchJson(selectedTemplate, params);
      setBatchId(result.batch_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = (completed: number) => {
    setAllDone(true);
    setCompletedCount(completed);
  };

  if (templatesLoading) {
    return <LoadingSpinner fullPage text="加载模板列表..." />;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
        批量生成
      </h1>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
        一次导入多个参数，批量渲染短视频
      </p>

      {/* 模板选择 */}
      <Card>
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
          选择模板
        </h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--border-radius)",
                border: `1px solid ${selectedTemplate === t.id ? "var(--accent-primary)" : "var(--border-color)"}`,
                background: selectedTemplate === t.id ? "var(--accent-primary-muted)" : "transparent",
                color: selectedTemplate === t.id ? "var(--accent-primary)" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: "13px",
                transition: "all 0.15s",
              }}
            >
              {t.name}
            </button>
          ))}
          {templates.length === 0 && (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>暂无可用模板</p>
          )}
        </div>
      </Card>

      {/* 输入模式切换 */}
      <div style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", gap: "0", marginBottom: "12px" }}>
          <button
            onClick={() => setMode("csv")}
            style={{
              padding: "6px 16px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px 0 0 6px",
              background: mode === "csv" ? "var(--accent-primary)" : "var(--bg-input)",
              color: mode === "csv" ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            CSV 导入
          </button>
          <button
            onClick={() => setMode("json")}
            style={{
              padding: "6px 16px",
              border: "1px solid var(--border-color)",
              borderLeft: "none",
              borderRadius: "0 6px 6px 0",
              background: mode === "json" ? "var(--accent-primary)" : "var(--bg-input)",
              color: mode === "json" ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            JSON 导入
          </button>
        </div>

        <Card>
          {mode === "csv" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600 }}>
                  CSV 参数
                </h3>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  第一行为列名，每行一个视频
                </span>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={8}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600 }}>
                  JSON 参数
                </h3>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  对象数组，每项一组参数
                </span>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={8}
                placeholder='[{"topic": "AI", "tone": "专业"}, {"topic": "云计算", "tone": "轻松"}]'
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
            </>
          )}
        </Card>
      </div>

      {/* 提交按钮 */}
      <div style={{ marginTop: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
        <Button
          variant="primary"
          disabled={loading || !selectedTemplate}
          onClick={handleSubmit}
        >
          {loading ? "提交中..." : "开始批量生成"}
        </Button>
        {error && (
          <span style={{ color: "var(--accent-danger)", fontSize: "13px" }}>{error}</span>
        )}
      </div>

      {/* 进度面板 */}
      {batchId && (
        <>
          <BatchProgress
            batchId={batchId}
            onComplete={handleComplete}
          />

          {/* 下载按钮 */}
          {allDone && completedCount > 0 && (
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <a
                href={apiClient.getBatchDownloadUrl(batchId)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <Button variant="primary">
                  下载 ZIP 归档 ({completedCount} 个视频)
                </Button>
              </a>
            </div>
          )}

          {allDone && completedCount === 0 && (
            <EmptyState
              title="全部失败"
              description="所有视频渲染失败，请检查参数"
            />
          )}
        </>
      )}

      {/* 初始空状态 */}
      {!batchId && !loading && (
        <div style={{ marginTop: "24px" }}>
          <EmptyState
            title="准备批量生成"
            description="选择模板并输入参数后开始"
            icon="+"
          />
        </div>
      )}
    </div>
  );
}
