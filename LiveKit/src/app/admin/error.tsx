"use client";

import { PageRecoveryError } from "@/components/page-recovery-error";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageRecoveryError error={error} reset={reset} title="管理后台暂时无法访问" defaultMessage="加载管理后台时发生错误，请稍后重试。" />;
}
