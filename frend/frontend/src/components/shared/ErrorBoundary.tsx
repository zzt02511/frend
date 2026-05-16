"use client";

import React from "react";

/**
 * 错误边界 - 捕获渲染异常
 */
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "var(--accent-error)",
            }}
          >
            <p style={{ fontSize: "14px", marginBottom: "8px" }}>组件渲染异常</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {this.state.error?.message || "未知错误"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                marginTop: "12px",
                padding: "6px 16px",
                background: "var(--accent-primary)",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
