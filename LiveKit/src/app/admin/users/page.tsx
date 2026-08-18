import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";
import { createId, type User, type UserRole, type UserStatus } from "@/lib/domain";
import { hashPassword } from "@/lib/password";
import { getStore, persistStore } from "@/lib/store";
import { SignOutButton } from "@/components/sign-out-button";
import { TenantListTable, type TenantListItem } from "@/components/tenant-list-table";

const TENANT_STAFF_ROLES: UserRole[] = ["moderator", "host"];
const PAGE_SIZE = 10;

function tenantForDirector(userId: string) {
  return `tenant-${userId}`;
}

function expiresAtFrom(formData: FormData) {
  const value = String(formData.get("expiresAt") || "").trim();
  return value ? new Date(`${value}T23:59:59`).toISOString() : undefined;
}

function provisionDefaultTenantResources(store: ReturnType<typeof getStore>, input: {
  directorId: string;
  directorName: string;
  tenantId: string;
  password: string;
  expiresAt?: string;
}) {
  const hostId = `${input.directorId}-host`;
  const moderatorId = `${input.directorId}-moderator`;
  const now = new Date().toISOString();
  store.users.push(
    { id: hostId, name: `${input.directorName} - 默认主播`, role: "host", status: "active", passwordHash: hashPassword(input.password), createdAt: now, expiresAt: input.expiresAt, tenantId: input.tenantId },
    { id: moderatorId, name: `${input.directorName} - 默认场控`, role: "moderator", status: "active", passwordHash: hashPassword(input.password), createdAt: now, expiresAt: input.expiresAt, tenantId: input.tenantId },
  );
  const liveId = createId("live");
  store.liveSessions.unshift({
    id: liveId, title: `${input.directorName} 的直播间`, coverUrl: "/window.svg", description: "新租户默认直播间。",
    roomName: `private-${liveId}`, status: "scheduled", startTime: now, hostUserId: hostId,
    tenantId: input.tenantId, moderatorIds: [input.directorId, moderatorId], enableComment: true,
    commentMode: "review", enableMicApply: true, enableRecord: true,
  });
  store.stats.push({ id: `stats-${liveId}`, liveId, pv: 0, uv: 0, peakOnline: 0, currentOnline: 0, avgWatchDuration: 0, commentCount: 0, likeCount: 0, micApplyCount: 0, successfulMicCount: 0, leadCount: 0, replayViewCount: 0 });
}

async function saveTenant(formData: FormData) {
  "use server";
  await requireAuth(["super_admin"]);
  const id = String(formData.get("id") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const status = String(formData.get("status") || "active") as UserStatus;
  if (!name || !["active", "disabled"].includes(status)) throw new Error("TENANT_INPUT_INVALID");
  if (!id && (!accountId || !/^[A-Za-z0-9_-]{3,64}$/.test(accountId))) throw new Error("ACCOUNT_ID_INVALID");
  if (!id && password.length < 8) throw new Error("PASSWORD_TOO_SHORT");

  const store = getStore();
  const existing = id ? store.users.find((item) => item.id === id && item.role === "director") : undefined;
  if (id && !existing) throw new Error("TENANT_NOT_FOUND");
  const expiresAt = expiresAtFrom(formData);
  if (existing) {
    const accessChanged = existing.status !== status || existing.expiresAt !== expiresAt || Boolean(password);
    existing.name = name;
    existing.status = status;
    existing.expiresAt = expiresAt;
    if (password) existing.passwordHash = hashPassword(password);
    if (accessChanged) {
      store.users.filter((user) => user.tenantId === existing.tenantId).forEach((user) => {
        user.authVersion = (user.authVersion ?? 0) + 1;
      });
    }
  } else {
    if (store.users.some((item) => item.id === accountId)) throw new Error("ACCOUNT_ID_EXISTS");
    const tenantId = tenantForDirector(accountId);
    store.users.push({ id: accountId, name, role: "director", status, passwordHash: hashPassword(password), createdAt: new Date().toISOString(), expiresAt, tenantId });
    provisionDefaultTenantResources(store, { directorId: accountId, directorName: name, tenantId, password, expiresAt });
  }
  persistStore(store);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

async function saveTenantStaff(formData: FormData) {
  "use server";
  const actor = await requireAuth(["director"]);
  const id = String(formData.get("id") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "") as UserRole;
  const password = String(formData.get("password") || "");
  const status = String(formData.get("status") || "active") as UserStatus;
  if (!name || !TENANT_STAFF_ROLES.includes(role) || !actor.tenantId) throw new Error("USER_INPUT_INVALID");
  if (!id && (!accountId || !/^[A-Za-z0-9_-]{3,64}$/.test(accountId))) throw new Error("ACCOUNT_ID_INVALID");
  if (!id && password.length < 8) throw new Error("PASSWORD_TOO_SHORT");
  const store = getStore();
  const existing = id ? store.users.find((item) => item.id === id) : undefined;
  if (id && (!existing || !TENANT_STAFF_ROLES.includes(existing.role) || existing.tenantId !== actor.tenantId)) throw new Error("AUTH_TENANT_ACCESS_DENIED");
  if (existing) {
    const expiresAt = expiresAtFrom(formData);
    const accessChanged = existing.role !== role || existing.status !== status || existing.expiresAt !== expiresAt || Boolean(password);
    existing.name = name;
    existing.role = role;
    existing.status = status;
    existing.expiresAt = expiresAt;
    if (password) existing.passwordHash = hashPassword(password);
    if (accessChanged) existing.authVersion = (existing.authVersion ?? 0) + 1;
  } else {
    if (store.users.some((item) => item.id === accountId)) throw new Error("ACCOUNT_ID_EXISTS");
    store.users.push({ id: accountId, name, role, status, passwordHash: hashPassword(password), createdAt: new Date().toISOString(), expiresAt: expiresAtFrom(formData), tenantId: actor.tenantId });
  }
  persistStore(store);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

function TenantForm({ tenant }: { tenant?: User }) {
  return <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">{tenant ? "编辑租户" : "新增租户"}</h2><form action={saveTenant} className="grid gap-3 md:grid-cols-3"><input type="hidden" name="id" value={tenant?.id ?? ""} />{tenant ? <input type="hidden" name="accountId" value={tenant.id} /> : <input name="accountId" required placeholder="租户管理员登录账号" className="rounded-md border bg-transparent p-2" />}<input name="name" required defaultValue={tenant?.name} placeholder="租户名称 / 管理员名称" className="rounded-md border bg-transparent p-2" /><select name="status" defaultValue={tenant?.status ?? "active"} className="rounded-md border bg-transparent p-2"><option value="active">启用</option><option value="disabled">停用</option></select><input name="expiresAt" type="date" defaultValue={tenant?.expiresAt?.slice(0, 10)} title="留空为永久有效" className="rounded-md border bg-transparent p-2" /><input name="password" type="password" required={!tenant} minLength={8} placeholder={tenant ? "留空不修改口令" : "初始口令（至少 8 位）"} className="rounded-md border bg-transparent p-2" /><button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">{tenant ? "保存租户" : "创建租户"}</button></form>{!tenant ? <p className="mt-3 text-xs text-muted-foreground">创建后将自动生成默认主播、默认场控和待开播直播间。</p> : null}</section>;
}

function TenantStaffPage({ users }: { users: User[] }) {
  return <main className="relative min-h-screen bg-background p-6 text-foreground"><div className="absolute right-6 top-6"><SignOutButton /></div><div className="mx-auto max-w-6xl space-y-6"><header className="flex items-center justify-between gap-4"><div><p className="text-sm text-primary">客户管理员</p><h1 className="text-3xl font-bold">旗下账号管理</h1><p className="mt-1 text-sm text-muted-foreground">维护本租户主播和场控账号。</p></div><Link className="rounded-md border px-3 py-2 text-sm" href="/admin">返回直播后台</Link></header><section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">新增账号</h2><form action={saveTenantStaff} className="grid gap-3 md:grid-cols-3"><input name="accountId" required placeholder="登录账号" className="rounded-md border bg-transparent p-2" /><input name="name" required placeholder="姓名 / 显示名" className="rounded-md border bg-transparent p-2" /><select name="role" defaultValue="host" className="rounded-md border bg-transparent p-2"><option value="host">主播</option><option value="moderator">场控</option></select><input name="password" required minLength={8} type="password" placeholder="初始口令（至少 8 位）" className="rounded-md border bg-transparent p-2" /><input name="expiresAt" type="date" title="留空为永久有效" className="rounded-md border bg-transparent p-2" /><button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">新增</button></form></section><section className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[900px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">登录账号</th><th className="p-3">创建日期</th><th className="p-3">资料、权限与使用期限</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{user.id}</td><td className="p-3 text-xs">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "历史账号"}</td><td className="p-3"><form action={saveTenantStaff} className="grid grid-cols-5 gap-2"><input type="hidden" name="id" value={user.id} /><input type="hidden" name="accountId" value={user.id} /><input name="name" defaultValue={user.name} required className="rounded-md border bg-transparent p-2" /><select name="role" defaultValue={user.role} className="rounded-md border bg-transparent p-2"><option value="host">主播</option><option value="moderator">场控</option></select><select name="status" defaultValue={user.status} className="rounded-md border bg-transparent p-2"><option value="active">启用</option><option value="disabled">停用</option></select><input name="expiresAt" type="date" defaultValue={user.expiresAt?.slice(0, 10)} className="rounded-md border bg-transparent p-2" /><input name="password" type="password" minLength={8} placeholder="留空不改口令" className="rounded-md border bg-transparent p-2" /><button className="rounded-md border px-3">保存</button></form></td></tr>)}</tbody></table></section></div></main>;
}

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function UserAdminPage({ searchParams }: Props) {
  const actor = await requireAuth(["super_admin", "director"]);
  const store = getStore();
  if (actor.role === "director") return <TenantStaffPage users={store.users.filter((user) => TENANT_STAFF_ROLES.includes(user.role) && user.tenantId === actor.tenantId)} />;

  const { page: requestedPage } = await searchParams;
  const allTenants: TenantListItem[] = store.users.filter((user) => user.role === "director" && user.tenantId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).map((director) => ({
    id: director.id, name: director.name, tenantId: director.tenantId, status: director.status, createdAt: director.createdAt, expiresAt: director.expiresAt,
    accountCount: store.users.filter((user) => user.tenantId === director.tenantId).length,
    liveCount: store.liveSessions.filter((live) => live.tenantId === director.tenantId).length,
  }));
  const totalPages = Math.max(1, Math.ceil(allTenants.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number.parseInt(requestedPage ?? "1", 10) || 1, 1), totalPages);
  const tenants = allTenants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return <main className="relative min-h-screen bg-background p-6 text-foreground"><div className="absolute right-6 top-6"><SignOutButton /></div><div className="mx-auto max-w-6xl space-y-6"><header className="flex items-center justify-between gap-4"><div><p className="text-sm text-primary">超级管理员</p><h1 className="text-3xl font-bold">租户管理</h1><p className="mt-1 text-sm text-muted-foreground">维护租户的创建、启停、到期时间和基本资料；双击租户行可查看详情。</p></div><Link className="rounded-md border px-3 py-2 text-sm" href="/admin">返回直播后台</Link></header><TenantForm /><section className="space-y-3"><TenantListTable tenants={tenants} /><div className="flex items-center justify-between text-sm text-muted-foreground"><span>共 {allTenants.length} 个租户，第 {page} / {totalPages} 页</span><div className="flex gap-2">{page > 1 ? <Link className="rounded-md border px-3 py-1.5" href={`/admin/users?page=${page - 1}`}>上一页</Link> : <span className="rounded-md border px-3 py-1.5 opacity-40">上一页</span>}{page < totalPages ? <Link className="rounded-md border px-3 py-1.5" href={`/admin/users?page=${page + 1}`}>下一页</Link> : <span className="rounded-md border px-3 py-1.5 opacity-40">下一页</span>}</div></div></section></div></main>;
}
