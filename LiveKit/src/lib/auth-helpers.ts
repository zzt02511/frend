import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import type { UserRole } from "@/lib/domain";

type AuthContext = {
  userId: string;
  role: UserRole;
  userName: string;
};

export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("AUTH_REQUIRED");

  const user = getStore().users.find((item) => item.id === session.user.id);
  if (!user || user.status !== "active") throw new Error("USER_NOT_FOUND_OR_DISABLED");

  const role = (session.user.role as UserRole) ?? user.role;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new Error("AUTH_INSUFFICIENT_ROLE");
  }

  return { userId: user.id, role, userName: user.name };
}

export async function getOptionalAuth(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
