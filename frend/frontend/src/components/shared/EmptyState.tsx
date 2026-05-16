"use client";

import React from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * 空状态占位组件
 */
export function EmptyState({ icon = " ", title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "var(--text-muted)",
      }}
    >
      <p style={{ fontSize: "36px", marginBottom: "8px", opacity: 0.6 }}>{icon}</p>
      <p style={{ fontSize: "15px", fontWeight: 500, marginBottom: "4px", color: "var(--text-secondary)" }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: "12px", marginBottom: "16px", maxWidth: "360px", margin: "0 auto 16px" }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
