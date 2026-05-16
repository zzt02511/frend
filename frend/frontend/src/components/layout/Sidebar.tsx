"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { path: "/templates", label: "模板库", icon: "?" },
  { path: "/projects", label: "我的项目", icon: "#" },
  { path: "/jobs", label: "渲染队列", icon: "~" },
  { path: "/batch", label: "批量生成", icon: "+" },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isCollapsed = isMobile ? collapsed : false;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && !collapsed && (
        <div
          onClick={onToggle}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}

      <aside
        style={{
          width: isCollapsed ? "0px" : "var(--sidebar-width)",
          minWidth: isCollapsed ? "0px" : "var(--sidebar-width)",
          background: "var(--bg-secondary)",
          borderRight: isCollapsed ? "none" : "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          padding: isCollapsed ? "0" : "16px 0",
          overflow: "hidden",
          transition: "all var(--transition-normal)",
          position: isMobile ? "fixed" : "relative",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "0 20px 20px",
            borderBottom: isCollapsed ? "none" : "1px solid var(--border-color)",
            marginBottom: isCollapsed ? "0" : "12px",
            opacity: isCollapsed ? 0 : 1,
            whiteSpace: "nowrap",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Frend
          </h1>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            DEERFLOW 短视频工厂
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  router.push(item.path);
                  if (isMobile && onToggle) onToggle();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: isCollapsed ? "10px 0" : "10px 20px",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  background: isActive ? "var(--bg-hover)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  borderLeft: isActive ? "3px solid var(--accent-primary)" : "3px solid transparent",
                  fontSize: "14px",
                  textAlign: "left",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span style={{ opacity: isCollapsed ? 0 : 1 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: isCollapsed ? "0" : "12px 20px",
            borderTop: isCollapsed ? "none" : "1px solid var(--border-color)",
            fontSize: "11px",
            color: "var(--text-muted)",
            opacity: isCollapsed ? 0 : 1,
            whiteSpace: "nowrap",
          }}
        >
          v0.1.0
        </div>
      </aside>
    </>
  );
}
