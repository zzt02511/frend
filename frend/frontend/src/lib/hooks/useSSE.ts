"use client";

import { useEffect, useRef, useCallback } from "react";
import type { SSEEvent } from "@/lib/api-types";

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export function useSSE(jobId: string | null, options: UseSSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { onEvent, onError, enabled = true } = options;

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId || !enabled) return;

    const url = `/api/v1/jobs/${jobId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        onEvent?.(data);

        if (data.type === "complete" || data.type === "error" || data.type === "cancelled") {
          es.close();
        }
      } catch {
        // 忽略解析错误（如心跳包）
      }
    };

    es.onerror = (err) => {
      onError?.(err);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId, enabled, onEvent, onError]);

  return { close };
}
