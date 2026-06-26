import { ROLES } from "@/lib/rbac";

export const roleLabels: Record<string, string> = {
  [ROLES.ADMINISTRATOR]: "Administrator",
  [ROLES.GENERAL_MANAGER]: "General Manager",
  [ROLES.PRODUCTION_MANAGER]: "Production Manager",
  [ROLES.HEAD_OF_OPERATIONS]: "Head of Operations",
  [ROLES.SUPERVISOR]: "Supervisor",
  [ROLES.ACCOUNTANT]: "Accountant",
  [ROLES.LOGISTICS_TEAM]: "Logistics Team",
  [ROLES.DESIGN_TEAM]: "Design Team",
  [ROLES.HUMAN_RESOURCES]: "Human Resources",
  [ROLES.CUSTOMER_CARE]: "Customer Care",
  [ROLES.FACTORY_WORKER]: "Factory Workers",
};

export const roleColors: Record<string, string> = {
  [ROLES.ADMINISTRATOR]: "bg-red-100 text-red-700",
  [ROLES.GENERAL_MANAGER]: "bg-purple-100 text-purple-700",
  [ROLES.PRODUCTION_MANAGER]: "bg-teal-100 text-teal-700",
  [ROLES.HEAD_OF_OPERATIONS]: "bg-blue-100 text-blue-700",
  [ROLES.SUPERVISOR]: "bg-orange-100 text-orange-700",
  [ROLES.ACCOUNTANT]: "bg-green-100 text-green-700",
  [ROLES.LOGISTICS_TEAM]: "bg-cyan-100 text-cyan-700",
  [ROLES.DESIGN_TEAM]: "bg-pink-100 text-pink-700",
  [ROLES.HUMAN_RESOURCES]: "bg-indigo-100 text-indigo-700",
  [ROLES.CUSTOMER_CARE]: "bg-amber-100 text-amber-700",
  [ROLES.FACTORY_WORKER]: "bg-slate-100 text-slate-700",
};