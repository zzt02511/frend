"use client";

import React from "react";

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  fullPage?: boolean;
}

/**
 * 加载旋转器
 */
export function LoadingSpinner({ size = 32, text, fullPage }: LoadingSpinnerProps) {
  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "40px",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          border: "3px solid var(--border-color)",
          borderTopColor: "var(--accent-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      {text && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{text}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}
