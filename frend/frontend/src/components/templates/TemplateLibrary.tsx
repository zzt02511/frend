"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TemplateSummary } from "@/lib/api-types";

function TemplateCard({
  template,
  onClick,
}: {
  template: TemplateSummary;
  onClick: () => void;
}) {
  const categoryColors: Record<string, string> = {
    knowledge: "var(--accent-secondary)",
    product: "var(--accent-primary)",
    story: "var(--accent-success)",
    tutorial: "var(--accent-warning)",
  };

  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--border-radius-lg)",
        border: "1px solid var(--border-color)",
        padding: "20px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-secondary)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-color)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Preview */}
      <div
        style={{
          width: "100%",
          aspectRatio: "9 / 16",
          background: "linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))",
          borderRadius: "var(--border-radius)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          marginBottom: "4px",
        }}
      >
        🎬
      </div>

      {/* Info */}
      <div>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            marginBottom: "4px",
            color: "var(--text-primary)",
          }}
        >
          {template.name}
        </h3>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: "1.4",
          }}
        >
          {template.description}
        </p>
      </div>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            background: `${categoryColors[template.category] || "#666"}20`,
            color: categoryColors[template.category] || "var(--text-secondary)",
          }}
        >
          {template.category}
        </span>
        <span>{template.scene_count} 场景</span>
        <span>{template.total_duration}s</span>
      </div>
    </button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  knowledge: "知识科普",
  product: "产品推广",
  "talking-head": "口播",
  tutorial: "教程",
  vlog: "Vlog",
  showroom: "展厅销售",
};

export function TemplateLibrary() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ["templates"],
    queryFn: () => apiClient.getTemplates(),
  });

  const categories = React.useMemo(() => {
    if (!templates) return [];
    const cats = new Set(templates.map((t) => t.category));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered =
    templates?.filter((t) => {
      const matchSearch =
        !search ||
        t.name.includes(search) ||
        t.description.includes(search) ||
        t.category.includes(search);
      const matchCategory = !categoryFilter || t.category === categoryFilter;
      return matchSearch && matchCategory;
    }) || [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
            视频模板
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            选择一个模板开始制作短视频
          </p>
        </div>
        <input
          placeholder="搜索模板..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "240px", padding: "8px 12px" }}
        />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setCategoryFilter("")}
            style={{
              padding: "4px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              border: `1px solid ${!categoryFilter ? "var(--accent-primary)" : "var(--border-color)"}`,
              background: !categoryFilter ? "var(--accent-primary-muted)" : "transparent",
              color: !categoryFilter ? "var(--accent-primary)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat === categoryFilter ? "" : cat)}
              style={{
                padding: "4px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                border: `1px solid ${categoryFilter === cat ? "var(--accent-primary)" : "var(--border-color)"}`,
                background:
                  categoryFilter === cat ? "var(--accent-primary-muted)" : "transparent",
                color:
                  categoryFilter === cat ? "var(--accent-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--border-radius-lg)",
                aspectRatio: "9 / 16",
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: "24px", marginBottom: "8px" }}>😿</p>
          <p>加载模板失败</p>
          <p style={{ fontSize: "12px", marginTop: "4px" }}>
            请确认后端服务已启动
          </p>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: "24px", marginBottom: "8px" }}>🔍</p>
          <p>没有找到匹配的模板</p>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onClick={() => router.push(`/templates/${t.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
