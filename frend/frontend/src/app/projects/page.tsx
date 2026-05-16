"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

const statusStyles: Record<string, { bg: string; color: string }> = {
  draft: { bg: "var(--bg-hover)", color: "var(--text-secondary)" },
  rendering: { bg: "rgba(0,212,255,0.15)", color: "var(--accent-secondary)" },
  completed: { bg: "rgba(0,230,118,0.15)", color: "var(--accent-success)" },
  failed: { bg: "rgba(255,82,82,0.15)", color: "var(--accent-error)" },
};

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.getProjects(),
  });

  if (isLoading) return <LoadingSpinner fullPage text="加载项目列表..." />;

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        title="还没有项目"
        description="先去模板库选择一个模板开始制作吧"
        action={
          <Button variant="primary" size="sm" onClick={() => router.push("/templates")}>
            前往模板库
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
        我的项目
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {projects.map((p) => {
          const s = statusStyles[p.status] || statusStyles.draft;
          return (
            <Card
              key={p.project_id}
              hover
              onClick={() => router.push(`/projects/${p.project_id}`)}
              padding="16px 20px"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontWeight: 500, fontSize: "14px" }}>{p.template_name || p.template_id}</p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {p.project_id}
                  </p>
                </div>
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    background: s.bg,
                    color: s.color,
                  }}
                >
                  {p.status}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
