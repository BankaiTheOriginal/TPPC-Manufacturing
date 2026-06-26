import { Role } from 'generated/prisma/enums';

export type PermissionModuleKey =
  | 'dashboard'
  | 'inventory'
  | 'productionOrders'
  | 'salesOrders'
  | 'customerCare'
  | 'tasks'
  | 'factoryActivity'
  | 'reports'
  | 'auditLogs'
  | 'settingsUsers'
  | 'settingsPermissions'
  | 'settingsLocations'
  | 'settingsMachinery'
  | 'settingsVendors'
  | 'settingsZoho';

export interface PermissionModuleDefinition {
  key: PermissionModuleKey;
  label: string;
  path: string;
  actions: string[];
  category: 'Operations' | 'Insights' | 'Settings';
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRATOR: 'Administrator',
  GENERAL_MANAGER: 'General Manager',
  PRODUCTION_MANAGER: 'Production Manager',
  HEAD_OF_OPERATIONS: 'Head of Operations',
  SUPERVISOR: 'Supervisor',
  ACCOUNTANT: 'Accountant',
  LOGISTICS_TEAM: 'Logistics Team',
  DESIGN_TEAM: 'Design Team',
  HUMAN_RESOURCES: 'Human Resources',
  CUSTOMER_CARE: 'Customer Care',
  FACTORY_WORKER: 'Factory Worker',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMINISTRATOR:
    'Full system access including staff administration, settings, and integrations.',
  GENERAL_MANAGER:
    'Executive oversight across operational, sales, and reporting modules.',
  PRODUCTION_MANAGER:
    'Oversees production execution, factory throughput, and task assignment.',
  HEAD_OF_OPERATIONS:
    'Manages operations, production oversight, and configuration of operational master data.',
  SUPERVISOR:
    'Runs day-to-day factory execution, labour logging, and order progression.',
  ACCOUNTANT: 'Reviews cost and performance reports for financial oversight.',
  LOGISTICS_TEAM:
    'Handles sales-order processing, fulfilment coordination, and related task work.',
  DESIGN_TEAM:
    'Works artwork and design-stage assignments inside the production flow.',
  HUMAN_RESOURCES:
    'Maintains staff records, access rights, and permission reviews.',
  CUSTOMER_CARE:
    'Handles customer care workflows and order follow-up.',
  FACTORY_WORKER:
    'Views assigned work items and participates in task execution.',
};

export const PERMISSION_MODULES: Record<
  PermissionModuleKey,
  PermissionModuleDefinition
> = {
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    actions: ['view'],
    category: 'Operations',
  },
  inventory: {
    key: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    actions: ['view', 'manage stock'],
    category: 'Operations',
  },
  productionOrders: {
    key: 'productionOrders',
    label: 'Production Orders',
    path: '/production-orders',
    actions: ['view', 'update workflow'],
    category: 'Operations',
  },
  salesOrders: {
    key: 'salesOrders',
    label: 'Sales Orders',
    path: '/sales-orders',
    actions: ['view', 'coordinate orders'],
    category: 'Operations',
  },
  customerCare: {
    key: 'customerCare',
    label: 'Customer Care',
    path: '/customer-care',
    actions: ['view', 'follow up'],
    category: 'Operations',
  },
  tasks: {
    key: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    actions: ['view', 'update assigned work'],
    category: 'Operations',
  },
  factoryActivity: {
    key: 'factoryActivity',
    label: 'Factory Activity',
    path: '/factory-activity',
    actions: ['view', 'log labour'],
    category: 'Operations',
  },
  reports: {
    key: 'reports',
    label: 'Reports',
    path: '/reports',
    actions: ['view'],
    category: 'Insights',
  },
  auditLogs: {
    key: 'auditLogs',
    label: 'Audit Trail',
    path: '/audit-logs',
    actions: ['view'],
    category: 'Insights',
  },
  settingsUsers: {
    key: 'settingsUsers',
    label: 'Staff Directory',
    path: '/settings/users',
    actions: ['view', 'create', 'edit', 'delete'],
    category: 'Settings',
  },
  settingsPermissions: {
    key: 'settingsPermissions',
    label: 'Roles & Permissions',
    path: '/settings/permissions',
    actions: ['view', 'review access'],
    category: 'Settings',
  },
  settingsLocations: {
    key: 'settingsLocations',
    label: 'Locations',
    path: '/settings/locations',
    actions: ['view', 'create', 'edit', 'delete'],
    category: 'Settings',
  },
  settingsMachinery: {
    key: 'settingsMachinery',
    label: 'Machinery',
    path: '/settings/machinery',
    actions: ['view', 'create', 'edit', 'delete'],
    category: 'Settings',
  },
  settingsVendors: {
    key: 'settingsVendors',
    label: 'Vendors',
    path: '/settings/vendors',
    actions: ['view', 'create', 'edit', 'delete'],
    category: 'Settings',
  },
  settingsZoho: {
    key: 'settingsZoho',
    label: 'Zoho Books',
    path: '/settings/zoho',
    actions: ['connect', 'reconnect', 'review status'],
    category: 'Settings',
  },
};

export const ROLE_PERMISSION_KEYS: Record<Role, PermissionModuleKey[]> = {
  ADMINISTRATOR: Object.keys(PERMISSION_MODULES) as PermissionModuleKey[],
  GENERAL_MANAGER: [
    'dashboard',
    'inventory',
    'productionOrders',
    'salesOrders',
    'customerCare',
    'tasks',
    'factoryActivity',
    'reports',
    'auditLogs',
    'settingsUsers',
    'settingsPermissions',
  ],
  PRODUCTION_MANAGER: [
    'dashboard',
    'inventory',
    'productionOrders',
    'customerCare',
    'tasks',
    'factoryActivity',
    'reports',
  ],
  HEAD_OF_OPERATIONS: [
    'dashboard',
    'inventory',
    'productionOrders',
    'salesOrders',
    'customerCare',
    'tasks',
    'factoryActivity',
    'reports',
    'settingsUsers',
    'settingsPermissions',
    'settingsLocations',
    'settingsMachinery',
    'settingsVendors',
  ],
  SUPERVISOR: [
    'dashboard',
    'inventory',
    'productionOrders',
    'customerCare',
    'tasks',
    'factoryActivity',
  ],
  ACCOUNTANT: ['dashboard', 'reports'],
  LOGISTICS_TEAM: ['dashboard', 'salesOrders', 'customerCare', 'tasks'],
  DESIGN_TEAM: ['dashboard', 'productionOrders', 'tasks'],
  HUMAN_RESOURCES: ['dashboard', 'settingsUsers', 'settingsPermissions'],
  CUSTOMER_CARE: ['dashboard', 'salesOrders', 'customerCare', 'tasks', 'productionOrders'],
  FACTORY_WORKER: ['dashboard', 'tasks'],
};

export function getRoleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? role.replace(/_/g, ' ');
}

export function getRoleDescription(role: string) {
  return (
    ROLE_DESCRIPTIONS[role as Role] ??
    'Custom or legacy role. Review and assign a supported access role.'
  );
}

export function getPermissionKeysForRole(role: string) {
  return ROLE_PERMISSION_KEYS[role as Role] ?? [];
}
