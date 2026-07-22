"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-bold">页面出错</h1>
      <p className="text-sm text-muted-foreground">
        {error.message === "LIVE_NOT_FOUND"
          ? "暂无可用的直播房间"
          : error.message === "AUTH_REQUIRED"
            ? "请先登录后再访问"
            : "加载管理后台时发生错误，请稍后重试"}
      </p>
      <Button onClick={reset}>重新加载</Button>
    </main>
  );
}
