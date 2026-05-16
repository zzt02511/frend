"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hover?: boolean;
  onClick?: () => void;
  padding?: string;
}

/**
 * 通用卡片容器 - 替代内联 style 重复
 */
export function Card({ children, style, hover, onClick, padding = "20px" }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--border-radius-lg)",
        padding,
        border: "1px solid var(--border-color)",
        transition: hover ? "all 0.2s ease" : undefined,
        cursor: onClick ? "pointer" : undefined,
        ...(hover
          ? {
              "--hover-bg": "var(--bg-hover)",
            } as React.CSSProperties
          : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hover) e.currentTarget.style.borderColor = "var(--accent-primary)";
      }}
      onMouseLeave={(e) => {
        if (hover) e.currentTarget.style.borderColor = "var(--border-color)";
      }}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
      }}
    >
      <div>
        <h3 style={{ fontSize: "14px", fontWeight: 600 }}>{title}</h3>
        {subtitle && (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
