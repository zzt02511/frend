"use client";

import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  defaultMessage: string;
  liveSurface?: boolean;
};

function messageFor(error: Error, defaultMessage: string, liveSurface: boolean) {
  if (error.message === "LIVE_NOT_FOUND") return liveSurface ? "该直播间不存在、已删除或链接已失效。" : "暂无可用的直播间。";
  if (error.message === "AUTH_REQUIRED") return "登录状态已失效，请重新登录后再访问。";
  if (error.message === "USER_NOT_FOUND_OR_DISABLED") return "当前账号已停用或已到期，请退出后重新登录。";
  if (error.message === "AUTH_INSUFFICIENT_ROLE" || error.message === "AUTH_TENANT_ACCESS_DENIED") return "当前账号没有访问此页面或直播间的权限，请使用正确账号重新登录。";
  if (error.message.includes("Failed to find Server Action")) return "页面版本已更新，请刷新页面后重试。";
  return defaultMessage;
}

export function PageRecoveryError({ error, reset, title, defaultMessage, liveSurface = false }: Props) {
  const sessionIssue = ["AUTH_REQUIRED", "USER_NOT_FOUND_OR_DISABLED", "TENANT_NOT_ACTIVE", "AUTH_SESSION_REVOKED", "AUTH_INSUFFICIENT_ROLE", "AUTH_TENANT_ACCESS_DENIED"].includes(error.message);
  const stalePage = error.message.includes("Failed to find Server Action");
  const retry = () => {
    if (stalePage) {
      window.location.assign(`${window.location.pathname}?reload=${Date.now()}`);
      return;
    }
    reset();
  };

  return <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-4 text-center"><h1 className="text-xl font-bold">{sessionIssue ? title : "登录状态需要更新"}</h1><p className="text-sm text-muted-foreground">{sessionIssue ? messageFor(error, defaultMessage, liveSurface) : "请重新登录后继续使用主播端或管理后台。"}</p><SignOutButton label="重新登录" />{stalePage ? <Button variant="outline" onClick={retry}>刷新页面</Button> : null}</main>;
}
