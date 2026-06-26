// ─── Shared production constants ─────────────────────────────────────────────

export const STAGE_LABELS: Record<string, string> = {
  PAPER_SELECTION: "Paper Selection & Cutting",
  CUTTING: "Cutting",
  ARTWORK_DESIGN: "Artwork / Design",
  CTP_MAKING: "CTP Making",
  PRINTING: "Printing",
  DIECUTTING: "Die Cutting",
  LAMINATION: "Lamination",
  FINISHING: "Finishing",
  PACKAGING: "Packaging",
};

export const STAGE_ORDER: string[] = [
  "PAPER_SELECTION",
  "CUTTING",
  "ARTWORK_DESIGN",
  "CTP_MAKING",
  "PRINTING",
  "DIECUTTING",
  "LAMINATION",
  "FINISHING",
  "PACKAGING",
];

export const STAGES = Object.keys(STAGE_LABELS);

export const STAGE_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PARTIALLY_COMPLETE", label: "Partially Complete" },
  { value: "COMPLETE", label: "Complete" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "NA", label: "N/A" },
];

/** Stages that CANNOT be skipped */
export const NON_SKIPPABLE_STAGES = new Set([
  "PAPER_SELECTION",
  "FINISHING",
  "PACKAGING",
]);

/** Management roles that have elevated task permissions */
export const MANAGEMENT_ROLES = [
  'ADMINISTRATOR',
  'GENERAL_MANAGER',
  'PRODUCTION_MANAGER',
  'HEAD_OF_OPERATIONS',
  'SUPERVISOR',
] as const;

export const stageStatusColors: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PARTIALLY_COMPLETE: "bg-amber-100 text-amber-700",
  COMPLETE: "bg-green-100 text-green-700",
  SKIPPED: "bg-purple-100 text-purple-600",
  NA: "bg-zinc-50 text-zinc-400",
};

export const priorityColors: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

export const orderStatusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  PENDING: "bg-zinc-100 text-zinc-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETE: "bg-green-100 text-green-700",
  PARTIALLY_COMPLETE: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
};
