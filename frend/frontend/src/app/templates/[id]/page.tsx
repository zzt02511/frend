"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

function TemplateEditorSkeleton() {
  return (
    <div style={{ display: "flex", gap: "24px", height: "100%" }}>
      <div style={{ flex: 1, maxWidth: "480px" }}>
        <div style={{ height: "24px", width: "40%", background: "var(--bg-card)", borderRadius: "var(--border-radius)", marginBottom: "20px" }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: "60px", background: "var(--bg-card)", borderRadius: "var(--border-radius)", marginBottom: "12px" }} />
        ))}
      </div>
      <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: "var(--border-radius-lg)" }} />
    </div>
  );
}

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const { data: template, isLoading, error } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => apiClient.getTemplate(templateId),
  });

  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Initialize form values when template loads
  React.useEffect(() => {
    if (template) {
      const initial: Record<string, string> = {};
      for (const p of template.parameters) {
        initial[p.name] = p.default || "";
      }
      setFormValues(initial);
    }
  }, [template]);

  const createProject = useMutation({
    mutationFn: () => apiClient.createProject(templateId, formValues),
    onSuccess: (project) => {
      router.push(`/projects/${project.project_id}`);
    },
  });

  if (isLoading) return <TemplateEditorSkeleton />;
  if (error || !template) {
    return (
      <EmptyState
        icon="?"
        title="模板加载失败"
        description={error instanceof Error ? error.message : "请确认模板 ID 是否正确"}
        action={
          <Button variant="secondary" size="sm" onClick={() => router.push("/templates")}>
            返回模板库
          </Button>
        }
      />
    );
  }

  const hasRequiredUnfilled = template.parameters
    .filter((p) => p.required)
    .some((p) => !formValues[p.name]?.trim());

  return (
    <div style={{ display: "flex", gap: "24px", height: "100%", flexWrap: "wrap" }}>
      {/* Left: Editor */}
      <div style={{ flex: 1, minWidth: "320px", maxWidth: "520px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>{template.name}</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            v{template.version} · {template.video.width}x{template.video.height} · {template.scenes.length} 场景
          </p>
        </div>

        <Card>
          {template.parameters.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "12px" }}>
              此模板无需参数，可直接创建项目
            </p>
          ) : (
            template.parameters.map((param) => (
              <div key={param.name} style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                  }}
                >
                  {param.label}
                  {param.required && (
                    <span style={{ color: "var(--accent-error)" }}> *</span>
                  )}
                </label>

                {param.type === "select" ? (
                  <select
                    value={formValues[param.name] || ""}
                    onChange={(e) =>
                      setFormValues({ ...formValues, [param.name]: e.target.value })
                    }
                    style={{ width: "100%" }}
                  >
                    {param.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : param.type === "textarea" ? (
                  <textarea
                    placeholder={param.placeholder}
                    value={formValues[param.name] || ""}
                    onChange={(e) =>
                      setFormValues({ ...formValues, [param.name]: e.target.value })
                    }
                    style={{ width: "100%", minHeight: "80px", resize: "vertical" }}
                    maxLength={param.max_length}
                  />
                ) : param.type === "color" ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={formValues[param.name] || "#ffffff"}
                      onChange={(e) =>
                        setFormValues({ ...formValues, [param.name]: e.target.value })
                      }
                      style={{ width: "40px", height: "36px", padding: "2px", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={formValues[param.name] || ""}
                      onChange={(e) =>
                        setFormValues({ ...formValues, [param.name]: e.target.value })
                      }
                      placeholder={param.placeholder}
                      style={{ flex: 1 }}
                    />
                  </div>
                ) : (
                  <input
                    type={param.type === "number" ? "number" : "text"}
                    placeholder={param.placeholder}
                    value={formValues[param.name] || ""}
                    onChange={(e) =>
                      setFormValues({ ...formValues, [param.name]: e.target.value })
                    }
                    style={{ width: "100%" }}
                    maxLength={param.max_length}
                  />
                )}

                {param.hint && (
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {param.hint}
                  </p>
                )}
              </div>
            ))
          )}

          <div style={{ marginTop: template.parameters.length > 0 ? "20px" : "0" }}>
            <Button
              onClick={() => createProject.mutate()}
              disabled={createProject.isPending || hasRequiredUnfilled}
              loading={createProject.isPending}
              size="lg"
              style={{ width: "100%" }}
            >
              创建项目
            </Button>
          </div>

          {createProject.isError && (
            <p style={{ color: "var(--accent-error)", marginTop: "8px", fontSize: "12px" }}>
              创建失败: {createProject.error?.message}
            </p>
          )}
        </Card>
      </div>

      {/* Right: Preview */}
      <div style={{ flex: 1, minWidth: "280px" }}>
        <Card style={{ minHeight: "400px", display: "flex", flexDirection: "column" }}>
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
            <p style={{ fontSize: "48px", marginBottom: "8px" }}>?</p>
            <p>场景预览</p>
            <p style={{ fontSize: "12px", marginTop: "4px" }}>
              {template.video.width}x{template.video.height} · {template.scenes.length} 个场景
            </p>
          </div>

          {/* Scene list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "auto" }}>
            {template.scenes.map((scene, i) => (
              <div
                key={scene.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--bg-hover)",
                }}
              >
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "12px", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {scene.id}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {scene.duration}s
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                  {scene.transition?.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
