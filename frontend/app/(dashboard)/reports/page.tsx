"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  FileText,
  TrendingUp,
  Package,
  Users,
  Clock,
  AlertTriangle,
  DollarSign,
  Layers,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import api from "@/lib/api";
import { useRequireRole, ROLES } from "@/lib/rbac";
import { STAGE_ORDER } from "@/lib/constants";
import {
  fmtNumber as fmt,
  fmtCurrency as currency,
  daysBetween,
  isoDate,
} from "@/lib/format";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProductionOrder {
  id: string;
  sku: string;
  productName: string;
  status: string | null;
  orderType?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: { name: string };
  productOrderOperations: {
    id: string;
    operationStage: string;
    stageStatus: string | null;
    createdAt: string;
    completedAt?: string | null;
    startedAt?: string | null;
    expectedTimeline?: string | null;
    quantityFinished?: number | null;
    wastageFromPrinting?: number | null;
    wastageFromDiecutting?: number | null;
    wastageFromLaminating?: number | null;
    wastageFromHandling?: number | null;
    totalWastage?: number | null;
    costPerFinish?: string | null;
    costPerCutSheet?: string | null;
    costPerLamination?: string | null;
  }[];
}

interface FactoryActivity {
  id: string;
  createdAt: string;
  quantityAllocated: number;
  quantityFinished: number;
  quantityWasted: number;
  typeOfFinishing: string | null;
  costPerFinish: string | null;
  workerNames: string[];
  location: { name: string; state: string };
  supervisor: { firstName: string; lastName: string; staffId: string };
}

interface InventoryItem {
  id: string;
  itemName: string;
  paperType: string;
  quantityInStock: number;
  reorderLevel?: number;
  unitCost?: string;
}

type ExportCell = string | number;

interface ExportSection {
  title: string;
  rows: Record<string, ExportCell | null | undefined>[];
}

type ExportFormat = "csv" | "xlsx" | "pdf";

const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel",
  pdf: "PDF",
};

// ─── Report Card ──────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color = "teal",
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-xl p-3 ${colorMap[color] ?? colorMap.teal}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{title}</p>
          <p className="text-xl font-semibold text-zinc-900">{value}</p>
          {sub && <p className="text-xs text-zinc-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: "production", label: "Production Summary", icon: BarChart2 },
  { id: "stages", label: "Stage Performance", icon: Layers },
  { id: "wastage", label: "Wastage & Cost", icon: AlertTriangle },
  { id: "workers", label: "Worker Activity", icon: Users },
  { id: "delays", label: "Order Delays", icon: Clock },
  { id: "inventory", label: "Inventory Health", icon: Package },
  { id: "financial", label: "Financial Overview", icon: DollarSign },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CHART_COLORS = [
  "#0d9488",
  "#2563eb",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

// ─── Date Range Filter ────────────────────────────────────────────────────────

function DateFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          className="h-8 w-36 text-sm"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          className="h-8 w-36 text-sm"
          value={to}
          onChange={(e) => onTo(e.target.value)}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => {
          const now = new Date();
          onFrom(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
          onTo(isoDate(now));
        }}
      >
        This Month
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => {
          const now = new Date();
          const d30 = new Date(now);
          d30.setDate(d30.getDate() - 30);
          onFrom(isoDate(d30));
          onTo(isoDate(now));
        }}
      >
        Last 30 Days
      </Button>
    </div>
  );
}

function formatStageLabel(stage: string) {
  return stage.replace(/_/g, " ");
}

function formatDateCell(value: string | null | undefined) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-NG");
}

function normalizeExportValue(value: ExportCell | null | undefined): ExportCell {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }
  return value.replace(/\r?\n/g, " ").trim();
}

function getSectionHeaders(rows: ExportSection["rows"]) {
  const headers: string[] = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) {
        headers.push(key);
      }
    }
  }

  return headers;
}

function escapeCsvValue(value: ExportCell | null | undefined) {
  const normalized = String(normalizeExportValue(value));
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
}

function escapeHtml(value: ExportCell | null | undefined) {
  return String(normalizeExportValue(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCsvContent(
  reportTitle: string,
  dateRange: string,
  sections: ExportSection[],
) {
  const lines: string[] = [
    ["Report", reportTitle].map(escapeCsvValue).join(","),
    ["Date Range", dateRange].map(escapeCsvValue).join(","),
    "",
  ];

  sections.forEach((section, index) => {
    lines.push(escapeCsvValue(section.title));

    const headers = getSectionHeaders(section.rows);
    if (headers.length === 0) {
      lines.push(escapeCsvValue("Status"));
      lines.push(escapeCsvValue("No data available"));
    } else {
      lines.push(headers.map(escapeCsvValue).join(","));
      section.rows.forEach((row) => {
        lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
      });
    }

    if (index < sections.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\r\n");
}

function sanitizeFileNameSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function getWorksheetName(title: string, index: number) {
  const trimmed = title.replace(/[\\/*?:\[\]]/g, " ").trim();
  return (trimmed || `Section ${index + 1}`).slice(0, 31);
}

async function exportSectionsToXlsx(
  reportTitle: string,
  dateRange: string,
  sections: ExportSection[],
  baseFileName: string,
) {
  const content = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="UTF-8" />
    <meta name="ProgId" content="Excel.Sheet" />
    <meta name="Generator" content="Microsoft Excel 15" />
    <style>
      body { font-family: Calibri, Arial, sans-serif; }
      table { border-collapse: collapse; margin-bottom: 24px; width: 100%; }
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }
      th { background: #ccfbf1; font-weight: 700; }
      .report-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
      .report-meta { margin-bottom: 18px; color: #52525b; }
      .section-title { font-size: 14px; font-weight: 700; margin: 18px 0 8px; }
    </style>
  </head>
  <body>
    <div class="report-title">${escapeHtml(reportTitle)}</div>
    <div class="report-meta">Date Range: ${escapeHtml(dateRange)}</div>
    ${sections
      .map((section) => {
        const headers = getSectionHeaders(section.rows);
        const columnHeaders = headers.length > 0 ? headers : ["Status"];
        const rows =
          section.rows.length > 0
            ? section.rows
            : [{ Status: "No data available" }];

        return `<div class="section-title">${escapeHtml(section.title)}</div>
          <table>
            <thead>
              <tr>${columnHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>${columnHeaders
                    .map((header) => `<td>${escapeHtml(row[header])}</td>`)
                    .join("")}</tr>`,
                )
                .join("")}
            </tbody>
          </table>`;
      })
      .join("")}
  </body>
</html>`;

  downloadBlob(
    new Blob(["\ufeff", content], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    }),
    `${baseFileName}.xls`,
  );
}

async function exportSectionsToPdf(
  reportTitle: string,
  dateRange: string,
  sections: ExportSection[],
  baseFileName: string,
) {
  const [{ default: JsPdf }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableModule.default ?? autoTableModule) as (
    doc: InstanceType<typeof JsPdf>,
    options: {
      startY?: number;
      head: string[][];
      body: ExportCell[][];
      theme?: string;
      headStyles?: { fillColor?: [number, number, number] };
      styles?: { fontSize?: number; cellPadding?: number };
      margin?: { left?: number; right?: number; top?: number; bottom?: number };
    },
  ) => void;

  const doc = new JsPdf({ orientation: "landscape", unit: "pt", format: "a4" });

  sections.forEach((section, index) => {
    if (index > 0) {
      doc.addPage();
    }

    doc.setFontSize(18);
    doc.setTextColor(24, 24, 27);
    doc.text(reportTitle, 40, 42);
    doc.setFontSize(10);
    doc.setTextColor(82, 82, 91);
    doc.text(`Date Range: ${dateRange}`, 40, 62);
    doc.setFontSize(13);
    doc.setTextColor(24, 24, 27);
    doc.text(section.title, 40, 88);

    const headers = getSectionHeaders(section.rows);
    const columnHeaders = headers.length > 0 ? headers : ["Status"];
    const body: ExportCell[][] =
      section.rows.length > 0
        ? section.rows.map((row) =>
            columnHeaders.map((header) => normalizeExportValue(row[header])),
          )
        : [["No data available"]];

    autoTable(doc, {
      startY: 100,
      head: [columnHeaders],
      body,
      theme: "grid",
      headStyles: { fillColor: [13, 148, 136] },
      styles: { fontSize: 9, cellPadding: 6 },
      margin: { left: 40, right: 40, top: 100, bottom: 40 },
    });
  });

  doc.save(`${baseFileName}.pdf`);
}

// ─── Table ───────────────────────────────────────────────────────────────────

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  mono,
}: {
  children: React.ReactNode;
  right?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2.5 text-sm ${right ? "text-right" : ""} ${mono ? "tabular-nums" : ""}`}
    >
      {children}
    </td>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.ACCOUNTANT,
  ]);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [activeTab, setActiveTab] = useState<TabId>("production");
  const [from, setFrom] = useState(isoDate(firstOfMonth));
  const [to, setTo] = useState(isoDate(now));
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [useServerExport, setUseServerExport] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const { data: ordersRaw, isLoading: ordersLoading } = useQuery<
    ProductionOrder[]
  >({
    queryKey: ["reports-orders", from, to],
    queryFn: () =>
      api
        .get("/production-orders", {
          params: { limit: 500, includeOperations: true },
        })
        .then((r) => {
          const raw = r.data as unknown;
          // Handle both new { items } shape and legacy plain array
          if (raw && typeof raw === "object" && !Array.isArray(raw) && "items" in (raw as Record<string, unknown>)) {
            return (raw as { items: ProductionOrder[] }).items;
          }
          return (Array.isArray(raw) ? raw : []) as ProductionOrder[];
        }),
  });

  const { data: activitiesRaw, isLoading: activitiesLoading } = useQuery<{
    items: FactoryActivity[];
  }>({
    queryKey: ["reports-activities", from, to],
    queryFn: () =>
      api
        .get("/factory-activity", { params: { limit: 500 } })
        .then((r) => r.data),
  });

  const { data: inventoryRaw, isLoading: inventoryLoading } = useQuery<{
    items: InventoryItem[];
  }>({
    queryKey: ["reports-inventory"],
    queryFn: () =>
      api.get("/inventory", { params: { limit: 500 } }).then((r) => {
        const raw = r.data as Record<string, unknown>;
        const rawItems = (
          Array.isArray(raw) ? raw : (raw.items ?? raw.data ?? [])
        ) as Record<string, unknown>[];
        const items: InventoryItem[] = rawItems.map((o) => {
          const qty =
            (typeof o["quantityInStock"] === "number" &&
              (o["quantityInStock"] as number)) ||
            (typeof o["stockOnHand"] === "number" &&
              (o["stockOnHand"] as number)) ||
            (typeof o["stock_on_hand"] === "number" &&
              (o["stock_on_hand"] as number)) ||
            0;
          const costRaw =
            o["averagePrice"] ??
            o["average_price"] ??
            o["purchaseRate"] ??
            o["purchase_rate"] ??
            o["unitCost"];
          return {
            id: String(o["id"] ?? o["itemId"] ?? o["item_id"] ?? ""),
            itemName: String(
              o["itemName"] ?? o["name"] ?? o["description"] ?? "",
            ),
            paperType: String(
              o["paperType"] ?? o["category"] ?? o["item_type"] ?? "",
            ),
            quantityInStock: Math.round(Number(qty)),
            reorderLevel:
              o["reorderLevel"] != null ? Number(o["reorderLevel"]) : undefined,
            unitCost: costRaw != null ? String(costRaw) : undefined,
          };
        });
        return { items };
      }),
    staleTime: 5 * 60 * 1000,
  });

  const orders = ordersRaw ?? [];
  const activities = activitiesRaw?.items ?? [];
  const inventory = inventoryRaw?.items ?? [];

  // ── Derived: Production Summary ──────────────────────────────────────────

  const totalOrders = orders.length;
  const completedOrders = orders.filter(
    (o) => o.status === "COMPLETE" || o.status === "COMPLETED",
  ).length;
  const inProgressOrders = orders.filter(
    (o) => o.status === "IN_PROGRESS",
  ).length;
  const pendingOrders = orders.filter(
    (o) => !o.status || o.status === "PENDING",
  ).length;

  // Order-type split: Make to Order (sales-order-driven) vs Make to Stock.
  // Legacy "SALES_ORDER" values count as Make to Order.
  const makeToOrderCount = orders.filter(
    (o) => o.orderType === "MAKE_TO_ORDER" || o.orderType === "SALES_ORDER",
  ).length;
  const makeToStockCount = orders.filter(
    (o) => o.orderType === "MAKE_TO_STOCK",
  ).length;
  const otherOrderTypeCount = totalOrders - makeToOrderCount - makeToStockCount;

  const allOps = orders.flatMap((o) => o.productOrderOperations ?? []);
  const completedOps = allOps.filter((op) => op.stageStatus === "COMPLETE");

  // ── Derived: Stage Performance ────────────────────────────────────────────

  const stageStats = STAGE_ORDER.map((stage) => {
    const ops = allOps.filter((op) => op.operationStage === stage);
    const complete = ops.filter((op) => op.stageStatus === "COMPLETE").length;
    const pending = ops.filter((op) => op.stageStatus === "PENDING").length;
    const inProg = ops.filter((op) => op.stageStatus === "IN_PROGRESS").length;
    const avgDays =
      ops
        .filter((op) => op.completedAt && op.startedAt)
        .reduce(
          (acc, op) => acc + daysBetween(op.startedAt!, op.completedAt!),
          0,
        ) / (ops.filter((op) => op.completedAt && op.startedAt).length || 1);
    return { stage, total: ops.length, complete, pending, inProg, avgDays };
  }).filter((s) => s.total > 0);

  // ── Derived: Wastage ──────────────────────────────────────────────────────

  const wastageOps = allOps.filter(
    (op) =>
      op.wastageFromPrinting != null ||
      op.wastageFromDiecutting != null ||
      op.wastageFromLaminating != null ||
      op.wastageFromHandling != null,
  );

  const totalWastage = wastageOps.reduce((acc, op) => {
    return (
      acc +
      (op.wastageFromPrinting ?? 0) +
      (op.wastageFromDiecutting ?? 0) +
      (op.wastageFromLaminating ?? 0) +
      (op.wastageFromHandling ?? 0)
    );
  }, 0);

  const wastageByType = [
    {
      label: "Printing",
      total: allOps.reduce((a, op) => a + (op.wastageFromPrinting ?? 0), 0),
    },
    {
      label: "Diecutting",
      total: allOps.reduce((a, op) => a + (op.wastageFromDiecutting ?? 0), 0),
    },
    {
      label: "Laminating",
      total: allOps.reduce((a, op) => a + (op.wastageFromLaminating ?? 0), 0),
    },
    {
      label: "Handling/Stains",
      total: allOps.reduce((a, op) => a + (op.wastageFromHandling ?? 0), 0),
    },
  ];

  // ── Derived: Workers ──────────────────────────────────────────────────────

  type SupervisorStats = {
    name: string;
    staffId: string;
    sessions: number;
    totalAllocated: number;
    totalFinished: number;
    totalWasted: number;
  };

  const supervisorMap = new Map<string, SupervisorStats>();
  for (const a of activities) {
    const key = a.supervisor.staffId;
    const existing = supervisorMap.get(key);
    if (existing) {
      existing.sessions += 1;
      existing.totalAllocated += a.quantityAllocated;
      existing.totalFinished += a.quantityFinished;
      existing.totalWasted += a.quantityWasted;
    } else {
      supervisorMap.set(key, {
        name: `${a.supervisor.firstName} ${a.supervisor.lastName}`,
        staffId: a.supervisor.staffId,
        sessions: 1,
        totalAllocated: a.quantityAllocated,
        totalFinished: a.quantityFinished,
        totalWasted: a.quantityWasted,
      });
    }
  }
  const supervisorStats = Array.from(supervisorMap.values()).sort(
    (a, b) => b.totalFinished - a.totalFinished,
  );

  const totalActivityAllocated = activities.reduce(
    (a, x) => a + x.quantityAllocated,
    0,
  );
  const totalActivityFinished = activities.reduce(
    (a, x) => a + x.quantityFinished,
    0,
  );
  const totalActivityWasted = activities.reduce(
    (a, x) => a + x.quantityWasted,
    0,
  );

  // finishing type breakdown
  const finishingTypeMap = new Map<
    string,
    { count: number; finished: number }
  >();
  for (const a of activities) {
    const t = a.typeOfFinishing ?? "Other";
    const ex = finishingTypeMap.get(t);
    if (ex) {
      ex.count += 1;
      ex.finished += a.quantityFinished;
    } else {
      finishingTypeMap.set(t, { count: 1, finished: a.quantityFinished });
    }
  }
  const finishingTypeStats = Array.from(finishingTypeMap.entries())
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.finished - a.finished);

  // ── Derived: Delays ───────────────────────────────────────────────────────

  const overdueOps = allOps.filter(
    (op) =>
      op.expectedTimeline &&
      op.stageStatus !== "COMPLETE" &&
      new Date(op.expectedTimeline) < now,
  );

  const ordersWithDelay = orders
    .map((order) => {
      const overdue = (order.productOrderOperations ?? []).filter(
        (op) =>
          op.expectedTimeline &&
          op.stageStatus !== "COMPLETE" &&
          new Date(op.expectedTimeline) < now,
      );
      return { ...order, overdueCount: overdue.length };
    })
    .filter((o) => o.overdueCount > 0)
    .sort((a, b) => b.overdueCount - a.overdueCount);

  // ── Derived: Inventory ────────────────────────────────────────────────────

  const lowStockItems = inventory.filter(
    (item) =>
      item.reorderLevel != null && item.quantityInStock <= item.reorderLevel,
  );
  const outOfStockItems = inventory.filter(
    (item) => item.quantityInStock === 0,
  );
  const totalStockValue = inventory.reduce(
    (acc, item) =>
      acc + (item.unitCost ? Number(item.unitCost) * item.quantityInStock : 0),
    0,
  );

  // ── Derived: Financial ────────────────────────────────────────────────────

  const totalLaborCost = activities.reduce(
    (acc, a) =>
      acc +
      (a.costPerFinish ? Number(a.costPerFinish) * a.quantityFinished : 0),
    0,
  );

  const totalCutCost = allOps.reduce(
    (acc, op) => acc + (op.costPerCutSheet ? Number(op.costPerCutSheet) : 0),
    0,
  );

  const productionCompletionRate =
    totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const workerEfficiency =
    totalActivityAllocated > 0
      ? Math.round((totalActivityFinished / totalActivityAllocated) * 100)
      : 0;
  const highestWastageOrders = orders
    .map((order) => ({
      ...order,
      totalWaste: (order.productOrderOperations ?? []).reduce(
        (acc, op) =>
          acc +
          (op.wastageFromPrinting ?? 0) +
          (op.wastageFromDiecutting ?? 0) +
          (op.wastageFromLaminating ?? 0) +
          (op.wastageFromHandling ?? 0),
        0,
      ),
    }))
    .filter((order) => order.totalWaste > 0)
    .sort((a, b) => b.totalWaste - a.totalWaste);
  const inventoryByStock = [...inventory].sort(
    (a, b) => a.quantityInStock - b.quantityInStock,
  );
  const financialByFinishingType = Array.from(
    activities.reduce((map, activity) => {
      const type = activity.typeOfFinishing ?? "Other";
      const existing = map.get(type) ?? {
        sessions: 0,
        finished: 0,
        cost: 0,
      };
      const earning = activity.costPerFinish
        ? Number(activity.costPerFinish) * activity.quantityFinished
        : 0;
      map.set(type, {
        sessions: existing.sessions + 1,
        finished: existing.finished + activity.quantityFinished,
        cost: existing.cost + earning,
      });
      return map;
    }, new Map<string, { sessions: number; finished: number; cost: number }>()),
  )
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([type, values]) => ({ type, ...values }));
  const activeReportTitle =
    TABS.find((tab) => tab.id === activeTab)?.label ?? "Report";
  const reportDateRange = `${formatDateCell(from)} to ${formatDateCell(to)}`;
  const exportSections: ExportSection[] = (() => {
    switch (activeTab) {
      case "production":
        return [
          {
            title: "Production Summary",
            rows: [
              {
                "Total Orders": totalOrders,
                Completed: completedOrders,
                "In Progress": inProgressOrders,
                Pending: pendingOrders,
                "Completion Rate (%)": productionCompletionRate,
              },
            ],
          },
          {
            title: "Operations Overview",
            rows: stageStats.map((stage) => ({
              Stage: formatStageLabel(stage.stage),
              "Total Ops": stage.total,
              Complete: stage.complete,
              "In Progress": stage.inProg,
              Pending: stage.pending,
              "Completion Rate (%)":
                stage.total > 0 ? Math.round((stage.complete / stage.total) * 100) : 0,
            })),
          },
        ];
      case "stages":
        return [
          {
            title: "Stage Performance",
            rows: stageStats.map((stage) => ({
              Stage: formatStageLabel(stage.stage),
              Operations: stage.total,
              Completed: stage.complete,
              "In Progress": stage.inProg,
              Pending: stage.pending,
              "Avg Days":
                Number.isFinite(stage.avgDays) && !Number.isNaN(stage.avgDays)
                  ? Number(stage.avgDays.toFixed(1))
                  : "—",
              "Completion Rate (%)":
                stage.total > 0 ? Math.round((stage.complete / stage.total) * 100) : 0,
            })),
          },
        ];
      case "wastage":
        return [
          {
            title: "Wastage Breakdown",
            rows: wastageByType
              .filter((item) => item.total > 0)
              .map((item) => ({
                Type: item.label,
                "Total Units": item.total,
                "Share (%)":
                  totalWastage > 0
                    ? Math.round((item.total / totalWastage) * 100)
                    : 0,
              })),
          },
          {
            title: "Orders With Highest Wastage",
            rows: highestWastageOrders.map((order) => ({
              Order: order.sku,
              Product: order.product?.name ?? order.productName,
              "Total Wastage": order.totalWaste,
            })),
          },
        ];
      case "workers":
        return [
          {
            title: "Worker Activity Summary",
            rows: [
              {
                Sessions: activities.length,
                Allocated: totalActivityAllocated,
                Finished: totalActivityFinished,
                Wasted: totalActivityWasted,
                "Efficiency (%)": workerEfficiency,
              },
            ],
          },
          {
            title: "Supervisor Performance",
            rows: supervisorStats.map((supervisor) => ({
              Supervisor: supervisor.name,
              "Staff ID": supervisor.staffId,
              Sessions: supervisor.sessions,
              Allocated: supervisor.totalAllocated,
              Finished: supervisor.totalFinished,
              Wasted: supervisor.totalWasted,
              "Efficiency (%)":
                supervisor.totalAllocated > 0
                  ? Math.round(
                      (supervisor.totalFinished / supervisor.totalAllocated) * 100,
                    )
                  : 0,
            })),
          },
          {
            title: "Finishing Type Breakdown",
            rows: finishingTypeStats.map((item) => ({
              Type: item.type,
              Sessions: item.count,
              "Units Finished": item.finished,
            })),
          },
        ];
      case "delays":
        return [
          {
            title: "Delay Summary",
            rows: [
              {
                "Overdue Operations": overdueOps.length,
                "Orders With Delays": ordersWithDelay.length,
                "Total Orders": totalOrders,
              },
            ],
          },
          {
            title: "Orders With Overdue Stages",
            rows: ordersWithDelay.map((order) => ({
              Order: order.sku,
              Product: order.product?.name ?? order.productName,
              Status: order.status ?? "PENDING",
              "Overdue Stages": order.overdueCount,
            })),
          },
          {
            title: "Overdue Operations",
            rows: overdueOps.map((op) => ({
              Stage: formatStageLabel(op.operationStage),
              Status: op.stageStatus ?? "PENDING",
              "Expected By": formatDateCell(op.expectedTimeline),
              "Days Overdue": op.expectedTimeline
                ? daysBetween(op.expectedTimeline, isoDate(now))
                : "—",
            })),
          },
        ];
      case "inventory":
        return [
          {
            title: "Inventory Summary",
            rows: [
              {
                "Total Items": inventory.length,
                "Low Stock": lowStockItems.length,
                "Out Of Stock": outOfStockItems.length,
                "Stock Value (₦)": Number(totalStockValue.toFixed(2)),
              },
            ],
          },
          {
            title: "Low Stock Items",
            rows: lowStockItems.map((item) => ({
              Item: item.itemName,
              "Paper Type": item.paperType,
              "In Stock": item.quantityInStock,
              "Reorder Level": item.reorderLevel ?? "—",
              Gap:
                item.reorderLevel != null
                  ? item.reorderLevel - item.quantityInStock
                  : "—",
            })),
          },
          {
            title: "Full Inventory Stock Levels",
            rows: inventoryByStock.map((item) => ({
              Item: item.itemName,
              "Paper Type": item.paperType,
              "In Stock": item.quantityInStock,
              "Unit Cost (₦)": item.unitCost ? Number(item.unitCost) : "—",
              "Total Value (₦)": item.unitCost
                ? Number(item.unitCost) * item.quantityInStock
                : "—",
            })),
          },
        ];
      case "financial":
        return [
          {
            title: "Financial Summary",
            rows: [
              {
                "Total Labour Cost (₦)": Number(totalLaborCost.toFixed(2)),
                "Inventory Stock Value (₦)": Number(totalStockValue.toFixed(2)),
                "Cut Sheet Cost (₦)": Number(totalCutCost.toFixed(2)),
              },
            ],
          },
          {
            title: "Labour Cost by Finishing Type",
            rows: financialByFinishingType.map((item) => ({
              "Finishing Type": item.type,
              Sessions: item.sessions,
              "Units Finished": item.finished,
              "Total Labour Cost (₦)": Number(item.cost.toFixed(2)),
            })),
          },
        ];
      default:
        return [];
    }
  })();

  async function handleExport(format: ExportFormat) {
    try {
      setExportingFormat(format);

      if (useServerExport) {
        // Server-side export via new /reports/export endpoint
        const params = new URLSearchParams({
          type: activeTab,
          format,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        });
        const response = await api.get(`/reports/export?${params.toString()}`, {
          responseType: 'blob',
        });
        const contentDisposition = response.headers['content-disposition'];
        const fileNameMatch = contentDisposition?.match(/filename="(.+)"/);
        const fileName = fileNameMatch ? fileNameMatch[1] : `report-${activeTab}.${format}`;
        downloadBlob(response.data, fileName);
        toast.success(`${activeReportTitle} downloaded as ${EXPORT_FORMAT_LABELS[format]} (server)`);
        return;
      }

      const baseFileName = `${sanitizeFileNameSegment(activeReportTitle)}-${sanitizeFileNameSegment(from || "all")}-${sanitizeFileNameSegment(to || "all")}`;

      if (format === "csv") {
        const csvContent = buildCsvContent(
          activeReportTitle,
          reportDateRange,
          exportSections,
        );
        downloadBlob(
          new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
          `${baseFileName}.csv`,
        );
      } else if (format === "xlsx") {
        await exportSectionsToXlsx(
          activeReportTitle,
          reportDateRange,
          exportSections,
          baseFileName,
        );
      } else {
        await exportSectionsToPdf(
          activeReportTitle,
          reportDateRange,
          exportSections,
          baseFileName,
        );
      }

      toast.success(`${activeReportTitle} downloaded as ${EXPORT_FORMAT_LABELS[format]}`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to export ${activeReportTitle}`);
    } finally {
      setExportingFormat(null);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  const isAnyLoading = ordersLoading || activitiesLoading || inventoryLoading;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Reports</h1>
          <p className="text-sm text-zinc-500">
            Production analytics, efficiency metrics, and financial overview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={useServerExport}
              onChange={(e) => setUseServerExport(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Server export
          </label>
          {(["csv", "xlsx", "pdf"] as const).map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={isAnyLoading || exportingFormat !== null}
              onClick={() => void handleExport(format)}
            >
              <Download className="h-3.5 w-3.5" />
              {exportingFormat === format
                ? `Exporting ${EXPORT_FORMAT_LABELS[format]}`
                : EXPORT_FORMAT_LABELS[format]}
            </Button>
          ))}
        </div>
      </div>

      {/* Date Filter */}
      <DateFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-zinc-200 bg-white text-teal-600"
                  : "border-transparent bg-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isAnyLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── PRODUCTION SUMMARY ─────────────────────────────────────────── */}
          {activeTab === "production" && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  title="Total Orders"
                  value={fmt(totalOrders)}
                  icon={FileText}
                  color="blue"
                />
                <StatCard
                  title="Completed"
                  value={fmt(completedOrders)}
                  icon={BarChart2}
                  color="green"
                  sub={`${productionCompletionRate}% completion rate`}
                />
                <StatCard
                  title="In Progress"
                  value={fmt(inProgressOrders)}
                  icon={TrendingUp}
                  color="teal"
                />
                <StatCard
                  title="Pending"
                  value={fmt(pendingOrders)}
                  icon={Clock}
                  color="orange"
                />
              </div>

              {/* Order Type breakdown */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  title="Make to Order"
                  value={fmt(makeToOrderCount)}
                  sub="Tied to a sales order"
                  icon={FileText}
                  color="purple"
                />
                <StatCard
                  title="Make to Stock"
                  value={fmt(makeToStockCount)}
                  sub="Replenishing inventory"
                  icon={Package}
                  color="teal"
                />
                <StatCard
                  title="Other / Legacy"
                  value={fmt(otherOrderTypeCount)}
                  sub="Untyped or custom order type"
                  icon={AlertTriangle}
                  color="orange"
                />
              </div>

              {/* Operations summary */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Order Status Distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-600">
                      Order Status Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Completed", value: completedOrders },
                            { name: "In Progress", value: inProgressOrders },
                            { name: "Pending", value: pendingOrders },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#0d9488" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Stage Completion Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-600">
                      Stage Completion Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={stageStats.map((s) => ({
                          stage: s.stage.replace(/_/g, " ").slice(0, 12),
                          Complete: s.complete,
                          "In Progress": s.inProg,
                          Pending: s.pending,
                        }))}
                        margin={{ left: 0, right: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="stage"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="Complete"
                          fill="#22c55e"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          dataKey="In Progress"
                          fill="#0d9488"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          dataKey="Pending"
                          fill="#f59e0b"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Operations table */}
              <ReportSection title="Operations Overview">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Stage</Th>
                          <Th right>Total Ops</Th>
                          <Th right>Complete</Th>
                          <Th right>In Progress</Th>
                          <Th right>Pending</Th>
                          <Th right>Completion %</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {stageStats.map((s) => (
                          <tr key={s.stage} className="hover:bg-zinc-50/50">
                            <Td>
                              <span className="font-medium">
                                {s.stage.replace(/_/g, " ")}
                              </span>
                            </Td>
                            <Td right mono>
                              {fmt(s.total)}
                            </Td>
                            <Td right mono>
                              <span className="text-green-700">
                                {fmt(s.complete)}
                              </span>
                            </Td>
                            <Td right mono>
                              <span className="text-teal-600">
                                {fmt(s.inProg)}
                              </span>
                            </Td>
                            <Td right mono>
                              <span className="text-zinc-400">
                                {fmt(s.pending)}
                              </span>
                            </Td>
                            <Td right>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  s.total > 0 && s.complete / s.total >= 0.8
                                    ? "bg-green-100 text-green-700"
                                    : s.total > 0 && s.complete / s.total >= 0.5
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-600"
                                }`}
                              >
                                {s.total > 0
                                  ? Math.round((s.complete / s.total) * 100)
                                  : 0}
                                %
                              </span>
                            </Td>
                          </tr>
                        ))}
                        {stageStats.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No operations in selected range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}

          {/* ── STAGE PERFORMANCE ─────────────────────────────────────────── */}
          {activeTab === "stages" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  title="Total Operations"
                  value={fmt(allOps.length)}
                  icon={Layers}
                  color="blue"
                />
                <StatCard
                  title="Completed Ops"
                  value={fmt(completedOps.length)}
                  icon={BarChart2}
                  color="green"
                />
                <StatCard
                  title="Overdue Ops"
                  value={fmt(overdueOps.length)}
                  icon={AlertTriangle}
                  color="red"
                />
                <StatCard
                  title="Stages Tracked"
                  value={stageStats.length}
                  icon={FileText}
                  color="teal"
                />
              </div>

              <ReportSection title="Stage Completion Times">
                {/* Average days per stage chart */}
                {stageStats.length > 0 && (
                  <Card className="mb-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-zinc-600">
                        Average Completion Days by Stage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={stageStats
                            .filter(
                              (s) =>
                                !isNaN(s.avgDays) && isFinite(s.avgDays),
                            )
                            .map((s) => ({
                              stage: s.stage
                                .replace(/_/g, " ")
                                .slice(0, 12),
                              days: Number(s.avgDays.toFixed(1)),
                              rate:
                                s.total > 0
                                  ? Math.round(
                                      (s.complete / s.total) * 100,
                                    )
                                  : 0,
                            }))}
                          margin={{ left: 0, right: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="stage"
                            tick={{ fontSize: 10 }}
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar
                            dataKey="days"
                            name="Avg Days"
                            fill="#2563eb"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Stage</Th>
                          <Th right>Operations</Th>
                          <Th right>Completed</Th>
                          <Th right>Avg. Days</Th>
                          <Th right>Rate</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {stageStats.map((s) => (
                          <tr key={s.stage} className="hover:bg-zinc-50/50">
                            <Td>
                              <span className="font-medium">
                                {s.stage.replace(/_/g, " ")}
                              </span>
                            </Td>
                            <Td right mono>
                              {fmt(s.total)}
                            </Td>
                            <Td right mono>
                              <span className="text-green-700">
                                {fmt(s.complete)}
                              </span>
                            </Td>
                            <Td right mono>
                              {isNaN(s.avgDays) || !isFinite(s.avgDays)
                                ? "—"
                                : `${s.avgDays.toFixed(1)}d`}
                            </Td>
                            <Td right>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  s.total > 0 && s.complete / s.total >= 0.8
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {s.total > 0
                                  ? Math.round((s.complete / s.total) * 100)
                                  : 0}
                                %
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}

          {/* ── WASTAGE & COST ────────────────────────────────────────────── */}
          {activeTab === "wastage" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  title="Total Wastage"
                  value={fmt(totalWastage)}
                  icon={AlertTriangle}
                  color="red"
                  sub="sheets / units across all stages"
                />
                <StatCard
                  title="From Printing"
                  value={fmt(wastageByType[0].total)}
                  icon={AlertTriangle}
                  color="orange"
                />
                <StatCard
                  title="From Diecutting"
                  value={fmt(wastageByType[1].total)}
                  icon={AlertTriangle}
                  color="orange"
                />
                <StatCard
                  title="From Laminating"
                  value={fmt(wastageByType[2].total)}
                  icon={AlertTriangle}
                  color="orange"
                />
              </div>

              <ReportSection title="Wastage by Type">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Wastage Pie Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-zinc-600">
                        Wastage Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={wastageByType
                              .filter((w) => w.total > 0)
                              .map((w) => ({
                                name: w.label,
                                value: w.total,
                              }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }: { name?: string; percent?: number }) =>
                              `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                            }
                          >
                            {wastageByType
                              .filter((w) => w.total > 0)
                              .map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    CHART_COLORS[i % CHART_COLORS.length]
                                  }
                                />
                              ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Wastage Bar Chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-zinc-600">
                        Wastage by Source
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={wastageByType
                            .filter((w) => w.total > 0)
                            .map((w) => ({
                              name: w.label,
                              units: w.total,
                            }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar
                            dataKey="units"
                            fill="#ef4444"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Wastage Type</Th>
                          <Th right>Total Units</Th>
                          <Th right>% of Total</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {wastageByType
                          .filter((w) => w.total > 0)
                          .map((w) => (
                            <tr key={w.label} className="hover:bg-zinc-50/50">
                              <Td>
                                <span className="font-medium">{w.label}</span>
                              </Td>
                              <Td right mono>
                                <span className="text-red-600">
                                  {fmt(w.total)}
                                </span>
                              </Td>
                              <Td right>
                                {totalWastage > 0
                                  ? `${Math.round((w.total / totalWastage) * 100)}%`
                                  : "—"}
                              </Td>
                            </tr>
                          ))}
                        {wastageByType.every((w) => w.total === 0) && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No wastage recorded in selected range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>

              <ReportSection title="Orders with Highest Wastage">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Order</Th>
                          <Th>Product</Th>
                          <Th right>Total Wastage</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {highestWastageOrders.slice(0, 10).map((o) => (
                            <tr key={o.id} className="hover:bg-zinc-50/50">
                              <Td>
                                <span className="font-mono text-xs">
                                  {o.sku}
                                </span>
                              </Td>
                              <Td>{o.product?.name ?? o.productName}</Td>
                              <Td right mono>
                                <span className="text-red-600">
                                  {fmt(o.totalWaste)}
                                </span>
                              </Td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}

          {/* ── WORKER ACTIVITY ───────────────────────────────────────────── */}
          {activeTab === "workers" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  title="Total Sessions"
                  value={fmt(activities.length)}
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  title="Total Allocated"
                  value={fmt(totalActivityAllocated)}
                  icon={Package}
                  color="teal"
                />
                <StatCard
                  title="Total Finished"
                  value={fmt(totalActivityFinished)}
                  icon={BarChart2}
                  color="green"
                />
                <StatCard
                  title="Overall Efficiency"
                  value={`${workerEfficiency}%`}
                  icon={TrendingUp}
                  color="purple"
                />
              </div>

              <ReportSection title="Supervisor Performance">
                {/* Supervisor Performance Bar Chart */}
                {supervisorStats.length > 0 && (
                  <Card className="mb-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-zinc-600">
                        Supervisor Output Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={supervisorStats.slice(0, 8).map((s) => ({
                            name: s.name.split(" ")[0],
                            Finished: s.totalFinished,
                            Wasted: s.totalWasted,
                          }))}
                          margin={{ left: 0, right: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar
                            dataKey="Finished"
                            fill="#22c55e"
                            radius={[2, 2, 0, 0]}
                          />
                          <Bar
                            dataKey="Wasted"
                            fill="#ef4444"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Supervisor</Th>
                          <Th>Staff ID</Th>
                          <Th right>Sessions</Th>
                          <Th right>Allocated</Th>
                          <Th right>Finished</Th>
                          <Th right>Wasted</Th>
                          <Th right>Efficiency</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {supervisorStats.map((s) => {
                          const eff =
                            s.totalAllocated > 0
                              ? Math.round(
                                  (s.totalFinished / s.totalAllocated) * 100,
                                )
                              : 0;
                          return (
                            <tr key={s.staffId} className="hover:bg-zinc-50/50">
                              <Td>
                                <span className="font-medium">{s.name}</span>
                              </Td>
                              <Td>
                                <span className="font-mono text-xs text-zinc-400">
                                  {s.staffId}
                                </span>
                              </Td>
                              <Td right mono>
                                {s.sessions}
                              </Td>
                              <Td right mono>
                                {fmt(s.totalAllocated)}
                              </Td>
                              <Td right mono>
                                <span className="text-green-700">
                                  {fmt(s.totalFinished)}
                                </span>
                              </Td>
                              <Td right mono>
                                <span className="text-red-600">
                                  {fmt(s.totalWasted)}
                                </span>
                              </Td>
                              <Td right>
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                    eff >= 95
                                      ? "bg-green-100 text-green-700"
                                      : eff >= 85
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-red-100 text-red-600"
                                  }`}
                                >
                                  {eff}%
                                </span>
                              </Td>
                            </tr>
                          );
                        })}
                        {supervisorStats.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No activity records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>

              <ReportSection title="Finishing Type Breakdown">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Type</Th>
                          <Th right>Sessions</Th>
                          <Th right>Units Finished</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {finishingTypeStats.map((t) => (
                          <tr key={t.type} className="hover:bg-zinc-50/50">
                            <Td>
                              <Badge variant="secondary">{t.type}</Badge>
                            </Td>
                            <Td right mono>
                              {t.count}
                            </Td>
                            <Td right mono>
                              <span className="text-green-700">
                                {fmt(t.finished)}
                              </span>
                            </Td>
                          </tr>
                        ))}
                        {finishingTypeStats.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No activity data.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}

          {/* ── ORDER DELAYS ──────────────────────────────────────────────── */}
          {activeTab === "delays" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard
                  title="Overdue Operations"
                  value={fmt(overdueOps.length)}
                  icon={AlertTriangle}
                  color="red"
                />
                <StatCard
                  title="Orders with Delays"
                  value={fmt(ordersWithDelay.length)}
                  icon={Clock}
                  color="orange"
                />
                <StatCard
                  title="Total Orders"
                  value={fmt(totalOrders)}
                  icon={FileText}
                  color="blue"
                />
              </div>

              <ReportSection title="Orders with Overdue Stages">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Order</Th>
                          <Th>Product</Th>
                          <Th>Status</Th>
                          <Th right>Overdue Stages</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {ordersWithDelay.slice(0, 20).map((o) => (
                          <tr key={o.id} className="hover:bg-zinc-50/50">
                            <Td>
                              <span className="font-mono text-xs">{o.sku}</span>
                            </Td>
                            <Td>{o.product?.name ?? o.productName}</Td>
                            <Td>
                              <Badge
                                variant={
                                  o.status === "IN_PROGRESS"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {o.status}
                              </Badge>
                            </Td>
                            <Td right>
                              <span className="font-semibold text-red-600">
                                {o.overdueCount}
                              </span>
                            </Td>
                          </tr>
                        ))}
                        {ordersWithDelay.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No overdue orders in selected range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>

              <ReportSection title="Overdue Operations Detail">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Stage</Th>
                          <Th>Status</Th>
                          <Th>Expected By</Th>
                          <Th right>Days Overdue</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {overdueOps.slice(0, 20).map((op) => (
                          <tr key={op.id} className="hover:bg-zinc-50/50">
                            <Td>{op.operationStage.replace(/_/g, " ")}</Td>
                            <Td>
                              <Badge variant="secondary" className="text-xs">
                                {op.stageStatus}
                              </Badge>
                            </Td>
                            <Td>
                              {op.expectedTimeline
                                ? new Date(
                                    op.expectedTimeline,
                                  ).toLocaleDateString()
                                : "—"}
                            </Td>
                            <Td right>
                              <span className="font-semibold text-red-600">
                                {op.expectedTimeline
                                  ? daysBetween(
                                      op.expectedTimeline,
                                      isoDate(now),
                                    )
                                  : "—"}
                              </span>
                            </Td>
                          </tr>
                        ))}
                        {overdueOps.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No overdue operations.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}

          {/* ── INVENTORY HEALTH ──────────────────────────────────────────── */}
          {activeTab === "inventory" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  title="Total Items"
                  value={fmt(inventory.length)}
                  icon={Package}
                  color="blue"
                />
                <StatCard
                  title="Low Stock"
                  value={fmt(lowStockItems.length)}
                  icon={AlertTriangle}
                  color="orange"
                />
                <StatCard
                  title="Out of Stock"
                  value={fmt(outOfStockItems.length)}
                  icon={AlertTriangle}
                  color="red"
                />
                <StatCard
                  title="Stock Value"
                  value={currency(totalStockValue)}
                  icon={DollarSign}
                  color="green"
                />
              </div>

              {lowStockItems.length > 0 && (
                <ReportSection title="Low Stock Items">
                  <Card>
                    <CardContent className="p-0">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-zinc-50">
                            <Th>Item</Th>
                            <Th>Paper Type</Th>
                            <Th right>In Stock</Th>
                            <Th right>Reorder Level</Th>
                            <Th right>Gap</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {lowStockItems.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-50/50">
                              <Td>
                                <span className="font-medium">
                                  {item.itemName}
                                </span>
                              </Td>
                              <Td>{item.paperType}</Td>
                              <Td right mono>
                                <span
                                  className={
                                    item.quantityInStock === 0
                                      ? "font-bold text-red-600"
                                      : "text-orange-600"
                                  }
                                >
                                  {fmt(item.quantityInStock)}
                                </span>
                              </Td>
                              <Td right mono>
                                {item.reorderLevel != null
                                  ? fmt(item.reorderLevel)
                                  : "—"}
                              </Td>
                              <Td right mono>
                                <span className="text-red-500">
                                  {item.reorderLevel != null
                                    ? fmt(
                                        item.reorderLevel -
                                          item.quantityInStock,
                                      )
                                    : "—"}
                                </span>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </ReportSection>
              )}

              <ReportSection title="Full Inventory Stock Levels">
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Item</Th>
                          <Th>Paper Type</Th>
                          <Th right>In Stock</Th>
                          <Th right>Unit Cost</Th>
                          <Th right>Total Value</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {inventoryByStock.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-50/50">
                              <Td>
                                <span className="font-medium">
                                  {item.itemName}
                                </span>
                              </Td>
                              <Td>{item.paperType}</Td>
                              <Td right mono>
                                <span
                                  className={
                                    item.quantityInStock === 0
                                      ? "font-bold text-red-600"
                                      : ""
                                  }
                                >
                                  {fmt(item.quantityInStock)}
                                </span>
                              </Td>
                              <Td right mono>
                                {item.unitCost
                                  ? currency(Number(item.unitCost))
                                  : "—"}
                              </Td>
                              <Td right mono>
                                {item.unitCost
                                  ? currency(
                                      Number(item.unitCost) *
                                        item.quantityInStock,
                                    )
                                  : "—"}
                              </Td>
                            </tr>
                          ))}
                        {inventory.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No inventory data.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}

          {/* ── FINANCIAL OVERVIEW ────────────────────────────────────────── */}
          {activeTab === "financial" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard
                  title="Total Labour Cost"
                  value={currency(totalLaborCost)}
                  icon={DollarSign}
                  color="teal"
                  sub="From factory worker activities"
                />
                <StatCard
                  title="Inventory Stock Value"
                  value={currency(totalStockValue)}
                  icon={Package}
                  color="blue"
                  sub="Based on unit costs"
                />
                <StatCard
                  title="Cut Sheet Cost"
                  value={currency(totalCutCost)}
                  icon={FileText}
                  color="purple"
                  sub="Sum of all cut sheet costs"
                />
              </div>

              <ReportSection title="Labour Cost by Finishing Type">
                {/* Cost breakdown chart */}
                <Card className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-600">
                      Cost Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Labour", value: totalLaborCost },
                            { name: "Materials", value: totalStockValue },
                            { name: "Cut Sheet", value: totalCutCost },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          <Cell fill="#0d9488" />
                          <Cell fill="#2563eb" />
                          <Cell fill="#8b5cf6" />
                        </Pie>
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-zinc-50">
                          <Th>Finishing Type</Th>
                          <Th right>Sessions</Th>
                          <Th right>Units Finished</Th>
                          <Th right>Total Labour Cost</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {financialByFinishingType.map((item) => (
                            <tr key={item.type} className="hover:bg-zinc-50/50">
                              <Td>
                                <Badge variant="secondary">{item.type}</Badge>
                              </Td>
                              <Td right mono>
                                {item.sessions}
                              </Td>
                              <Td right mono>
                                {fmt(item.finished)}
                              </Td>
                              <Td right mono>
                                <span className="font-medium text-teal-700">
                                  {currency(item.cost)}
                                </span>
                              </Td>
                            </tr>
                          ))}
                        {activities.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-8 text-center text-sm text-zinc-400"
                            >
                              No activity data for this range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </ReportSection>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
