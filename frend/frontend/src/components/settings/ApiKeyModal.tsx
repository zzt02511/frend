"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

type LLMProvider = {
  id: string;
  name: string;
  baseUrl: string;
  keyPlaceholder: string;
};

const PROVIDERS: LLMProvider[] = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", keyPlaceholder: "sk-..." },
  { id: "siliconflow", name: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1", keyPlaceholder: "sf-..." },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyPlaceholder: "sk-..." },
  { id: "custom", name: "自定义", baseUrl: "", keyPlaceholder: "输入 API Key" },
];

const STORAGE_KEY = "frend_llm_config";

interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function loadConfig(): LLMConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: LLMConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 获取保存的 LLM 配置（外部使用）
 */
export function getLLMConfig(): LLMConfig | null {
  return loadConfig();
}

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ open, onClose }: ApiKeyModalProps) {
  const [config, setConfig] = useState<LLMConfig>({ provider: "siliconflow", apiKey: "", baseUrl: "", model: "Qwen/Qwen2.5-7B-Instruct" });
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const existing = loadConfig();
    if (existing) setConfig(existing);
  }, [open]);

  if (!open) return null;

  const selectedProvider = PROVIDERS.find((p) => p.id === config.provider)!;

  const handleSave = () => {
    if (!config.apiKey.trim()) return;
    const finalConfig = {
      ...config,
      baseUrl: config.baseUrl || selectedProvider.baseUrl,
    };
    saveConfig(finalConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    clearConfig();
    setConfig({ provider: "siliconflow", apiKey: "", baseUrl: "", model: "" });
  };

  const handleTest = async () => {
    if (!config.apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const baseUrl = config.baseUrl || selectedProvider.baseUrl;
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5,
        }),
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: "连接成功！" });
      } else {
        const data = await res.text();
        setTestResult({ ok: false, msg: `API 错误: ${res.status} ${data.slice(0, 100)}` });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, msg: `连接失败: ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card style={{ width: "440px", maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700 }}>LLM API 配置</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer", padding: "4px" }}
          >
            x
          </button>
        </div>

        {/* Provider selection */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>供应商</label>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setConfig((c) => ({ ...c, provider: p.id, baseUrl: p.id === "custom" ? c.baseUrl : "" }))}
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  background: config.provider === p.id ? "var(--accent-primary)" : "var(--bg-hover)",
                  color: config.provider === p.id ? "#fff" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Base URL (custom only) */}
        {config.provider === "custom" && (
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Base URL</label>
            <input
              value={config.baseUrl}
              onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
              placeholder="https://your-api.com/v1"
              style={{ width: "100%", padding: "8px 12px", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "6px" }}
            />
          </div>
        )}

        {/* API Key */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>API Key</label>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
              placeholder={selectedProvider.keyPlaceholder}
              style={{ flex: 1, padding: "8px 12px", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "6px" }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{ padding: "8px", background: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px" }}
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
        </div>

        {/* Model */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>模型名称</label>
          <input
            value={config.model}
            onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
            placeholder="gpt-3.5-turbo"
            style={{ width: "100%", padding: "8px 12px", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "6px" }}
          />
        </div>

        {/* Test result */}
        {testResult && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              marginBottom: "12px",
              fontSize: "12px",
              background: testResult.ok ? "rgba(0,230,118,0.1)" : "rgba(255,82,82,0.1)",
              color: testResult.ok ? "var(--accent-success)" : "var(--accent-error)",
            }}
          >
            {testResult.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={handleTest} loading={testing} disabled={!config.apiKey.trim()}>
            测试连接
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={!loadConfig()}>
            清除
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!config.apiKey.trim()}>
            {saved ? "已保存" : "保存"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
