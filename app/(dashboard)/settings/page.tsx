"use client";

import Link from "next/link";
import {
  ChevronRight,
  MapPin,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
  Handshake,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccess, ROLES, useRequireRole } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth-store";

interface SettingsSection {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const settingsSections: SettingsSection[] = [
  {
    href: "/settings/users",
    label: "Staff Directory",
    description: "Manage staff records, contact details, reporting lines, and access roles.",
    icon: Users,
  },
  {
    href: "/settings/permissions",
    label: "Roles & Permissions",
    description: "Review how access is distributed across roles and staff accounts.",
    icon: ShieldCheck,
  },
  {
    href: "/settings/locations",
    label: "Locations",
    description: "Configure the factory and warehouse sites used by production stages.",
    icon: MapPin,
  },
  {
    href: "/settings/machinery",
    label: "Machinery",
    description: "Maintain the machine catalogue available to each operation stage.",
    icon: Wrench,
  },
  {
    href: "/settings/vendors",
    label: "Vendors",
    description: "Maintain approved vendor lists for outsourced and assisted work.",
    icon: Handshake,
  },
  {
    href: "/settings/zoho",
    label: "Zoho Books",
    description: "Connect and monitor the Zoho Books integration for sales-order sync.",
    icon: Zap,
  },
  {
    href: "/settings/task-prerequisites",
    label: "Task Prerequisites",
    description: "Configure stage gating rules — which stages must complete before others can start.",
    icon: GitBranch,
  },
];

export default function SettingsPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HUMAN_RESOURCES,
    ROLES.HEAD_OF_OPERATIONS,
  ]);

  const user = useAuthStore((state) => state.user);
  const visibleSections = settingsSections.filter((section) =>
    canAccess(user?.role ?? "", section.href),
  );

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              Centralize staff administration, permissions, and the master data
              that supports production execution.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {visibleSections.map((section) => {
          const Icon = section.icon;

          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full border-zinc-200 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base text-zinc-900">
                        {section.label}
                      </CardTitle>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-300" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-zinc-600">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
