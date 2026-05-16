"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="我的项目">{children}</AppShell>;
}
