"use client";

import { Button } from "@/components/ui/button";

export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-bold">主播控制台出错</h1>
      <p className="text-sm text-muted-foreground">
        {error.message === "LIVE_NOT_FOUND"
          ? "暂无可用的直播房间，请先在管理后台创建"
          : error.message === "AUTH_REQUIRED"
            ? "请先登录后再访问"
            : "加载主播控制台时发生错误，请稍后重试"}
      </p>
      <Button onClick={reset}>重新加载</Button>
    </main>
  );
}
