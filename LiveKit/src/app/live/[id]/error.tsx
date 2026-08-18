"use client";

import { PageRecoveryError } from "@/components/page-recovery-error";

export default function AudienceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageRecoveryError error={error} reset={reset} title="直播间暂时无法打开" defaultMessage="加载直播间时发生错误，请稍后重试。" liveSurface />;
}
