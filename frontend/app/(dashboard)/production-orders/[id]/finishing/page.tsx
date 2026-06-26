"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress-bar";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductOrderOperation {
  id: string;
  operationStage: string;
  operationName: string | null;
  itemFinished: string | null;
  finishingLocation: string | null;
  twistedHandles: number | null;
  costPerFinish: string | null;
  quantityFinished: number | null;
  wastageFromPrinting: number | null;
  wastageFromDiecutting: number | null;
  wastageFromLaminating: number | null;
  wastageFromHandling: number | null;
  totalWastage: number | null;
  quantityWasted: number | null;
  stageStatus: string | null;
  expectedTimeline: string | null;
  assignedStaffId: string | null;
  cutQuantity?: number | null;
}

interface ProductOrder {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  productOrderOperations: ProductOrderOperation[];
}

interface ProductionRules {
  finishing: { itemFinished: string; costPerFinish: string | number }[];
}

interface FactoryLocation {
  id: string;
  name: string;
  state: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  staffId: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return String(value);
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const stageStatusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PARTIALLY_COMPLETE", label: "Partially Complete" },
  { value: "COMPLETE", label: "Complete" },
  { value: "NA", label: "N/A" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinishingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: order, isLoading: orderLoading } = useQuery<ProductOrder>({
    queryKey: ["production-orders", id],
    queryFn: () => api.get(`/production-orders/${id}`).then((r) => r.data),
  });

  const { data: productionRules } = useQuery<ProductionRules>({
    queryKey: ["production-order-rules"],
    queryFn: () => api.get("/production-orders/rules").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: factoryLocations = [] } = useQuery<FactoryLocation[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users?limit=200").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // ── Form state ──
  const [fields, setFields] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");

  // ── Derived ──
  const finishingItemOptions =
    productionRules?.finishing.map((item) => ({
      value: item.itemFinished,
      label: `${item.itemFinished} (${fmt(item.costPerFinish)})`,
    })) ?? [];

  const finishingOps =
    order?.productOrderOperations.filter(
      (o) => o.operationStage === "FINISHING",
    ) ?? [];

  // Available quantity = total cuts from CUTTING operations (or order quantity if no cuts)
  const cuttingOps =
    order?.productOrderOperations.filter(
      (o) => o.operationStage === "CUTTING",
    ) ?? [];
  const totalCuts = cuttingOps.reduce(
    (sum, op) => sum + (op.cutQuantity ?? 0),
    0,
  );
  const availableQuantity =
    totalCuts > 0 ? totalCuts : (order?.quantity ?? 0);

  // Wastage auto-sum
  const totalWastage =
    Number(fields["wastageFromPrinting"] ?? 0) +
    Number(fields["wastageFromDiecutting"] ?? 0) +
    Number(fields["wastageFromLaminating"] ?? 0) +
    Number(fields["wastageFromHandling"] ?? 0);

  const filteredStaff = allUsers.filter((u) => {
    const q = staffSearch.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.staffId.toLowerCase().includes(q)
    );
  });

  // ── Mutations ──
  const opMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/production-orders/${id}/operations`, body).then((r) => r.data),
  });

  async function handleSave() {
    if (!fields["itemFinished"] && !fields["quantityFinished"]) {
      toast.error("Fill in the finishing details");
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        operationStage: "FINISHING",
        operationName: "Finishing",
        ...(editingId ? { id: editingId } : {}),
        itemFinished: fields["itemFinished"] || undefined,
        finishingLocation: fields["finishingLocation"] || undefined,
        costPerFinish: fields["costPerFinish"] || undefined,
        quantityFinished: fields["quantityFinished"]
          ? Number(fields["quantityFinished"])
          : undefined,
        twistedHandles: fields["twistedHandles"]
          ? Number(fields["twistedHandles"])
          : undefined,
        wastageFromPrinting: fields["wastageFromPrinting"]
          ? Number(fields["wastageFromPrinting"])
          : undefined,
        wastageFromDiecutting: fields["wastageFromDiecutting"]
          ? Number(fields["wastageFromDiecutting"])
          : undefined,
        wastageFromLaminating: fields["wastageFromLaminating"]
          ? Number(fields["wastageFromLaminating"])
          : undefined,
        wastageFromHandling: fields["wastageFromHandling"]
          ? Number(fields["wastageFromHandling"])
          : undefined,
        totalWastage,
        stageStatus: fields["stageStatus"] || "PENDING",
        expectedTimeline: fields["expectedTimeline"] || undefined,
        assignedStaffId: fields["assignedStaffId"] || undefined,
      };

      await opMutation.mutateAsync(payload);

      await qc.invalidateQueries({ queryKey: ["production-orders", id] });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Finishing operation saved");
      router.push(`/production-orders/${id}`);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg ?? "Failed to save");
    }
  }

  // ── Edit existing ──
  function editExisting(op: ProductOrderOperation) {
    setEditingId(op.id);
    setFields({
      id: op.id,
      itemFinished: op.itemFinished ?? "",
      finishingLocation: op.finishingLocation ?? "",
      costPerFinish: op.costPerFinish ?? "",
      quantityFinished:
        op.quantityFinished != null ? String(op.quantityFinished) : "",
      twistedHandles:
        op.twistedHandles != null ? String(op.twistedHandles) : "",
      wastageFromPrinting:
        op.wastageFromPrinting != null
          ? String(op.wastageFromPrinting)
          : "",
      wastageFromDiecutting:
        op.wastageFromDiecutting != null
          ? String(op.wastageFromDiecutting)
          : "",
      wastageFromLaminating:
        op.wastageFromLaminating != null
          ? String(op.wastageFromLaminating)
          : "",
      wastageFromHandling:
        op.wastageFromHandling != null
          ? String(op.wastageFromHandling)
          : "",
      stageStatus: op.stageStatus ?? "PENDING",
      expectedTimeline: op.expectedTimeline
        ? op.expectedTimeline.slice(0, 10)
        : "",
      assignedStaffId: op.assignedStaffId ?? "",
    });
  }

  function newEntry() {
    setEditingId(null);
    setFields({});
    setStaffSearch("");
  }

  // ── Auto-prefill if only one existing ──
  const existingOp = finishingOps.length === 1 ? finishingOps[0] : null;
  const hasPrefilled = editingId !== null || Object.keys(fields).length > 0;
  if (existingOp && !hasPrefilled && !orderLoading) {
    editExisting(existingOp);
  }

  const isSaving = opMutation.isPending;
  const finishedNum = fields["quantityFinished"]
    ? Number(fields["quantityFinished"])
    : null;

  const selectedStaff = allUsers.find(
    (u) => u.id === fields["assignedStaffId"],
  );

  if (orderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/production-orders/${id}`}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Order
        </Link>
        {order && (
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-900">
              {order.productName}
            </p>
            <p className="font-mono text-xs text-zinc-400">{order.sku}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
          <Package className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Finishing</h1>
          <p className="text-sm text-zinc-500">
            Record finishing details, wastage breakdown, and quantity completed.
            Available from cutting: {availableQuantity} units.
          </p>
        </div>
      </div>

      {/* Existing Entries */}
      {finishingOps.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Existing Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {finishingOps.map((op) => (
              <div
                key={op.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {op.itemFinished ?? "Finishing"}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        op.stageStatus === "COMPLETE"
                          ? "bg-green-100 text-green-700"
                          : op.stageStatus === "PARTIALLY_COMPLETE"
                            ? "bg-amber-100 text-amber-700"
                          : op.stageStatus === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {stageStatusOptions.find(
                        (option) => option.value === op.stageStatus,
                      )?.label ?? op.stageStatus ?? "Pending"}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-500">
                    {op.quantityFinished != null && (
                      <span>
                        {op.quantityFinished}/{availableQuantity} finished
                      </span>
                    )}
                    {op.costPerFinish && <span>{fmt(op.costPerFinish)}/pc</span>}
                    {op.totalWastage != null && op.totalWastage > 0 && (
                      <span>{op.totalWastage} wasted</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => editExisting(op)}
                >
                  Edit
                </Button>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={newEntry}
                className="gap-1.5 text-green-600"
              >
                <CheckCircle2 className="h-4 w-4" />
                New Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column - Finishing Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Finishing Details
              {editingId && (
                <Badge variant="outline" className="text-xs font-normal">
                  Editing
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Factory Location */}
            <div className="space-y-1.5">
              <Label>Factory Location</Label>
              <Select
                value={fields["finishingLocation"] ?? ""}
                onValueChange={(v) =>
                  setFields((p) => ({ ...p, finishingLocation: v ?? "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select factory location" />
                </SelectTrigger>
                <SelectContent>
                  {factoryLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.state})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name of Product Finished */}
            <div className="space-y-1.5">
              <Label>
                Name of Product Finished <span className="text-red-500">*</span>
              </Label>
              <Select
                value={fields["itemFinished"] ?? ""}
                onValueChange={(v) => {
                  const rule = productionRules?.finishing.find(
                    (f) => f.itemFinished === v,
                  );
                  setFields((p) => ({
                    ...p,
                    itemFinished: v ?? "",
                    ...(rule
                      ? { costPerFinish: String(rule.costPerFinish) }
                      : {}),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select finished item" />
                </SelectTrigger>
                <SelectContent>
                  {finishingItemOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost Per Finish */}
            <div className="space-y-1.5">
              <Label>Cost per Finish (₦)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={fields["costPerFinish"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({ ...p, costPerFinish: e.target.value }))
                }
              />
            </div>

            {/* Quantity Finished */}
            <div className="space-y-1.5">
              <Label>
                Quantity of Finished Products{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={availableQuantity}
                placeholder={`0 – ${availableQuantity}`}
                value={fields["quantityFinished"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    quantityFinished: e.target.value,
                  }))
                }
              />
              {finishedNum !== null && finishedNum > availableQuantity && (
                <p className="text-xs text-red-500">
                  Exceeds available quantity ({availableQuantity})
                </p>
              )}
            </div>

            {/* Progress */}
            {finishedNum !== null && (
              <div className="space-y-1">
                <span className="text-xs text-zinc-400">Progress</span>
                <ProgressBar value={finishedNum} total={availableQuantity} />
              </div>
            )}

            {/* Twisted Handles */}
            <div className="space-y-1.5">
              <Label>Twisted Handles (per unit)</Label>
              <Input
                type="number"
                min={0}
                placeholder="65"
                value={fields["twistedHandles"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({ ...p, twistedHandles: e.target.value }))
                }
              />
            </div>

            {/* Assigned Staff */}
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select
                value={fields["assignedStaffId"] ?? ""}
                onValueChange={(v) => {
                  if (v !== null) {
                    setFields((p) => ({ ...p, assignedStaffId: v }));
                    setStaffSearch("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee">
                    {fields["assignedStaffId"] && selectedStaff ? (
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
                    filteredStaff.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.staffId})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={fields["stageStatus"] ?? "PENDING"}
                onValueChange={(v) =>
                  v && setFields((p) => ({ ...p, stageStatus: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Timeline */}
            <div className="space-y-1.5">
              <Label>Expected Timeline</Label>
              <Input
                type="date"
                value={fields["expectedTimeline"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    expectedTimeline: e.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Wastage Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wastage Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Wastage from Printing</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={fields["wastageFromPrinting"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    wastageFromPrinting: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Wastage from Die Cutting</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={fields["wastageFromDiecutting"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    wastageFromDiecutting: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Wastage from Laminating</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={fields["wastageFromLaminating"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    wastageFromLaminating: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Wastage from Handling / Stains</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={fields["wastageFromHandling"] ?? ""}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    wastageFromHandling: e.target.value,
                  }))
                }
              />
            </div>

            {/* Total Wastage - read only */}
            <div className="space-y-1.5">
              <Label>Total Wastage</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {totalWastage > 0 ? (
                  <span className="text-red-600 font-medium">
                    {totalWastage}
                  </span>
                ) : (
                  <span className="text-zinc-400">0</span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Auto-sum of all wastage categories
              </p>
            </div>

            {/* Summary */}
            {finishedNum !== null && (
              <div className="rounded-lg border border-dashed border-green-200 bg-green-50/70 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Available from Cutting</span>
                  <span className="font-medium">{availableQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Finished</span>
                  <span className="font-medium text-green-700">
                    {finishedNum}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Total Wasted</span>
                  <span className="font-medium text-red-600">
                    {totalWastage}
                  </span>
                </div>
                <div className="flex justify-between border-t border-green-200 pt-1 mt-1">
                  <span className="text-zinc-600">Remaining</span>
                  <span className="font-medium">
                    {availableQuantity - finishedNum - totalWastage}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push(`/production-orders/${id}`)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          className="bg-green-600 text-white hover:bg-green-700"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Finishing"
          )}
        </Button>
      </div>
    </div>
  );
}
