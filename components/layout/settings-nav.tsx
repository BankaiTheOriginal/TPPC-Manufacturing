"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  ShieldCheck,
  Users,
  Wrench,
  Handshake,
  Zap,
  ScanSearch,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccess, ROLES } from "@/lib/rbac";
import { useAuthStore } from "@/lib/stores/auth-store";

interface SettingsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredRoles: string[];
}

const settingsNavItems: SettingsNavItem[] = [
  {
    href: "/settings",
    label: "Overview",
    icon: MapPin,
    requiredRoles: [
      ROLES.ADMINISTRATOR,
      ROLES.GENERAL_MANAGER,
      ROLES.HUMAN_RESOURCES,
      ROLES.HEAD_OF_OPERATIONS,
    ],
  },
  {
    href: "/settings/users",
    label: "Staff Directory",
    icon: Users,
    requiredRoles: [
      ROLES.ADMINISTRATOR,
      ROLES.GENERAL_MANAGER,
      ROLES.HEAD_OF_OPERATIONS,
      ROLES.HUMAN_RESOURCES,
    ],
  },
  {
    href: "/settings/permissions",
    label: "Roles & Permissions",
    icon: ShieldCheck,
    requiredRoles: [
      ROLES.ADMINISTRATOR,
      ROLES.GENERAL_MANAGER,
      ROLES.HEAD_OF_OPERATIONS,
      ROLES.HUMAN_RESOURCES,
    ],
  },
  {
    href: "/settings/locations",
    label: "Locations",
    icon: MapPin,
    requiredRoles: [
      ROLES.ADMINISTRATOR,
      ROLES.HEAD_OF_OPERATIONS,
      ROLES.PRODUCTION_MANAGER,
    ],
  },
  {
    href: "/settings/machinery",
    label: "Machinery",
    icon: Wrench,
    requiredRoles: [
      ROLES.ADMINISTRATOR,
      ROLES.HEAD_OF_OPERATIONS,
      ROLES.PRODUCTION_MANAGER,
    ],
  },
  {
    href: "/settings/vendors",
    label: "Vendors",
    icon: Handshake,
    requiredRoles: [
      ROLES.ADMINISTRATOR,
      ROLES.HEAD_OF_OPERATIONS,
      ROLES.PRODUCTION_MANAGER,
    ],
  },
  {
    href: "/settings/zoho",
    label: "Zoho Books",
    icon: Zap,
    requiredRoles: [ROLES.ADMINISTRATOR],
  },
  {
    href: "/settings/zoho/gap-analysis",
    label: "Zoho Gap Analysis",
    icon: ScanSearch,
    requiredRoles: [ROLES.ADMINISTRATOR],
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const visibleItems = settingsNavItems.filter(
    (item) =>
      item.requiredRoles.includes(user?.role ?? "") ||
      canAccess(user?.role ?? "", item.href)
  );

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/settings" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-zinc-100 text-zinc-900 border border-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
