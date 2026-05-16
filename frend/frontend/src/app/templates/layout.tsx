"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell title="模板库">{children}</AppShell>;
}
