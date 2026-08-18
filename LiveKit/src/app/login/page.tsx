"use client";

import { Suspense, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const callbackUrl = params.get("callbackUrl") || "/admin";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
    // WeChat's WebView can retain an earlier role cookie. Always replace it before issuing new credentials.
    await signOut({ redirect: false });
    const result = await signIn("credentials", { userId, password, redirect: false, callbackUrl });
    if (result?.error) { setMessage("账号或口令错误，或账号已禁用/到期。"); setLoading(false); return; }
    setLoading(false);
    if (!result?.ok) { setMessage("账号、口令无效，或账号已禁用/到期。"); return; }
    const destination = callbackUrl.startsWith("/") ? callbackUrl : "/admin";
    window.location.replace(`${destination}${destination.includes("?") ? "&" : "?"}login=${Date.now()}`);
    } catch {
      setMessage("账号或口令错误，或账号已禁用/到期。");
      setLoading(false);
    }
  }

  return <main className="video-grid flex min-h-screen items-center justify-center p-5"><section className="w-full max-w-md rounded-2xl border border-white/15 bg-card/95 p-7 shadow-2xl"><p className="text-sm text-primary">微信私域直播系统</p><h1 className="mt-2 text-3xl font-bold">账号登录</h1><p className="mt-2 text-sm text-muted-foreground">主播、场控、租户管理员和总管理员使用各自账号登录。</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm">账号<input autoComplete="username" required value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="输入账号 ID" className="mt-2 h-11 w-full rounded-md border bg-background px-3" /></label><label className="block text-sm">口令<input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入口令" className="mt-2 h-11 w-full rounded-md border bg-background px-3" /></label>{message ? <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{message}</p> : null}<button disabled={loading} className="h-11 w-full rounded-md bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? "正在登录…" : "登录"}</button></form><p className="mt-5 text-xs text-muted-foreground">账号由平台总管理员或租户管理员创建维护；请勿使用他人账号。</p></section></main>;
}

export default function LoginPage() { return <Suspense fallback={<main className="video-grid min-h-screen" />}><LoginForm /></Suspense>; }
