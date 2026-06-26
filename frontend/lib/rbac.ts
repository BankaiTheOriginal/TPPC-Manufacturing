"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

export const ROLES = {
  ADMINISTRATOR: "ADMINISTRATOR",
  GENERAL_MANAGER: "GENERAL_MANAGER",
  PRODUCTION_MANAGER: "PRODUCTION_MANAGER",
  HEAD_OF_OPERATIONS: "HEAD_OF_OPERATIONS",
  SUPERVISOR: "SUPERVISOR",
  ACCOUNTANT: "ACCOUNTANT",
  LOGISTICS_TEAM: "LOGISTICS_TEAM",
  DESIGN_TEAM: "DESIGN_TEAM",
  HUMAN_RESOURCES: "HUMAN_RESOURCES",
  CUSTOMER_CARE: "CUSTOMER_CARE",
  FACTORY_WORKER: "FACTORY_WORKER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const MANAGEMENT_ROLES: Role[] = [
  ROLES.ADMINISTRATOR,
  ROLES.GENERAL_MANAGER,
  ROLES.PRODUCTION_MANAGER,
  ROLES.HEAD_OF_OPERATIONS,
];
const STAFF_ADMIN_ROLES: Role[] = [
  ROLES.ADMINISTRATOR,
  ROLES.GENERAL_MANAGER,
  ROLES.HEAD_OF_OPERATIONS,
  ROLES.HUMAN_RESOURCES,
];

export const PAGE_ROLES: Record<string, Role[]> = {
  "/settings/users": [...STAFF_ADMIN_ROLES],
  "/settings/permissions": [...STAFF_ADMIN_ROLES],
  "/settings/locations": [ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS],
  "/settings/machinery": [ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS],
  "/settings/vendors": [ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS],
  "/settings/zoho": [ROLES.ADMINISTRATOR],
  "/settings/zoho/gap-analysis": [ROLES.ADMINISTRATOR],
  "/settings/task-prerequisites": [ROLES.ADMINISTRATOR],
  "/settings": [
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HUMAN_RESOURCES,
    ROLES.HEAD_OF_OPERATIONS,
  ],
  "/inventory": [...MANAGEMENT_ROLES, ROLES.SUPERVISOR],
  "/production-orders": [
    ...MANAGEMENT_ROLES,
    ROLES.SUPERVISOR,
    ROLES.DESIGN_TEAM,
    ROLES.CUSTOMER_CARE,
  ],
  "/sales-orders": [
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.LOGISTICS_TEAM,
    ROLES.CUSTOMER_CARE,
  ],
  "/users": [...STAFF_ADMIN_ROLES],
  "/audit-logs": [ROLES.ADMINISTRATOR, ROLES.GENERAL_MANAGER],
  "/locations": [...MANAGEMENT_ROLES],
  "/machinery": [ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS],
  "/vendors": [ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS],
  "/reports": [
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.ACCOUNTANT,
  ],
  "/factory-activity": [...MANAGEMENT_ROLES, ROLES.SUPERVISOR],
  "/tasks": [
    ...MANAGEMENT_ROLES,
    ROLES.SUPERVISOR,
    ROLES.DESIGN_TEAM,
    ROLES.LOGISTICS_TEAM,
    ROLES.FACTORY_WORKER,
    ROLES.CUSTOMER_CARE,
  ],
  "/customer-care": [
    ...MANAGEMENT_ROLES,
    ROLES.SUPERVISOR,
    ROLES.LOGISTICS_TEAM,
    ROLES.CUSTOMER_CARE,
  ],
};

const PAGE_ROLE_PREFIXES = Object.keys(PAGE_ROLES).sort(
  (left, right) => right.length - left.length,
);

export function canAccess(role: string, path: string): boolean {
  // Administrator always has full access to every module
  if (role === ROLES.ADMINISTRATOR) return true;

  for (const prefix of PAGE_ROLE_PREFIXES) {
    const allowed = PAGE_ROLES[prefix] ?? [];
    if (path === prefix || path.startsWith(prefix + "/")) {
      return (allowed as string[]).includes(role);
    }
  }
  return true; // unrestricted page
}

export function useRequireRole(allowed: Role[]) {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || !(allowed as string[]).includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, user, router, allowed]);
}
