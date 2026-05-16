"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function ProjectWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="项目工作区">{children}</AppShell>;
}
