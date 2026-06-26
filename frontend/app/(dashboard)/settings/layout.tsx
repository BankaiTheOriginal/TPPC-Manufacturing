"use client";

import { ROLES, useRequireRole } from "@/lib/rbac";
import { SettingsNav } from "@/components/layout/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HUMAN_RESOURCES,
    ROLES.HEAD_OF_OPERATIONS,
  ]);

  return (
    <div className="space-y-6">
      <SettingsNav />
      {children}
    </div>
  );
}
