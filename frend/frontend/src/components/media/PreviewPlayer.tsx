"use client";

import React, { useRef, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface PreviewPlayerProps {
  /** 作业 ID，用于获取视频下载地址 */
  jobId?: string;
  /** 直接视频路径（优先于 jobId） */
  src?: string;
  /** 视频标题 */
  title?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自动播放 */
  autoPlay?: boolean;
  /** 是否显示控制条 */
  controls?: boolean;
}

/**
 * 视频预览播放器组件
 * - 支持通过 jobId 自动拼接下载 URL
 * - 支持直接 src 路径
 * - 带状态显示（加载中/无视频/错误）
 */
export function PreviewPlayer({
  jobId,
  src,
  title,
  style,
  autoPlay = false,
  controls = true,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "empty">(
    src || jobId ? "loading" : "empty"
  );
  const [errorMsg, setErrorMsg] = useState("");

  // 生成视频 URL
  const videoSrc =
    src || (jobId ? apiClient.getDownloadUrl(jobId) : "");

  useEffect(() => {
    if (!videoSrc) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => setStatus("ready");
    const handleError = () => {
      setStatus("error");
      setErrorMsg(
        video.error?.message || "视频加载失败，请确认渲染已完成"
      );
    };
    const handleLoaded = () => {
      // 检查视频是否有效
      if (video.videoWidth === 0 && video.videoHeight === 0) {
        setStatus("error");
        setErrorMsg("视频文件无效");
      }
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.addEventListener("loadedmetadata", handleLoaded);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadedmetadata", handleLoaded);
    };
  }, [videoSrc]);

  // 容器样式
  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: "400px",
    aspectRatio: "9 / 16",
    background: "#000",
    borderRadius: "12px",
    overflow: "hidden",
    ...style,
  };

  // 状态覆盖层样式
  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "#888",
    fontSize: "13px",
    background: "rgba(0,0,0,0.5)",
  };

  return (
    <div style={containerStyle}>
      {title && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "8px 12px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 600,
            zIndex: 2,
          }}
        >
          {title}
        </div>
      )}

      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay={autoPlay}
        controls={controls}
        preload="metadata"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: status === "ready" ? "block" : "none",
        }}
        playsInline
      />

      {status === "loading" && (
        <div style={overlayStyle}>
          <div
            style={{
              width: "32px",
              height: "32px",
              border: "3px solid #333",
              borderTopColor: "var(--accent-primary, #667eea)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span>加载中...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {status === "error" && (
        <div style={overlayStyle}>
          <span style={{ fontSize: "24px" }}>!</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {status === "empty" && (
        <div style={overlayStyle}>
          <span style={{ fontSize: "24px", opacity: 0.5 }}>?</span>
          <span>暂无视频</span>
          <span style={{ fontSize: "11px", opacity: 0.6 }}>
            提交渲染后在此处预览
          </span>
        </div>
      )}
    </div>
  );
}
