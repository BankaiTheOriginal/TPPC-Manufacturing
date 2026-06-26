"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  CalendarClock,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import Link from "next/link";
import { useRequireRole, ROLES } from "@/lib/rbac";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductOrderOperation {
  id: string;
  operationStage: string;
  stageStatus: string | null;
  expectedTimeline: string | null;
  quantityFinished: number | null;
}

interface ProductOrder {
  id: string;
  sku: string;
  productName: string;
  productType: string;
  productCategory: string;
  quantity: number;
  priority: string;
  status: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  zohoBooksId: string | null;
  productOrderOperations: ProductOrderOperation[];
}

// ─── Derived types ────────────────────────────────────────────────────────────

type DueCategory = "PAST_DUE" | "DUE_TODAY" | "UPCOMING" | "NO_DATE";

interface OrderWithDue {
  order: ProductOrder;
  dueDate: Date | null;
  daysFromNow: number | null; // negative = past due, 0 = today, positive = upcoming
  category: DueCategory;
  delayReason: string;
  currentStage: string | null;
  completedStages: number;
  totalStages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function computeOrderDue(order: ProductOrder): OrderWithDue {
  const today = startOfDay(new Date());

  // Get the latest expectedTimeline across all operations
  const timelines = order.productOrderOperations
    .map((op) => op.expectedTimeline)
    .filter(Boolean)
    .map((t) => new Date(t!));

  const dueDate =
    timelines.length > 0
      ? new Date(Math.max(...timelines.map((d) => d.getTime())))
      : null;

  const dueDayStart = dueDate ? startOfDay(dueDate) : null;
  const diffMs = dueDayStart ? dueDayStart.getTime() - today.getTime() : null;
  const daysFromNow =
    diffMs !== null ? Math.round(diffMs / (1000 * 60 * 60 * 24)) : null;

  let category: DueCategory = "NO_DATE";
  if (daysFromNow !== null) {
    if (daysFromNow < 0) category = "PAST_DUE";
    else if (daysFromNow === 0) category = "DUE_TODAY";
    else category = "UPCOMING";
  }

  // Determine current active stage (first IN_PROGRESS or first non-COMPLETE)
  const sortedOps = [...order.productOrderOperations].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a.operationStage) -
      STAGE_ORDER.indexOf(b.operationStage),
  );
  const inProgressOp = sortedOps.find((op) => op.stageStatus === "IN_PROGRESS");
  const pendingOp = sortedOps.find(
    (op) => op.stageStatus === "PENDING" || op.stageStatus === null,
  );
  const currentStage =
    inProgressOp?.operationStage ??
    pendingOp?.operationStage ??
    null;

  const completedStages = sortedOps.filter(
    (op) => op.stageStatus === "COMPLETE",
  ).length;
  const totalStages = sortedOps.length;

  // Derive delay reason
  let delayReason = "No reason provided";
  if (order.notes?.trim()) {
    delayReason = order.notes.trim();
  } else if (category === "PAST_DUE") {
    if (currentStage) {
      delayReason = `Still in ${STAGE_LABELS[currentStage] ?? currentStage} stage`;
    } else {
      delayReason = "Operations incomplete";
    }
  } else if (order.status === "PENDING" && category !== "NO_DATE") {
    delayReason = "Order not yet started";
  }

  return {
    order,
    dueDate,
    daysFromNow,
    category,
    delayReason,
    currentStage,
    completedStages,
    totalStages,
  };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[140px] rounded-xl border p-4 text-left transition-all ${
        active
          ? "border-teal-400 bg-teal-50 shadow-sm"
          : "border-zinc-100 bg-white hover:bg-zinc-50"
      }`}
    >
      <div className={`mb-2 inline-flex rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-bold text-zinc-900">{count}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
    </button>
  );
}

// ─── Days Badge ───────────────────────────────────────────────────────────────

function DaysBadge({ days }: { days: number | null }) {
  if (days === null)
    return <span className="text-xs text-zinc-400">No date</span>;
  if (days === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        <CalendarClock className="h-3 w-3" />
        Due today
      </span>
    );
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" />
        {Math.abs(days)} day{Math.abs(days) !== 1 ? "s" : ""} overdue
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
      <Clock className="h-3 w-3" />
      {days} day{days !== 1 ? "s" : ""} left
    </span>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

const priorityColors: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

// ─── Order Status Badge ───────────────────────────────────────────────────────

const orderStatusColors: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETE: "bg-green-100 text-green-700",
  PARTIALLY_COMPLETE: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// ─── Progress mini bar ────────────────────────────────────────────────────────

function StageProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total === 0) return <span className="text-xs text-zinc-400">—</span>;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500 tabular-nums">
        {completed}/{total}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortKey = "daysFromNow" | "priority" | "sku" | "status";
type SortDir = "asc" | "desc";

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export default function CustomerCarePage() {
  useRequireRole([
    ...([
      ROLES.ADMINISTRATOR,
      ROLES.GENERAL_MANAGER,
      ROLES.PRODUCTION_MANAGER,
      ROLES.HEAD_OF_OPERATIONS,
    ]),
    ROLES.SUPERVISOR,
    ROLES.LOGISTICS_TEAM,
    ROLES.CUSTOMER_CARE,
  ]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DueCategory | "ALL">(
    "ALL",
  );
  const [sortKey, setSortKey] = useState<SortKey>("daysFromNow");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rawOrders = [], isLoading, refetch } = useQuery<ProductOrder[]>(
    {
      queryKey: ["production-orders-full"],
      queryFn: () =>
        api
          .get("/production-orders", {
            params: { limit: 500, includeOperations: true },
          })
          .then((r) => {
            const d = r.data;
            if (Array.isArray(d)) return d as ProductOrder[];
            if (Array.isArray(d?.items)) return d.items as ProductOrder[];
            return [] as ProductOrder[];
          }),
      staleTime: 60 * 1000,
    },
  );

  // Exclude completed/cancelled orders from the report
  const enriched = useMemo<OrderWithDue[]>(() => {
    return rawOrders
      .filter(
        (o) => o.status !== "COMPLETE" && o.status !== "CANCELLED",
      )
      .map(computeOrderDue);
  }, [rawOrders]);

  // Counts per category
  const counts = useMemo(
    () => ({
      ALL: enriched.length,
      PAST_DUE: enriched.filter((o) => o.category === "PAST_DUE").length,
      DUE_TODAY: enriched.filter((o) => o.category === "DUE_TODAY").length,
      UPCOMING: enriched.filter((o) => o.category === "UPCOMING").length,
      NO_DATE: enriched.filter((o) => o.category === "NO_DATE").length,
    }),
    [enriched],
  );

  // Filter + search + sort
  const visible = useMemo(() => {
    let list = enriched;

    if (categoryFilter !== "ALL") {
      list = list.filter((o) => o.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.order.productName.toLowerCase().includes(q) ||
          o.order.sku.toLowerCase().includes(q) ||
          (o.order.zohoBooksId ?? "").toLowerCase().includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "daysFromNow") {
        const av = a.daysFromNow ?? 99999;
        const bv = b.daysFromNow ?? 99999;
        cmp = av - bv;
      } else if (sortKey === "priority") {
        cmp =
          (PRIORITY_RANK[a.order.priority] ?? 9) -
          (PRIORITY_RANK[b.order.priority] ?? 9);
      } else if (sortKey === "sku") {
        cmp = a.order.sku.localeCompare(b.order.sku);
      } else if (sortKey === "status") {
        cmp = (a.order.status ?? "").localeCompare(b.order.status ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [enriched, categoryFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-0.5" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-0.5" />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Customer Care — Order Status
          </h1>
          <p className="text-sm text-zinc-500">
            Track active orders by due date status
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-3">
        <StatCard
          label="All Active"
          count={counts.ALL}
          icon={CheckCircle2}
          color="bg-zinc-100 text-zinc-500"
          active={categoryFilter === "ALL"}
          onClick={() => setCategoryFilter("ALL")}
        />
        <StatCard
          label="Past Due"
          count={counts.PAST_DUE}
          icon={AlertCircle}
          color="bg-red-100 text-red-600"
          active={categoryFilter === "PAST_DUE"}
          onClick={() => setCategoryFilter("PAST_DUE")}
        />
        <StatCard
          label="Due Today"
          count={counts.DUE_TODAY}
          icon={CalendarClock}
          color="bg-orange-100 text-orange-600"
          active={categoryFilter === "DUE_TODAY"}
          onClick={() => setCategoryFilter("DUE_TODAY")}
        />
        <StatCard
          label="Upcoming"
          count={counts.UPCOMING}
          icon={Clock}
          color="bg-blue-100 text-blue-600"
          active={categoryFilter === "UPCOMING"}
          onClick={() => setCategoryFilter("UPCOMING")}
        />
      </div>

      {/* Search + sort filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by product, SKU or Zoho ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as DueCategory | "ALL")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PAST_DUE">Past Due</SelectItem>
            <SelectItem value="DUE_TODAY">Due Today</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
            <SelectItem value="NO_DATE">No Date Set</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-zinc-500 hover:text-zinc-800"
                    onClick={() => toggleSort("sku")}
                  >
                    Order <SortIcon k="sku" />
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-zinc-500 hover:text-zinc-800"
                    onClick={() => toggleSort("status")}
                  >
                    Order Status <SortIcon k="status" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Current Stage
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Stage Progress
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Due Date
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-zinc-500 hover:text-zinc-800"
                    onClick={() => toggleSort("daysFromNow")}
                  >
                    Days Status <SortIcon k="daysFromNow" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Reason for Delay
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left font-medium text-zinc-500 hover:text-zinc-800"
                    onClick={() => toggleSort("priority")}
                  >
                    Priority <SortIcon k="priority" />
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-zinc-400"
                    >
                      {search || categoryFilter !== "ALL"
                        ? "No orders match the current filter"
                        : "No active orders"}
                    </td>
                  </tr>
                ) : (
                  visible.map(
                    ({
                      order,
                      dueDate,
                      daysFromNow,
                      category,
                      delayReason,
                      currentStage,
                      completedStages,
                      totalStages,
                    }) => {
                      const isExpanded = expandedId === order.id;
                      const rowHighlight =
                        category === "PAST_DUE"
                          ? "bg-red-50/40"
                          : category === "DUE_TODAY"
                            ? "bg-orange-50/40"
                            : "";
                      return (
                        <>
                          <tr
                            key={order.id}
                            className={`transition-colors hover:bg-zinc-50/80 ${rowHighlight}`}
                          >
                            {/* Order */}
                            <td className="px-4 py-3">
                              <div className="font-medium text-zinc-800">
                                {order.productName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-zinc-400 font-mono">
                                  {order.sku}
                                </span>
                                {order.zohoBooksId && (
                                  <span className="text-[10px] text-zinc-300 font-mono">
                                    · {order.zohoBooksId}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Order Status */}
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${orderStatusColors[order.status ?? "PENDING"]}`}
                              >
                                {order.status ?? "PENDING"}
                              </span>
                            </td>

                            {/* Current Stage */}
                            <td className="px-4 py-3 text-xs text-zinc-600">
                              {currentStage
                                ? STAGE_LABELS[currentStage] ?? currentStage
                                : "—"}
                            </td>

                            {/* Stage Progress */}
                            <td className="px-4 py-3">
                              <StageProgress
                                completed={completedStages}
                                total={totalStages}
                              />
                            </td>

                            {/* Due Date */}
                            <td className="px-4 py-3 text-xs text-zinc-600">
                              {dueDate ? fmtDate(dueDate) : "—"}
                            </td>

                            {/* Days Status */}
                            <td className="px-4 py-3">
                              <DaysBadge days={daysFromNow} />
                            </td>

                            {/* Reason for Delay */}
                            <td className="px-4 py-3 max-w-[220px]">
                              {category === "PAST_DUE" ||
                              category === "DUE_TODAY" ? (
                                <span
                                  className="block text-xs text-zinc-600 truncate"
                                  title={delayReason}
                                >
                                  {delayReason}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-300">—</span>
                              )}
                            </td>

                            {/* Priority */}
                            <td className="px-4 py-3">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColors[order.priority]}`}
                              >
                                {order.priority}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedId(
                                      isExpanded ? null : order.id,
                                    )
                                  }
                                  className="text-zinc-400 hover:text-zinc-700 transition-colors p-1 rounded"
                                  title={
                                    isExpanded ? "Collapse" : "Show stages"
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>
                                <Link
                                  href={`/production-orders/${order.id}`}
                                  className="text-zinc-400 hover:text-teal-600 transition-colors p-1 rounded"
                                  title="Open production order"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded: operation timeline */}
                          {isExpanded && (
                            <tr
                              key={`${order.id}-expanded`}
                              className={`${rowHighlight}`}
                            >
                              <td colSpan={9} className="px-4 pb-4 pt-0">
                                <div className="rounded-lg border border-zinc-100 bg-white p-3">
                                  <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">
                                    Stage Timeline
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {[...order.productOrderOperations]
                                      .sort(
                                        (a, b) =>
                                          STAGE_ORDER.indexOf(
                                            a.operationStage,
                                          ) -
                                          STAGE_ORDER.indexOf(b.operationStage),
                                      )
                                      .map((op) => {
                                        const isComplete =
                                          op.stageStatus === "COMPLETE";
                                        const isActive =
                                          op.stageStatus === "IN_PROGRESS";
                                        return (
                                          <div
                                            key={op.id}
                                            className={`flex flex-col rounded-md border px-3 py-2 text-xs min-w-[110px] ${
                                              isComplete
                                                ? "border-green-200 bg-green-50"
                                                : isActive
                                                  ? "border-blue-200 bg-blue-50"
                                                  : "border-zinc-100 bg-zinc-50"
                                            }`}
                                          >
                                            <span
                                              className={`font-medium ${isComplete ? "text-green-700" : isActive ? "text-blue-700" : "text-zinc-600"}`}
                                            >
                                              {STAGE_LABELS[op.operationStage] ??
                                                op.operationStage}
                                            </span>
                                            <span
                                              className={`mt-0.5 ${isComplete ? "text-green-500" : isActive ? "text-blue-500" : "text-zinc-400"}`}
                                            >
                                              {op.stageStatus ?? "PENDING"}
                                            </span>
                                            {op.expectedTimeline && (
                                              <span className="text-zinc-400 mt-0.5">
                                                Due{" "}
                                                {fmtDate(op.expectedTimeline)}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                  {order.notes && (
                                    <p className="mt-3 text-xs text-zinc-500 border-t border-zinc-100 pt-2">
                                      <span className="font-medium">
                                        Notes:{" "}
                                      </span>
                                      {order.notes}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {visible.length > 0 && (
        <p className="text-xs text-zinc-400 text-right">
          Showing {visible.length} of {enriched.length} active orders
        </p>
      )}
    </div>
  );
}
