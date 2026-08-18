"use client";

import { PageRecoveryError } from "@/components/page-recovery-error";

export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageRecoveryError error={error} reset={reset} title="主播控制台暂时无法访问" defaultMessage="加载主播控制台时发生错误，请稍后重试。" />;
}
