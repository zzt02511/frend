"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="渲染队列">{children}</AppShell>;
}
