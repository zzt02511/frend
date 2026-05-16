"use client";

import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
  href?: string;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, var(--accent-primary), #ff6b6b)",
    color: "#fff",
    border: "none",
  },
  secondary: {
    background: "var(--bg-hover)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
  },
  danger: {
    background: "transparent",
    color: "var(--accent-error)",
    border: "1px solid var(--accent-error)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: "4px 12px", fontSize: "12px", borderRadius: "6px" },
  md: { padding: "8px 20px", fontSize: "13px", borderRadius: "var(--border-radius)" },
  lg: { padding: "10px 24px", fontSize: "14px", borderRadius: "var(--border-radius)" },
};

/**
 * 通用按钮组件
 */
export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  type = "button",
  style,
  href,
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    fontWeight: 600,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  if (href) {
    return (
      <a href={href} style={baseStyle}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={baseStyle}
    >
      {loading && (
        <span
          style={{
            width: "14px",
            height: "14px",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
            display: "inline-block",
          }}
        />
      )}
      {children}
    </button>
  );
}
