"use client";

import { useRouter } from "next/navigation";

export type TenantListItem = {
  id: string;
  name: string;
  tenantId?: string;
  status: "active" | "disabled" | "blacklisted";
  createdAt?: string;
  expiresAt?: string;
  accountCount: number;
  liveCount: number;
};

function dateLabel(value?: string) {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "—";
}

export function TenantListTable({ tenants }: { tenants: TenantListItem[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th className="p-3">租户名称</th>
            <th className="p-3">管理员账号</th>
            <th className="p-3">租户标识</th>
            <th className="p-3">创建日期</th>
            <th className="p-3">到期日期</th>
            <th className="p-3">状态</th>
            <th className="p-3">账号 / 直播间</th>
            <th className="p-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
              onDoubleClick={() => router.push(`/admin/tenants/${encodeURIComponent(tenant.id)}`)}
              title="双击查看租户详情"
            >
              <td className="p-3 font-medium">{tenant.name}</td>
              <td className="p-3 font-mono text-xs">{tenant.id}</td>
              <td className="p-3 font-mono text-xs text-muted-foreground">{tenant.tenantId ?? "—"}</td>
              <td className="p-3">{dateLabel(tenant.createdAt)}</td>
              <td className="p-3">{tenant.expiresAt ? dateLabel(tenant.expiresAt) : "永久有效"}</td>
              <td className="p-3">{tenant.status === "active" ? "启用" : tenant.status === "disabled" ? "已停用" : "黑名单"}</td>
              <td className="p-3">{tenant.accountCount} / {tenant.liveCount}</td>
              <td className="p-3"><button type="button" className="rounded-md border px-3 py-1.5 text-xs" onClick={() => router.push(`/admin/tenants/${encodeURIComponent(tenant.id)}`)}>查看详情</button></td>
            </tr>
          ))}
          {tenants.length === 0 ? <tr><td className="p-8 text-center text-muted-foreground" colSpan={8}>暂无租户</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
