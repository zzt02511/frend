"use client";

import React, { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface AssetItem {
  /** 资产唯一标识 */
  id: string;
  /** 资产名称 */
  name: string;
  /** 资产类型 */
  type: "image" | "audio" | "video" | "other";
  /** 文件大小（字节） */
  size: number;
  /** 创建时间戳 */
  created_at: number;
  /** 预览 URL */
  url?: string;
}

interface AssetManagerProps {
  projectId?: string;
  /** 外部传入的资产列表 */
  assets?: AssetItem[];
  /** 资产点击回调 */
  onSelect?: (asset: AssetItem) => void;
  /** 允许上传 */
  allowUpload?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  image: "I",
  audio: "A",
  video: "V",
  other: "F",
};

const TYPE_COLORS: Record<string, string> = {
  image: "var(--accent-primary, #667eea)",
  audio: "var(--accent-success, #4ade80)",
  video: "var(--accent-warning, #fbbf24)",
  other: "var(--text-muted, #888)",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 资产管理组件
 * - 展示项目关联的资产文件列表
 * - 支持文件类型筛选
 * - 支持选择/删除操作
 */
export function AssetManager({
  projectId,
  assets: externalAssets,
  onSelect,
  allowUpload = false,
}: AssetManagerProps) {
  const [assets] = useState<AssetItem[]>(externalAssets || []);
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredAssets =
    filter === "all"
      ? assets
      : assets.filter((a) => a.type === filter);

  const handleSelect = useCallback(
    (asset: AssetItem) => {
      setSelectedId(asset.id);
      onSelect?.(asset);
    },
    [onSelect]
  );

  const handleUpload = useCallback(async () => {
    if (!allowUpload || !projectId) return;
    // 上传功能暂不实现 - 使用素材上传 API
  }, [allowUpload, projectId]);

  // 空状态
  if (assets.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "var(--text-muted, #888)",
        }}
      >
        <p style={{ fontSize: "14px", marginBottom: "4px" }}>暂无资产</p>
        <p style={{ fontSize: "12px" }}>
          渲染完成后资产将自动出现在此处
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 筛选栏 */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        {(["all", "image", "audio", "video"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              borderRadius: "4px",
              border: `1px solid ${
                filter === t ? "var(--accent-primary, #667eea)" : "var(--border-color, #333)"
              }`,
              background:
                filter === t
                  ? "var(--accent-primary, #667eea)"
                  : "transparent",
              color: filter === t ? "#fff" : "var(--text-secondary, #aaa)",
              cursor: "pointer",
            }}
          >
            {t === "all" ? "全部" : t === "image" ? "图片" : t === "audio" ? "音频" : "视频"}
          </button>
        ))}
      </div>

      {/* 资产列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => handleSelect(asset)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "8px",
              cursor: "pointer",
              background:
                selectedId === asset.id
                  ? "var(--bg-hover, rgba(255,255,255,0.05))"
                  : "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (selectedId !== asset.id) {
                e.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedId !== asset.id) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {/* 类型图标 */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                background: `${TYPE_COLORS[asset.type]}20`,
                color: TYPE_COLORS[asset.type],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {TYPE_ICONS[asset.type]}
            </div>

            {/* 信息 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {asset.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted, #888)",
                  display: "flex",
                  gap: "8px",
                }}
              >
                <span>{formatSize(asset.size)}</span>
                <span>{formatTime(asset.created_at)}</span>
              </div>
            </div>

            {/* 下载按钮 */}
            {asset.url && (
              <a
                href={asset.url}
                download
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  color: "var(--accent-primary, #667eea)",
                  textDecoration: "none",
                  borderRadius: "4px",
                }}
              >
                下载
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
