import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getStore, persistStore } from "@/lib/store";
import { SignOutButton } from "@/components/sign-out-button";

function dateLabel(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "永久有效";
}

async function saveTenantDetails(formData: FormData) {
  "use server";
  await requireAuth(["super_admin"]);
  const directorId = String(formData.get("directorId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const status = String(formData.get("status") || "active");
  const password = String(formData.get("password") || "");
  const expiresAtValue = String(formData.get("expiresAt") || "").trim();
  if (!name || !["active", "disabled"].includes(status)) throw new Error("TENANT_INPUT_INVALID");
  const store = getStore();
  const director = store.users.find((user) => user.id === directorId && user.role === "director" && user.tenantId);
  if (!director) throw new Error("TENANT_NOT_FOUND");
  const expiresAt = expiresAtValue ? new Date(`${expiresAtValue}T23:59:59`).toISOString() : undefined;
  const accessChanged = director.status !== status || director.expiresAt !== expiresAt || Boolean(password);
  director.name = name;
  director.status = status as "active" | "disabled";
  director.expiresAt = expiresAt;
  if (password) {
    if (password.length < 8) throw new Error("PASSWORD_TOO_SHORT");
    const { hashPassword } = await import("@/lib/password");
    director.passwordHash = hashPassword(password);
  }
  if (accessChanged) {
    store.users.filter((user) => user.tenantId === director.tenantId).forEach((user) => {
      user.authVersion = (user.authVersion ?? 0) + 1;
    });
  }
  persistStore(store);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/tenants/${directorId}`);
}

async function archiveTenant(formData: FormData) {
  "use server";
  await requireAuth(["super_admin"]);
  const directorId = String(formData.get("directorId") || "").trim();
  const store = getStore();
  const director = store.users.find((user) => user.id === directorId && user.role === "director" && user.tenantId);
  if (!director) throw new Error("TENANT_NOT_FOUND");
  if (store.liveSessions.some((live) => live.tenantId === director.tenantId && live.status === "live")) throw new Error("TENANT_HAS_LIVE_SESSION");
  director.status = "disabled";
  store.users.filter((user) => user.tenantId === director.tenantId).forEach((user) => {
    user.status = "disabled";
    user.authVersion = (user.authVersion ?? 0) + 1;
  });
  store.liveSessions.filter((live) => live.tenantId === director.tenantId && live.status !== "closed").forEach((live) => { live.status = "closed"; });
  persistStore(store);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/tenants/${directorId}`);
  revalidatePath("/admin");
}

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TenantDetailPage({ params }: Props) {
  await requireAuth(["super_admin"]);
  const { id } = await params;
  const store = getStore();
  const tenant = store.users.find((user) => user.id === id && user.role === "director" && user.tenantId);
  if (!tenant) notFound();
  const accounts = store.users.filter((user) => user.tenantId === tenant.tenantId);
  const lives = store.liveSessions.filter((live) => live.tenantId === tenant.tenantId);
  const replays = store.replays.filter((replay) => lives.some((live) => live.id === replay.liveId));

  return <main className="relative min-h-screen bg-background p-6 text-foreground"><div className="absolute right-6 top-6"><SignOutButton /></div><div className="mx-auto max-w-6xl space-y-6"><header className="flex items-center justify-between gap-4"><div><p className="text-sm text-primary">租户详情</p><h1 className="text-3xl font-bold">{tenant.name}</h1><p className="mt-1 font-mono text-sm text-muted-foreground">{tenant.tenantId}</p></div><Link href="/admin/users" className="rounded-md border px-3 py-2 text-sm">返回租户管理</Link></header><section className="grid gap-3 rounded-xl border p-5 md:grid-cols-4"><div><p className="text-xs text-muted-foreground">管理员账号</p><p className="mt-1 font-mono">{tenant.id}</p></div><div><p className="text-xs text-muted-foreground">创建日期</p><p className="mt-1">{dateLabel(tenant.createdAt)}</p></div><div><p className="text-xs text-muted-foreground">到期日期</p><p className="mt-1">{dateLabel(tenant.expiresAt)}</p></div><div><p className="text-xs text-muted-foreground">状态</p><p className="mt-1">{tenant.status === "active" ? "启用" : "已停用"}</p></div></section><section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">编辑租户</h2><form action={saveTenantDetails} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="directorId" value={tenant.id} /><input name="name" required defaultValue={tenant.name} className="rounded-md border bg-transparent p-2" /><select name="status" defaultValue={tenant.status} className="rounded-md border bg-transparent p-2"><option value="active">启用</option><option value="disabled">停用</option></select><input name="expiresAt" type="date" defaultValue={tenant.expiresAt?.slice(0, 10)} className="rounded-md border bg-transparent p-2" /><input name="password" type="password" minLength={8} placeholder="留空不修改管理员口令" className="rounded-md border bg-transparent p-2" /><button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">保存租户资料</button></form></section><section className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">租户账号</p><p className="mt-2 text-2xl font-bold">{accounts.length}</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">直播间</p><p className="mt-2 text-2xl font-bold">{lives.length}</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">录播文件</p><p className="mt-2 text-2xl font-bold">{replays.length}</p></div><div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">直播中</p><p className="mt-2 text-2xl font-bold">{lives.filter((live) => live.status === "live").length}</p></div></section><section className="overflow-x-auto rounded-xl border"><h2 className="border-b p-4 text-lg font-semibold">租户账号</h2><table className="w-full min-w-[700px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">账号</th><th className="p-3">名称</th><th className="p-3">角色</th><th className="p-3">状态</th><th className="p-3">到期日期</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{account.id}</td><td className="p-3">{account.name}</td><td className="p-3">{account.role === "director" ? "租户管理员" : account.role === "host" ? "主播" : "场控"}</td><td className="p-3">{account.status === "active" ? "启用" : "已停用"}</td><td className="p-3">{dateLabel(account.expiresAt)}</td></tr>)}</tbody></table></section><section className="overflow-x-auto rounded-xl border"><h2 className="border-b p-4 text-lg font-semibold">直播间</h2><table className="w-full min-w-[700px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">标题</th><th className="p-3">状态</th><th className="p-3">主播</th><th className="p-3">创建 / 开始时间</th></tr></thead><tbody>{lives.map((live) => <tr key={live.id} className="border-b last:border-0"><td className="p-3">{live.title}</td><td className="p-3">{live.status}</td><td className="p-3">{accounts.find((account) => account.id === live.hostUserId)?.name ?? live.hostUserId}</td><td className="p-3">{dateLabel(live.startTime)}</td></tr>)}{lives.length === 0 ? <tr><td className="p-6 text-center text-muted-foreground" colSpan={4}>暂无直播间</td></tr> : null}</tbody></table></section><section className="rounded-xl border border-destructive/40 p-5"><h2 className="text-lg font-semibold">删除租户</h2><p className="mt-2 text-sm text-muted-foreground">为保留历史数据，删除会将该租户、旗下账号及非直播中的直播间全部停用/关闭；正在直播时不能删除。</p><form action={archiveTenant} className="mt-4"><input type="hidden" name="directorId" value={tenant.id} /><button className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">删除并停用租户</button></form></section></div></main>;
}
