"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useDeferredValue, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  ChevronLeft,
  ChevronRight,
  User,
  RefreshCw,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import Link from "next/link";
import {
  STAGE_LABELS,
  STAGES,
  STAGE_STATUS_OPTIONS,
  stageStatusColors,
  priorityColors,
  orderStatusColors,
} from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useAuthStore } from "@/lib/stores/auth-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignedStaff {
  id: string;
  firstName: string;
  lastName: string;
  staffId: string;
}

interface ProductOrderSummary {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  priority: string;
  status: string | null;
  zohoBooksId: string | null;
  createdAt: string;
  salesOrderNumber: string | null;
  salesOrderCustomerName: string | null;
  referenceId: string | null;
}

interface Task {
  id: string;
  operationStage: string;
  operationName: string | null;
  stageStatus: string | null;
  assignedStaffId: string | null;
  assignedStaff: AssignedStaff | null;
  quantityFinished: number | null;
  quantityWasted: number | null;
  availableQuantity: number;
  expectedQuantity: number;
  plannedCutQuantity: number;
  completedCutQuantity: number;
  hasNewCutouts: boolean;
  cutQuantity: number | null;
  quantityOfSheetsTaken: number | null;
  cutoutsPerSheet: number | null;
  paperSize: string | null;
  cutSize: string | null;
  expectedTimeline: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedTimeMin: number | null;
  inventory: { id: string; itemName: string; sku: string } | null;
  productOrder: ProductOrderSummary;
  createdAt: string;
  updatedAt: string;
}

interface TasksResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  staffId: string;
  role: string;
}

interface ProductionOrderOption {
  id: string;
  sku: string;
  productName: string;
  zohoBooksId: string | null;
  createdAt: string;
  salesOrderNumber: string | null;
  salesOrderCustomerName: string | null;
  referenceId: string | null;
}

interface ConvertedSalesOrderOption {
  salesorderId: string;
  salesorderNumber: string;
  customerName: string | null;
  productionCount: number;
}

interface TaskFilterOptionsResponse {
  productionOrders: ProductionOrderOption[];
  salesOrders: ConvertedSalesOrderOption[];
}

interface TaskOrderFilterOption {
  key: string;
  filterType: "PRODUCTION_ORDER" | "SALES_ORDER";
  filterValue: string;
  label: string;
  searchText: string;
}

const TASK_ASSIGNMENT_ADMIN_ROLES = [
  ROLES.ADMINISTRATOR,
  ROLES.GENERAL_MANAGER,
  ROLES.PRODUCTION_MANAGER,
  ROLES.HEAD_OF_OPERATIONS,
] as const;

const TASK_PRIORITY_OPTIONS = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
] as const;

const TASK_SORT_OPTIONS = [
  { value: "DUE_ASC", label: "Due / ETA" },
  { value: "PRIORITY_ASC", label: "Priority" },
  { value: "STAGE_ASC", label: "Stage" },
  { value: "ORDER_ASC", label: "Production Order" },
] as const;

type TaskSortOption = (typeof TASK_SORT_OPTIONS)[number]["value"];

const STAGE_STATUS_LABELS = Object.fromEntries(
  STAGE_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

function getTaskQuantityTotal(task: Task) {
  return task.expectedQuantity ?? task.availableQuantity ?? task.productOrder.quantity;
}

function getTaskSortParams(sortOption: TaskSortOption) {
  switch (sortOption) {
    case "PRIORITY_ASC":
      return { sortBy: "priority", sortDirection: "asc" as const };
    case "STAGE_ASC":
      return { sortBy: "stage", sortDirection: "asc" as const };
    case "ORDER_ASC":
      return { sortBy: "order", sortDirection: "asc" as const };
    case "DUE_ASC":
    default:
      return { sortBy: "due", sortDirection: "asc" as const };
  }
}

// ─── Stage Status Icon ────────────────────────────────────────────────────────

function StageIcon({ status }: { status: string | null }) {
  if (status === "COMPLETE")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "PARTIALLY_COMPLETE")
    return <CheckCircle2 className="h-4 w-4 text-amber-500" />;
  if (status === "IN_PROGRESS")
    return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
  if (status === "NA") return <Circle className="h-4 w-4 text-zinc-300" />;
  return <Clock className="h-4 w-4 text-zinc-400" />;
}

// ─── Update Task Dialog ───────────────────────────────────────────────────────

interface UpdateTaskDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  allUsers: UserOption[];
  canAssignEmployee: boolean;
  onSaved: () => void;
}

type TaskOperationUpdate = Pick<Task, "id"> & Partial<Task>;

function mergeUpdatedTask(
  currentTask: Task,
  updatedTask: TaskOperationUpdate,
  allUsers: UserOption[],
): Task {
  if (currentTask.id !== updatedTask.id) {
    return currentTask;
  }

  const hasAssignedStaffId = Object.prototype.hasOwnProperty.call(
    updatedTask,
    "assignedStaffId",
  );
  const assignedStaffId = hasAssignedStaffId
    ? (updatedTask.assignedStaffId ?? null)
    : currentTask.assignedStaffId;
  const assignedStaff =
    assignedStaffId === null
      ? null
      : allUsers.find((userOption) => userOption.id === assignedStaffId) ??
        currentTask.assignedStaff;

  return {
    ...currentTask,
    ...updatedTask,
    assignedStaffId,
    assignedStaff,
  };
}

function UpdateTaskDialog({
  task,
  open,
  onClose,
  allUsers,
  canAssignEmployee,
  onSaved,
}: UpdateTaskDialogProps) {
  const qc = useQueryClient();
  const [stageStatus, setStageStatus] = useState<string | null>(
    task?.stageStatus ?? "PENDING",
  );
  const [quantityFinished, setQuantityFinished] = useState(
    task?.quantityFinished != null ? String(task.quantityFinished) : "",
  );
  const [quantityWasted, setQuantityWasted] = useState(
    task?.quantityWasted != null ? String(task.quantityWasted) : "",
  );
  const [expectedTimeline, setExpectedTimeline] = useState(
    task?.expectedTimeline ? task.expectedTimeline.slice(0, 10) : "",
  );
  const [assignedStaffId, setAssignedStaffId] = useState(
    task?.assignedStaffId ?? "",
  );
  const [staffSearch, setStaffSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const taskQuantityTotal = task ? getTaskQuantityTotal(task) : 0;

  const filteredStaff = allUsers.filter((u) => {
    const q = staffSearch.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.staffId.toLowerCase().includes(q)
    );
  });

  const updateMutation = useMutation<TaskOperationUpdate, unknown, object>({
    mutationFn: (body: object) =>
      api
        .post(`/production-orders/${task!.productOrder.id}/operations`, body)
        .then((r) => r.data as TaskOperationUpdate),
    onSuccess: async (updatedTask) => {
      console.log("[tasks] update response", {
        productOrderId: task!.productOrder.id,
        taskId: task!.id,
        updatedTask,
      });
      toast.success("Task updated");

      qc.setQueriesData<TasksResponse>({ queryKey: ["tasks"] }, (current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((currentTask) =>
                mergeUpdatedTask(currentTask, updatedTask, allUsers),
              ),
            }
          : current,
      );

      qc.setQueryData(
        ["production-orders", task!.productOrder.id],
        (current: unknown) => {
          if (!current || typeof current !== "object") {
            return current;
          }

          const currentOrder = current as Record<string, unknown> & {
            productOrderOperations?: Array<
              { id?: string } & Record<string, unknown>
            >;
          };

          if (!Array.isArray(currentOrder.productOrderOperations)) {
            return current;
          }

          return {
            ...currentOrder,
            productOrderOperations: currentOrder.productOrderOperations.map(
              (operation) =>
                operation.id === updatedTask.id
                  ? { ...operation, ...updatedTask }
                  : operation,
            ),
          };
        },
      );

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({
          queryKey: ["production-orders", task!.productOrder.id],
        }),
      ]);

      onSaved();
      onClose();
    },
    onError: (error) => {
      console.error("[tasks] update failed", {
        productOrderId: task?.productOrder.id,
        taskId: task?.id,
        error,
      });
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to update task";
      toast.error(message);
    },
  });

  function handleSave() {
    if (!task) return;
    setSaving(true);

    const body: Record<string, unknown> = {
      id: task.id,
      operationStage: task.operationStage,
      stageStatus,
    };

    if (quantityFinished !== "")
      body.quantityFinished = Number(quantityFinished);
    if (quantityWasted !== "") body.quantityWasted = Number(quantityWasted);
    if (expectedTimeline !== "") body.expectedTimeline = expectedTimeline;
    if (canAssignEmployee && assignedStaffId) {
      body.assignedStaffId = assignedStaffId;
    }

    console.log("[tasks] submitting update", {
      productOrderId: task.productOrder.id,
      taskId: task.id,
      payload: body,
    });

    updateMutation.mutate(body, {
      onSettled: () => setSaving(false),
    });
  }

  if (!task) return null;

  const finishedNum = quantityFinished !== "" ? Number(quantityFinished) : null;
  const selectedStaff =
    allUsers.find((userOption) => userOption.id === assignedStaffId) ??
    task.assignedStaff;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-lg sm:max-w-lg mx-auto flex flex-col max-h-[92dvh] overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-zinc-100 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-teal-500" />
            Update Task
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Task context */}
          <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-medium text-zinc-700">
                {STAGE_LABELS[task.operationStage] ?? task.operationStage}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageStatusColors[stageStatus ?? "PENDING"]}`}
              >
                {STAGE_STATUS_LABELS[stageStatus ?? "PENDING"] ??
                  stageStatus ??
                  "Pending"}
              </span>
            </div>
            <div className="text-zinc-500">
              <Link
                href={`/production-orders/${task.productOrder.id}`}
                className="hover:text-teal-600 hover:underline"
                onClick={onClose}
              >
                {task.productOrder.sku} — {task.productOrder.productName}
              </Link>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <span>Expected qty: {taskQuantityTotal}</span>
              {task.assignedStaff && (
                <span>
                  · Assigned to {task.assignedStaff.firstName}{" "}
                  {task.assignedStaff.lastName}
                </span>
              )}
            </div>
          </div>

          {/* Stage Status */}
          <div className="space-y-1.5">
            <Label>
              Stage Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={stageStatus}
              onValueChange={(value) => {
                if (value === null) return;
                setStageStatus(value);
                if (value === "COMPLETE" && quantityFinished === "") {
                  setQuantityFinished(String(taskQuantityTotal));
                }
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STAGE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expected Timeline */}
          <div className="space-y-1.5">
            <Label>Expected Timeline (Due Date)</Label>
            <Input
              type="date"
              className="h-11"
              value={expectedTimeline}
              onChange={(e) => setExpectedTimeline(e.target.value)}
            />
          </div>

          {/* Quantity Finished & Wasted — stacked on mobile, side-by-side on sm+ */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label>Items Completed</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={taskQuantityTotal}
                placeholder={`0 – ${taskQuantityTotal}`}
                className="h-11"
                value={quantityFinished}
                onChange={(e) => {
                  setQuantityFinished(e.target.value);
                  const num = Number(e.target.value);
                  if (num > 0 && stageStatus !== "COMPLETE") {
                    setStageStatus("PARTIALLY_COMPLETE");
                  }
                }}
              />
              {finishedNum !== null && finishedNum > taskQuantityTotal && (
                <p className="text-xs text-red-500">
                  Exceeds expected qty ({taskQuantityTotal})
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Items Wasted</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                className="h-11"
                value={quantityWasted}
                onChange={(e) => setQuantityWasted(e.target.value)}
              />
            </div>
          </div>

          {/* Progress preview */}
          {finishedNum !== null && (
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Progress preview</span>
              <ProgressBar value={finishedNum} total={taskQuantityTotal} />
            </div>
          )}

          {canAssignEmployee && (
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select
                value={assignedStaffId}
                onValueChange={(value) => {
                  if (value !== null) {
                    setAssignedStaffId(value);
                    setStaffSearch("");
                  }
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select employee">
                    {assignedStaffId && selectedStaff ? (
                      `${selectedStaff.firstName} ${selectedStaff.lastName} (${selectedStaff.staffId})`
                    ) : (
                      <span className="text-zinc-400">Select employee</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  showSearch
                  searchValue={staffSearch}
                  onSearchChange={setStaffSearch}
                  searchPlaceholder="Search staff by name or ID..."
                >
                  {filteredStaff.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-zinc-400">
                      No staff found
                    </div>
                  ) : (
                    filteredStaff.map((userOption) => (
                      <SelectItem key={userOption.id} value={userOption.id}>
                        {userOption.firstName} {userOption.lastName} (
                        {userOption.staffId})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <DialogFooter className="px-4 py-3 border-t border-zinc-100 shrink-0 flex flex-row gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 bg-teal-500 text-white hover:bg-teal-600"
            onClick={handleSave}
            disabled={saving || !stageStatus}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const LIMIT = 20;

export default function TasksPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.SUPERVISOR,
    ROLES.DESIGN_TEAM,
    ROLES.LOGISTICS_TEAM,
    ROLES.FACTORY_WORKER,
    ROLES.CUSTOMER_CARE,
  ]);

  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [taskSearch, setTaskSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("ALL");
  const [orderFilterSearch, setOrderFilterSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortOption, setSortOption] = useState<TaskSortOption>("DUE_ASC");
  const [page, setPage] = useState(1);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const deferredTaskSearch = useDeferredValue(taskSearch);

  const canAssignEmployee =
    !!user &&
    (TASK_ASSIGNMENT_ADMIN_ROLES as readonly string[]).includes(user.role);

  const {
    data: taskFilterOptions,
    isLoading: isTaskFilterOptionsLoading,
  } = useQuery<TaskFilterOptionsResponse>({
    queryKey: ["task-filter-options"],
    queryFn: () =>
      api.get("/production-orders/task-filter-options").then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const productionOrderOptions = taskFilterOptions?.productionOrders ?? [];
  const salesOrderOptions = taskFilterOptions?.salesOrders ?? [];

  const salesOrderFilterOptions: TaskOrderFilterOption[] = salesOrderOptions
    .map((salesOrder) => ({
      key: `SO:${salesOrder.salesorderId}`,
      filterType: "SALES_ORDER" as const,
      filterValue: salesOrder.salesorderId,
      label: `Sales Order: ${salesOrder.salesorderNumber}${salesOrder.customerName ? ` — ${salesOrder.customerName}` : ""}`,
      searchText: [
        salesOrder.salesorderNumber,
        salesOrder.customerName ?? "",
        "sales order",
      ]
        .join(" ")
        .toLowerCase(),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const productionOrderFilterOptions: TaskOrderFilterOption[] =
    productionOrderOptions
      .map((order) => ({
      key: `PO:${order.id}`,
      filterType: "PRODUCTION_ORDER" as const,
      filterValue: order.id,
      label: `Production: ${order.sku} — ${order.productName}`,
      searchText: [
        order.sku,
        order.productName,
        order.salesOrderNumber ?? "",
        order.salesOrderCustomerName ?? "",
        order.referenceId ?? "",
        "production order",
      ]
        .join(" ")
        .toLowerCase(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

  const orderFilterOptions = [
    ...salesOrderFilterOptions,
    ...productionOrderFilterOptions,
  ];
  const normalizedOrderFilterSearch = orderFilterSearch.trim().toLowerCase();
  const normalizedTaskSearch = deferredTaskSearch.trim();
  const filteredOrderFilterOptions = orderFilterOptions.filter((option) =>
    normalizedOrderFilterSearch
      ? option.searchText.includes(normalizedOrderFilterSearch)
      : true,
  );
  const selectedOrderFilterOption =
    orderFilter === "ALL"
      ? null
      : orderFilterOptions.find((option) => option.key === orderFilter) ?? null;
  const taskSortParams = getTaskSortParams(sortOption);
  const hasActiveTaskFilters =
    taskSearch.trim().length > 0 ||
    orderFilter !== "ALL" ||
    stageFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    sortOption !== "DUE_ASC";

  const { data, isLoading, refetch } = useQuery<TasksResponse>({
    queryKey: [
      "tasks",
      page,
      stageFilter,
      statusFilter,
      orderFilter,
      priorityFilter,
      normalizedTaskSearch,
      sortOption,
    ],
    queryFn: () =>
      api
        .get("/production-orders/tasks", {
          params: {
            page,
            limit: LIMIT,
            ...(normalizedTaskSearch ? { search: normalizedTaskSearch } : {}),
            ...(stageFilter !== "ALL" ? { stage: stageFilter } : {}),
            ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
            ...(priorityFilter !== "ALL" ? { priority: priorityFilter } : {}),
            ...(selectedOrderFilterOption?.filterType === "PRODUCTION_ORDER"
              ? { productOrderId: selectedOrderFilterOption.filterValue }
              : {}),
            ...(selectedOrderFilterOption?.filterType === "SALES_ORDER"
              ? { salesOrderId: selectedOrderFilterOption.filterValue }
              : {}),
            sortBy: taskSortParams.sortBy,
            sortDirection: taskSortParams.sortDirection,
          },
        })
        .then((r) => r.data),
  });

  const { data: allUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users?limit=200").then((r) => r.data),
    enabled: canAssignEmployee,
    staleTime: 5 * 60 * 1000,
  });

  const tasks = data?.tasks ?? [];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Production Tasks
          </h1>
          <p className="text-sm text-zinc-500">
            {total > 0
              ? `${total} task${total !== 1 ? "s" : ""}`
              : "All production operation tasks"}
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-zinc-500">
          <Filter className="h-3.5 w-3.5" />
        </div>

        <div className="relative w-[260px] max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={taskSearch}
            onChange={(event) => {
              setTaskSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search product, SKU or assignee..."
            className="pl-8"
          />
        </div>

        <Select
          value={orderFilter}
          onValueChange={(value) => {
            if (value !== null) {
              setOrderFilter(value);
              setOrderFilterSearch("");
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[320px] max-w-full">
            <SelectValue placeholder="All Orders">
              {selectedOrderFilterOption?.label ?? "All Orders"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            showSearch
            searchValue={orderFilterSearch}
            onSearchChange={setOrderFilterSearch}
            searchPlaceholder="Search converted sales orders or production orders..."
          >
            <SelectItem value="ALL">All Orders</SelectItem>
            {isTaskFilterOptionsLoading ? (
              <div className="px-3 py-2 text-sm text-zinc-400">
                Loading order options...
              </div>
            ) : filteredOrderFilterOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-400">
                No matching orders found
              </div>
            ) : (
              filteredOrderFilterOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(value) => {
            if (value !== null) {
              setPriorityFilter(value);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Priorities">
              {priorityFilter === "ALL"
                ? "All Priorities"
                : TASK_PRIORITY_OPTIONS.find(
                    (option) => option.value === priorityFilter
                  )?.label || "All Priorities"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            {TASK_PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stageFilter}
          onValueChange={(v) => {
            if (v !== null) {
              setStageFilter(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Stages">
              {stageFilter === "ALL"
                ? "All Stages"
                : STAGE_LABELS[stageFilter] || "All Stages"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            if (v !== null) {
              setStatusFilter(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses">
              {statusFilter === "ALL"
                ? "All Statuses"
                : STAGE_STATUS_OPTIONS.find(
                    (opt) => opt.value === statusFilter
                  )?.label || "All Statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STAGE_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortOption}
          onValueChange={(value) => {
            if (value !== null) {
              setSortOption(value as TaskSortOption);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Sort tasks">
              <span className="inline-flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
                {
                  TASK_SORT_OPTIONS.find((option) => option.value === sortOption)
                    ?.label
                }
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TASK_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveTaskFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500"
            onClick={() => {
              setTaskSearch("");
              setOrderFilter("ALL");
              setOrderFilterSearch("");
              setStageFilter("ALL");
              setStatusFilter("ALL");
              setPriorityFilter("ALL");
              setSortOption("DUE_ASC");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Production Order
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Sales Order
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Est. Time / Due
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-500">
                    Priority
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : tasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-zinc-400"
                    >
                      {hasActiveTaskFilters
                        ? "No tasks match the current filters"
                        : "No tasks found"}
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-zinc-50/80 transition-colors"
                    >
                      {/* Stage */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StageIcon status={task.stageStatus} />
                          <div>
                            <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                              {STAGE_LABELS[task.operationStage] ??
                                task.operationStage}
                              {task.hasNewCutouts && (
                                <span
                                  className="inline-block h-2 w-2 rounded-full bg-red-500"
                                  title="New cutouts available"
                                />
                              )}
                            </div>
                            {task.operationName && (
                              <div className="text-xs text-zinc-400">
                                {task.operationName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Production Order */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/production-orders/${task.productOrder.id}`}
                          className="group"
                        >
                          <div className="font-medium text-zinc-800 group-hover:text-teal-600 transition-colors">
                            {task.productOrder.productName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-zinc-400 font-mono">
                              {task.productOrder.sku}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${orderStatusColors[task.productOrder.status ?? "PENDING"]}`}
                            >
                              {task.productOrder.status ?? "PENDING"}
                            </span>
                          </div>
                          {task.productOrder.referenceId && (
                            <div className="mt-1 text-[10px] text-zinc-400 font-mono break-all">
                              {task.productOrder.referenceId}
                            </div>
                          )}
                        </Link>
                      </td>

                      {/* Sales Order */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="text-xs text-zinc-600">
                            {task.productOrder.salesOrderNumber ??
                              task.productOrder.zohoBooksId ??
                              "Direct Production"}
                          </span>
                          {task.productOrder.salesOrderCustomerName && (
                            <div className="text-[10px] text-zinc-400">
                              {task.productOrder.salesOrderCustomerName}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3">
                        {task.assignedStaff ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                              <User className="h-3 w-3 text-teal-500" />
                            </div>
                            <div>
                              <div className="text-zinc-800 text-xs font-medium">
                                {task.assignedStaff.firstName}{" "}
                                {task.assignedStaff.lastName}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono">
                                {task.assignedStaff.staffId}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${stageStatusColors[task.stageStatus ?? "PENDING"]}`}
                        >
                          {STAGE_STATUS_LABELS[task.stageStatus ?? "PENDING"] ??
                            task.stageStatus ??
                            "Pending"}
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="px-4 py-3">
                        <ProgressBar
                          value={task.quantityFinished}
                          total={getTaskQuantityTotal(task)}
                        />
                        {(task.operationStage === "PAPER_SELECTION" ||
                          task.operationStage === "CUTTING") && (
                          <div className="mt-0.5 text-[10px] text-zinc-400">
                            {task.cutSize ? `${task.cutSize} cut` : "Cut setup"}
                            {task.paperSize ? ` · ${task.paperSize}` : ""}
                          </div>
                        )}
                        {task.quantityWasted !== null &&
                          task.quantityWasted > 0 && (
                            <div className="text-[10px] text-red-400 mt-0.5">
                              {task.quantityWasted} wasted
                            </div>
                          )}
                      </td>

                      {/* Expected */}
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {task.expectedTimeline ? (
                          fmtDate(task.expectedTimeline)
                        ) : task.estimatedTimeMin ? (
                          <span>
                            {+(task.estimatedTimeMin / 60).toFixed(1)}{" "}
                            {task.estimatedTimeMin / 60 === 1 ? "hr" : "hrs"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColors[task.productOrder.priority]}`}
                        >
                          {task.productOrder.priority}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {task.operationStage === "FINISHING" ? (
                          <Link
                            href={`/production-orders/${task.productOrder.id}/finishing`}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs"
                            >
                              <Pencil className="h-3 w-3" />
                              Update
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => setEditingTask(task)}
                          >
                            <Pencil className="h-3 w-3" />
                            Update
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Page {page} of {totalPages} · {total} total tasks
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Update Dialog */}
      <UpdateTaskDialog
        key={editingTask?.id ?? "none"}
        task={editingTask}
        open={editingTask !== null}
        onClose={() => setEditingTask(null)}
        allUsers={allUsers}
        canAssignEmployee={canAssignEmployee}
        onSaved={refetch}
      />
    </div>
  );
}
