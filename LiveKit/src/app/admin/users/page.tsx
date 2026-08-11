import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";
import { type User, type UserRole, type UserStatus } from "@/lib/domain";
import { hashPassword } from "@/lib/password";
import { getStore, persistStore } from "@/lib/store";

const TENANT_STAFF_ROLES: UserRole[] = ["moderator", "host"];
const PLATFORM_MANAGED_ROLES: UserRole[] = ["director", ...TENANT_STAFF_ROLES];

function tenantForDirector(userId: string) {
  return `tenant-${userId}`;
}

function expiresAtFrom(formData: FormData) {
  const value = String(formData.get("expiresAt") || "").trim();
  return value ? new Date(`${value}T23:59:59`).toISOString() : undefined;
}

function userCanBeManaged(actor: { role: UserRole; tenantId?: string }, user: User) {
  return actor.role === "super_admin"
    ? PLATFORM_MANAGED_ROLES.includes(user.role)
    : TENANT_STAFF_ROLES.includes(user.role) && user.tenantId === actor.tenantId;
}

async function saveUser(formData: FormData) {
  "use server";
  const actor = await requireAuth(["super_admin", "director"]);
  const id = String(formData.get("id") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "") as UserRole;
  const password = String(formData.get("password") || "");
  const status = String(formData.get("status") || "active") as UserStatus;
  const requestedTenantId = String(formData.get("tenantId") || "").trim();
  const allowedRoles = actor.role === "super_admin" ? PLATFORM_MANAGED_ROLES : TENANT_STAFF_ROLES;
  if (!name || !allowedRoles.includes(role)) throw new Error("USER_INPUT_INVALID");
  if (!id && (!accountId || !/^[A-Za-z0-9_-]{3,64}$/.test(accountId))) throw new Error("ACCOUNT_ID_INVALID");
  if (!id && password.length < 8) throw new Error("PASSWORD_TOO_SHORT");

  const store = getStore();
  const existing = id ? store.users.find((item) => item.id === id) : undefined;
  if (id && !existing) throw new Error("USER_NOT_FOUND");
  if (existing && !userCanBeManaged(actor, existing)) throw new Error("AUTH_TENANT_ACCESS_DENIED");

  const tenantId = actor.role === "director"
    ? actor.tenantId
    : role === "director"
      ? tenantForDirector(existing?.id ?? accountId)
      : requestedTenantId;
  if (!tenantId) throw new Error("TENANT_REQUIRED");
  if (role !== "director" && !store.users.some((item) => item.role === "director" && item.tenantId === tenantId)) {
    throw new Error("TENANT_NOT_FOUND");
  }

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.status = status;
    existing.tenantId = tenantId;
    existing.expiresAt = expiresAtFrom(formData);
    if (password) existing.passwordHash = hashPassword(password);
  } else {
    if (store.users.some((item) => item.id === accountId)) throw new Error("ACCOUNT_ID_EXISTS");
    store.users.push({
      id: accountId,
      name,
      role,
      status,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      expiresAt: expiresAtFrom(formData),
      tenantId,
    });
  }
  persistStore(store);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export const dynamic = "force-dynamic";

export default async function UserAdminPage() {
  const actor = await requireAuth(["super_admin", "director"]);
  const store = getStore();
  const directorTenants = store.users.filter((user) => user.role === "director" && user.tenantId);
  const users = store.users.filter((user) => userCanBeManaged(actor, user));
  const allowedRoles = actor.role === "super_admin" ? PLATFORM_MANAGED_ROLES : TENANT_STAFF_ROLES;
  const title = actor.role === "super_admin" ? "平台账号管理" : "旗下账号管理";

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-sm text-primary">{actor.role === "super_admin" ? "超级管理员" : "客户管理员"}</p><h1 className="text-3xl font-bold">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{actor.role === "super_admin" ? "维护客户管理员及全部客户旗下主播、场控账号。" : "只维护本客户旗下的主播和场控账号。"}</p></div><Link className="shrink-0 rounded-md border px-3 py-2 text-sm" href="/admin">返回直播后台</Link></div>
        <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">新增账号</h2><form action={saveUser} className="grid gap-3 md:grid-cols-3"><input name="accountId" required placeholder="登录账号（字母、数字、-、_）" className="rounded-md border bg-transparent p-2" /><input name="name" required placeholder="姓名 / 显示名" className="rounded-md border bg-transparent p-2" /><select name="role" defaultValue={actor.role === "super_admin" ? "director" : "host"} className="rounded-md border bg-transparent p-2">{allowedRoles.map((role) => <option key={role} value={role}>{role === "director" ? "客户管理员" : role === "host" ? "主播" : "场控"}</option>)}</select>{actor.role === "super_admin" ? <select name="tenantId" className="rounded-md border bg-transparent p-2"><option value="">客户管理员自动创建独立客户空间</option>{directorTenants.map((director) => <option key={director.id} value={director.tenantId}>{director.name}（{director.id}）</option>)}</select> : <input type="hidden" name="tenantId" value={actor.tenantId} />}<input name="password" required minLength={8} type="password" placeholder="初始口令（至少 8 位）" className="rounded-md border bg-transparent p-2" /><input name="expiresAt" type="date" title="留空为永久有效" className="rounded-md border bg-transparent p-2" /><button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">新增</button></form></section>
        <section className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1050px] text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">登录账号</th><th className="p-3">所属客户</th><th className="p-3">创建日期</th><th className="p-3">资料、权限与使用期限</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{user.id}</td><td className="p-3 text-xs">{user.role === "director" ? "本客户管理员" : directorTenants.find((director) => director.tenantId === user.tenantId)?.name ?? user.tenantId}</td><td className="p-3 text-xs">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "历史账号"}</td><td className="p-3"><form action={saveUser} className="grid grid-cols-6 gap-2"><input type="hidden" name="id" value={user.id} /><input type="hidden" name="accountId" value={user.id} /><input name="name" defaultValue={user.name} required className="rounded-md border bg-transparent p-2" /><select name="role" defaultValue={user.role} className="rounded-md border bg-transparent p-2">{allowedRoles.map((role) => <option key={role} value={role}>{role === "director" ? "客户管理员" : role === "host" ? "主播" : "场控"}</option>)}</select>{actor.role === "super_admin" ? <select name="tenantId" defaultValue={user.tenantId} className="rounded-md border bg-transparent p-2"><option value="">客户管理员自动创建独立客户空间</option>{directorTenants.map((director) => <option key={director.id} value={director.tenantId}>{director.name}</option>)}</select> : <input type="hidden" name="tenantId" value={actor.tenantId} />}<select name="status" defaultValue={user.status} className="rounded-md border bg-transparent p-2"><option value="active">启用</option><option value="disabled">禁用</option></select><input name="expiresAt" type="date" defaultValue={user.expiresAt?.slice(0, 10)} title="留空为永久有效" className="rounded-md border bg-transparent p-2" /><input name="password" type="password" minLength={8} placeholder="留空不改口令" className="rounded-md border bg-transparent p-2" /><button className="rounded-md border px-3">保存</button></form></td></tr>)}</tbody></table></section>
      </div>
    </main>
  );
}
