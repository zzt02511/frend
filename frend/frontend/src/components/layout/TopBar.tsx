"use client";

import React, { useState, useEffect } from "react";
import { ApiKeyModal, getLLMConfig } from "@/components/settings/ApiKeyModal";

interface TopBarProps {
  title?: string;
  onMenuClick?: () => void;
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const [showApiModal, setShowApiModal] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setHasKey(!!getLLMConfig()?.apiKey);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [showApiModal]);

  return (
    <>
      <header
        style={{
          height: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          paddingLeft: isMobile ? "16px" : "24px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isMobile && (
            <button
              onClick={onMenuClick}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "20px",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              =
            </button>
          )}
          <h2 style={{ fontSize: "16px", fontWeight: 600, whiteSpace: "nowrap" }}>
            {title || "Frend 短视频工厂"}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={() => setShowApiModal(true)}
            style={{
              padding: "6px 14px",
              background: "var(--bg-input)",
              color: hasKey ? "var(--accent-success)" : "var(--text-secondary)",
              borderRadius: "var(--border-radius)",
              fontSize: "12px",
              border: `1px solid ${hasKey ? "var(--accent-success)" : "var(--border-color)"}`,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {hasKey ? "API" : "API 设置"}
          </button>
        </div>
      </header>

      <ApiKeyModal open={showApiModal} onClose={() => setShowApiModal(false)} />
    </>
  );
}
