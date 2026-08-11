"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "sm" : "default"}
      className={compact ? "h-8 px-2 text-xs" : undefined}
      onClick={() => void signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="h-4 w-4" /> 退出登录
    </Button>
  );
}
