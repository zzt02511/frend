import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import type { LiveSession, UserRole } from "@/lib/domain";

type AuthContext = {
  userId: string;
  role: UserRole;
  userName: string;
  tenantId?: string;
};

export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("AUTH_REQUIRED");

  const user = getStore().users.find((item) => item.id === session.user.id);
  const now = new Date();
  if (!user || user.status !== "active" || (user.expiresAt && new Date(user.expiresAt) <= now)) {
    throw new Error("USER_NOT_FOUND_OR_DISABLED");
  }
  if ((session.user.authVersion ?? 0) !== (user.authVersion ?? 0)) throw new Error("AUTH_SESSION_REVOKED");

  if (["director", "host", "moderator"].includes(user.role)) {
    const tenantAdmin = getStore().users.find((item) => item.role === "director" && item.tenantId === user.tenantId);
    if (!tenantAdmin || tenantAdmin.status !== "active" || (tenantAdmin.expiresAt && new Date(tenantAdmin.expiresAt) <= now)) {
      throw new Error("TENANT_NOT_ACTIVE");
    }
  }

  const role = user.role;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new Error("AUTH_INSUFFICIENT_ROLE");
  }

  return { userId: user.id, role, userName: user.name, tenantId: user.tenantId };
}

/** Server-side tenant boundary for every staff room-management operation. */
export function assertLiveTenantAccess(auth: AuthContext, live: LiveSession) {
  if (auth.role === "super_admin") return;
  if (!auth.tenantId || live.tenantId !== auth.tenantId) throw new Error("AUTH_TENANT_ACCESS_DENIED");
}

export async function requireLiveManagementAccess(liveId: string, allowedRoles: UserRole[]) {
  const auth = await requireAuth(allowedRoles);
  const live = getStore().liveSessions.find((item) => item.id === liveId);
  if (!live) throw new Error("LIVE_NOT_FOUND");
  assertLiveTenantAccess(auth, live);
  if (auth.role === "host" && live.hostUserId !== auth.userId) throw new Error("AUTH_INSUFFICIENT_ROLE");
  if (auth.role === "moderator" && !live.moderatorIds.includes(auth.userId)) throw new Error("AUTH_INSUFFICIENT_ROLE");
  return { auth, live };
}

export async function getOptionalAuth(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
