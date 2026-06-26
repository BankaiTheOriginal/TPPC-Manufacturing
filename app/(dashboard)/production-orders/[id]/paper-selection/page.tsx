"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Loader2,
  Info,
  Trash2,
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
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductionOption {
  value: string;
  label: string;
}
interface ProductionPaperItem {
  itemId: string | null;
  sku: string | null;
  itemName: string;
  category: string | null;
  quantityInStock: number | null;
  paperType: string;
  sourceSheetSize: string;
  sourceSheetSizeLabel: string;
  costPerPacket: number | null;
  sheetsPerPacket: number | null;
  costPerSheet: number | null;
}
interface ProductionRules {
  paperItems?: ProductionPaperItem[];
  paperTypes?: ProductionPaperItem[];
  sourceSheetSizes: ProductionOption[];
  cutSizes: ProductionOption[];
  ctp: { machine: string; costPerColor: number }[];
  print: { machine: string; costPerColor: number }[];
  lamination: {
    size: string;
    sizeLabel: string;
    glossCost: number;
    matteCost: number;
  }[];
  finishing: { itemFinished: string; costPerFinish: string | number }[];
}
interface CuttingPreview {
  sourceSheetSize: string;
  cutSize: string;
  rawCutOuts: number;
  maxCutOutsPerSheet: number;
  cutOuts: number;
  bagSheets: number;
  costPerCut: number | null;
  costPerDiecut: number | null;
  costOfPaperUsed: number | null;
  requestedCuts?: number | null;
  sheetFractionUsed?: number | null;
  remainingCutCapacity?: number | null;
  exceedsMaxCutOuts?: boolean;
  exceedsRemainingPaper?: boolean;
  usedSheetsOnOrder?: number | null;
  remainingSheetsOnOrder?: number | null;
  remainingCutsForThisSizeOnOrder?: number | null;
  sourcePaperQuantityPlanned?: number | null;
  selectedSourceSheets?: number | null;
  totalCutoutsFromSelectedSheets?: number | null;
}
interface ProductOrderOperation {
  id: string;
  operationStage: string;
  paperSelectionOpId?: string | null;
  inventoryId?: string | null;
  paperSize: string | null;
  costPerSheet: string | null;
  sheetsPerPacket: number | null;
  costPerPacket: string | null;
  warehouseLocationId?: string | null;
  quantityOfSheetsTaken?: number | null;
  cutoutsPerSheet?: number | null;
  costPerCut?: string | null;
  costPerCutSheet?: string | null;
  cutSize?: string | null;
  stageStatus?: string | null;
  expectedTimeline?: string | null;
  targetOperationStage?: string | null;
  // Cutting fields
  cutQuantity?: number | null;
  cuttingPreview?: CuttingPreview | null;
}
interface ProductOrder {
  id: string;
  productName: string;
  sku: string;
  productOrderOperations: ProductOrderOperation[];
  materials: {
    id: string;
    inventoryId: string;
    quantity: string;
    inventory?: { itemName: string };
  }[];
}
interface FactoryLocation {
  id: string;
  name: string;
  state: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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

export default function PaperSelectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  // ── Saved paper selections list ──
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

  // ── Form state ──
  const [paperFields, setPaperFields] = useState<Record<string, string>>({});
  const [cutFields, setCutFields] = useState<Record<string, string>>({});
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [editingCutId, setEditingCutId] = useState<string | null>(null);

  // Derived values
  const paperItems =
    productionRules?.paperItems ?? productionRules?.paperTypes ?? [];
  const cutSizeOptions = productionRules?.cutSizes ?? [];

  const getPaperItemKey = (p: ProductionPaperItem) =>
    String(p.itemId ?? p.sku ?? p.paperType);

  const selectedPaperKey = paperFields["paperItemKey"] ?? "";
  const selectedPaperItem =
    paperItems.find((p) => getPaperItemKey(p) === selectedPaperKey) ?? null;

  function handlePaperSelect(key: string) {
    const paper = paperItems.find((p) => getPaperItemKey(p) === key);
    if (!paper) return;
    setPaperFields((prev) => ({
      ...prev,
      paperItemKey: key,
      inventoryId: paper.itemId ?? "",
      paperType: paper.paperType,
      paperSize: paper.sourceSheetSize,
      costPerSheet:
        paper.costPerSheet != null ? String(paper.costPerSheet) : "",
      sheetsPerPacket:
        paper.sheetsPerPacket != null ? String(paper.sheetsPerPacket) : "",
      costPerPacket:
        paper.costPerPacket != null ? String(paper.costPerPacket) : "",
      quantityInStock:
        paper.quantityInStock != null ? String(paper.quantityInStock) : "",
    }));
  }

  // ── Cutting preview ──
  const paperSize = paperFields["paperSize"] ?? "";
  const cutSize = cutFields["cutSize"] ?? "";
  const costPerSheet = paperFields["costPerSheet"] ?? "";
  const requestedCuts = cutFields["cutQuantity"] ?? "";
  const quantityOfSheetsTaken = paperFields["quantityOfSheetsTaken"] ?? "";

  const {
    data: cuttingPreview,
    error: cuttingPreviewError,
    isFetching: cuttingLoading,
  } = useQuery<CuttingPreview>({
    queryKey: [
      "cutting-preview",
      paperSize,
      cutSize,
      costPerSheet,
      requestedCuts,
      quantityOfSheetsTaken,
      id,
      editingPaperId,
    ],
    queryFn: () =>
      api
        .get("/production-orders/cutting-preview", {
          params: {
            paperSize,
            cutSize,
            productOrderId: id,
            ...(paperFields["inventoryId"]
              ? { inventoryId: paperFields["inventoryId"] }
              : {}),
            ...(requestedCuts ? { requestedCuts } : {}),
            ...(quantityOfSheetsTaken ? { quantityOfSheetsTaken } : {}),
            ...(editingPaperId ? { operationId: editingPaperId } : {}),
            ...(costPerSheet ? { costPerSheet } : {}),
          },
        })
        .then((r) => r.data),
    enabled: paperSize.length > 0 && cutSize.length > 0,
    retry: false,
  });

  // Compute costPerCutSheet
  const costPerCutSheet =
    cuttingPreview?.costPerCut != null && cuttingPreview.maxCutOutsPerSheet > 0
      ? cuttingPreview.costPerCut
      : null;

  // When maxCutOutsPerSheet resolves (cut size selected after sheets entered), recalculate
  useEffect(() => {
    const sheets = Number(paperFields["quantityOfSheetsTaken"] ?? "");
    const cutouts = cuttingPreview?.maxCutOutsPerSheet;
    if (cutouts != null && sheets > 0 && !cutFields["cutQuantity"]) {
      setCutFields((p) => ({ ...p, cutQuantity: String(sheets * cutouts) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuttingPreview?.maxCutOutsPerSheet]);

  // ── Save mutations ──
  const opMutation = useMutation<
    ProductOrderOperation,
    unknown,
    Record<string, unknown>
  >({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/production-orders/${id}/operations`, body).then((r) => r.data),
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (operationId: string) =>
      api
        .delete(`/production-orders/${id}/operations/${operationId}`)
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Entry deleted");
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
    },
    onError: (err: unknown) => {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "message" in err.response.data
          ? String((err.response.data as { message: unknown }).message)
          : "Failed to delete entry";
      toast.error(msg);
    },
  });

  async function handleSave() {
    if (!paperFields["inventoryId"] && !paperFields["paperSize"]) {
      toast.error("Select a paper item first");
      return;
    }

    try {
      // Build paper selection payload
      const paperPayload: Record<string, unknown> = {
        operationStage: "PAPER_SELECTION",
        operationName: "Paper Selection",
        ...(editingPaperId ? { id: editingPaperId } : {}),
        inventoryId: paperFields["inventoryId"] || undefined,
        paperSize: paperFields["paperSize"] || undefined,
        costPerSheet: paperFields["costPerSheet"] || undefined,
        sheetsPerPacket: paperFields["sheetsPerPacket"]
          ? Number(paperFields["sheetsPerPacket"])
          : undefined,
        costPerPacket: paperFields["costPerPacket"] || undefined,
        warehouseLocationId: paperFields["warehouseLocationId"] || undefined,
        quantityOfSheetsTaken: paperFields["quantityOfSheetsTaken"]
          ? Number(paperFields["quantityOfSheetsTaken"])
          : undefined,
        expectedTimeline: paperFields["expectedTimeline"] || undefined,
        stageStatus: paperFields["stageStatus"] || "PENDING",
      };

      const savedPaper = await opMutation.mutateAsync(paperPayload);

      // Also save cutting operation if cut fields are filled
      if (cutFields["cutSize"] && cutFields["cutQuantity"]) {
        const cuttingPayload: Record<string, unknown> = {
          operationStage: "CUTTING",
          operationName: "Cutting",
          ...(editingCutId ? { id: editingCutId } : {}),
          paperSelectionOpId: savedPaper.id,
          inventoryId: paperFields["inventoryId"] || undefined,
          paperSize: paperFields["paperSize"] || undefined,
          costPerSheet: paperFields["costPerSheet"] || undefined,
          cutSize: cutFields["cutSize"],
          cutQuantity: Number(cutFields["cutQuantity"]),
          cutoutsPerSheet:
            cuttingPreview?.maxCutOutsPerSheet ??
            (cutFields["cutoutsPerSheet"]
              ? Number(cutFields["cutoutsPerSheet"])
              : undefined),
          costPerCut:
            cuttingPreview?.costPerCut != null
              ? String(cuttingPreview.costPerCut)
              : cutFields["costPerCut"] || undefined,
          costPerCutSheet:
            costPerCutSheet != null ? String(costPerCutSheet) : undefined,
          targetOperationStage: cutFields["targetOperationStage"] || undefined,
          stageStatus: cutFields["stageStatus"] || "PENDING",
          expectedTimeline: cutFields["expectedTimeline"] || undefined,
        };
        await opMutation.mutateAsync(cuttingPayload);
      }

      await qc.invalidateQueries({ queryKey: ["production-orders", id] });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      await qc.invalidateQueries({ queryKey: ["task-filter-options"] });
      toast.success("Paper selection and cutting saved");
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

  // ── Prefill when editing an existing paper op ──
  function editExistingPaper(op: ProductOrderOperation) {
    setEditingPaperId(op.id);
    const paper = paperItems.find(
      (p) => p.itemId === op.inventoryId || p.sourceSheetSize === op.paperSize,
    );
    setPaperFields({
      id: op.id,
      inventoryId: op.inventoryId ?? "",
      paperItemKey: paper ? getPaperItemKey(paper) : "",
      paperSize: op.paperSize ?? "",
      costPerSheet: op.costPerSheet ?? "",
      sheetsPerPacket:
        op.sheetsPerPacket != null ? String(op.sheetsPerPacket) : "",
      costPerPacket: op.costPerPacket ?? "",
      warehouseLocationId: op.warehouseLocationId ?? "",
      quantityOfSheetsTaken:
        op.quantityOfSheetsTaken != null
          ? String(op.quantityOfSheetsTaken)
          : "",
      stageStatus: op.stageStatus ?? "PENDING",
      expectedTimeline: op.expectedTimeline
        ? op.expectedTimeline.slice(0, 10)
        : "",
    });

    // Also prefill cutting fields from the linked cutting operation
    const matchedCut = matchedCuttingByPaperId.get(op.id);
    setEditingCutId(matchedCut?.id ?? null);
    if (matchedCut) {
      setCutFields({
        id: matchedCut.id,
        paperSelectionOpId: matchedCut.paperSelectionOpId ?? op.id,
        inventoryId: matchedCut.inventoryId ?? op.inventoryId ?? "",
        paperSize: matchedCut.paperSize ?? op.paperSize ?? "",
        costPerSheet:
          matchedCut.costPerSheet != null
            ? String(matchedCut.costPerSheet)
            : op.costPerSheet != null
              ? String(op.costPerSheet)
              : "",
        cutSize: matchedCut.cutSize ?? "",
        cutQuantity:
          matchedCut.cutQuantity != null ? String(matchedCut.cutQuantity) : "",
        cutoutsPerSheet:
          matchedCut.cutoutsPerSheet != null
            ? String(matchedCut.cutoutsPerSheet)
            : "",
        costPerCut:
          matchedCut.costPerCut != null ? String(matchedCut.costPerCut) : "",
        costPerCutSheet:
          matchedCut.costPerCutSheet != null
            ? String(matchedCut.costPerCutSheet)
            : "",
        targetOperationStage: matchedCut.targetOperationStage ?? "",
        stageStatus: matchedCut.stageStatus ?? "PENDING",
        expectedTimeline: matchedCut.expectedTimeline
          ? matchedCut.expectedTimeline.slice(0, 10)
          : "",
      });
    } else {
      setEditingCutId(null);
      setCutFields({});
    }
  }

  function newPaperEntry() {
    setEditingPaperId(null);
    setEditingCutId(null);
    setPaperFields({});
    setCutFields({});
  }

  function normalizePaperSize(value?: string | null) {
    return value ? value.replace(/\s+/g, "").toUpperCase() : "";
  }

  function cuttingMatchesPaperSelection(
    cuttingOperation: ProductOrderOperation,
    paperSelection: ProductOrderOperation,
  ) {
    if (cuttingOperation.paperSelectionOpId) {
      return cuttingOperation.paperSelectionOpId === paperSelection.id;
    }

    if (
      cuttingOperation.inventoryId &&
      paperSelection.inventoryId &&
      cuttingOperation.inventoryId === paperSelection.inventoryId
    ) {
      return true;
    }

    const cuttingPaperSize = normalizePaperSize(cuttingOperation.paperSize);
    const selectionPaperSize = normalizePaperSize(paperSelection.paperSize);

    return (
      cuttingPaperSize.length > 0 &&
      cuttingPaperSize === selectionPaperSize
    );
  }

  // ── Existing ops ──
  const paperOps =
    order?.productOrderOperations.filter(
      (o) => o.operationStage === "PAPER_SELECTION",
    ) ?? [];
  const cuttingOps =
    order?.productOrderOperations.filter(
      (o) => o.operationStage === "CUTTING",
    ) ?? [];

  const matchedCuttingByPaperId = new Map<string, ProductOrderOperation>();
  const availableCuttingOps = [...cuttingOps];

  for (const paperOp of paperOps) {
    const exactIndex = availableCuttingOps.findIndex(
      (cuttingOp) => cuttingOp.paperSelectionOpId === paperOp.id,
    );

    if (exactIndex >= 0) {
      const [matchedCut] = availableCuttingOps.splice(exactIndex, 1);
      matchedCuttingByPaperId.set(paperOp.id, matchedCut);
      continue;
    }

    const fallbackIndex = availableCuttingOps.findIndex(
      (cuttingOp) =>
        !cuttingOp.paperSelectionOpId &&
        cuttingMatchesPaperSelection(cuttingOp, paperOp),
    );

    if (fallbackIndex >= 0) {
      const [matchedCut] = availableCuttingOps.splice(fallbackIndex, 1);
      matchedCuttingByPaperId.set(paperOp.id, matchedCut);
    }
  }

  const isSaving = opMutation.isPending;

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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <Scissors className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Paper Selection & Cutting
          </h1>
          <p className="text-sm text-zinc-500">
            Select paper stock and define cut sizes. Other stages unlock once
            this is complete.
          </p>
        </div>
      </div>

      {/* Existing Selections */}
      {(paperOps.length > 0 || cuttingOps.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Existing Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paperOps.map((op) => {
              const meta = paperItems.find((p) => p.itemId === op.inventoryId);
              const name = meta?.itemName ?? op.paperSize ?? "Paper";
              const matchedCut = matchedCuttingByPaperId.get(op.id);
              return (
                <div
                  key={op.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      {op.paperSize && (
                        <span className="text-xs text-zinc-400">
                          ({op.paperSize})
                        </span>
                      )}
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
                      {op.costPerSheet && (
                        <span>{fmt(Number(op.costPerSheet))}/sheet</span>
                      )}
                      {op.sheetsPerPacket && (
                        <span>{op.sheetsPerPacket} sheets/pkt</span>
                      )}
                      {matchedCut?.cutSize && (
                        <span>Cut: {matchedCut.cutSize}</span>
                      )}
                      {matchedCut?.cutQuantity && (
                        <span>{matchedCut.cutQuantity} cuts</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editExistingPaper(op)}
                    >
                      Edit
                    </Button>
                    {(op.stageStatus === "PENDING" || !op.stageStatus) &&
                      (confirmDeleteId === op.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(op.id)}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Confirm"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-zinc-400 hover:text-red-500"
                          onClick={() => setConfirmDeleteId(op.id)}
                          title="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={newPaperEntry}
                className="gap-1.5 text-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add Another Paper
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Paper Selection Form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Paper Selection
              {editingPaperId && (
                <Badge variant="outline" className="text-xs font-normal">
                  Editing
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paper Item */}
            <div className="space-y-1.5">
              <Label>
                Paper Type / Item <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedPaperKey}
                onValueChange={(v) => v && handlePaperSelect(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select paper item">
                    {selectedPaperKey ? (
                      (() => {
                        const p = paperItems.find(
                          (x) => getPaperItemKey(x) === selectedPaperKey,
                        );
                        return p
                          ? `${p.itemName}${p.sku ? ` (${p.sku})` : ""} · ${p.sourceSheetSizeLabel}`
                          : selectedPaperKey;
                      })()
                    ) : (
                      <span className="text-zinc-400">Select paper item</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {paperItems.map((paper) => (
                    <SelectItem
                      key={getPaperItemKey(paper)}
                      value={getPaperItemKey(paper)}
                    >
                      {paper.itemName}
                      {paper.sku ? ` (${paper.sku})` : ""}
                      {" · "}
                      {paper.sourceSheetSizeLabel}
                      {paper.costPerSheet != null
                        ? ` · ${fmt(paper.costPerSheet)}/sheet`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse Location */}
            <div className="space-y-1.5">
              <Label>Warehouse Location</Label>
              <Select
                value={paperFields["warehouseLocationId"] ?? ""}
                onValueChange={(v) =>
                  setPaperFields((p) => ({
                    ...p,
                    warehouseLocationId: v ?? "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse location">
                    {(() => {
                      const loc = factoryLocations.find(
                        (l) => l.id === (paperFields["warehouseLocationId"] ?? ""),
                      );
                      return loc ? (
                        `${loc.name} (${loc.state})`
                      ) : (
                        <span className="text-zinc-400">
                          Select warehouse location
                        </span>
                      );
                    })()}
                  </SelectValue>
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

            {/* Source Sheet Size — read-only */}
            <div className="space-y-1.5">
              <Label>Source Sheet Size</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {selectedPaperItem?.sourceSheetSizeLabel ??
                  paperFields["paperSize"] ?? (
                    <span className="text-zinc-400">
                      Auto-filled from paper item
                    </span>
                  )}
              </div>
            </div>

            {/* Quantity In Stock — read-only */}
            <div className="space-y-1.5">
              <Label>Quantity In Stock</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {selectedPaperItem?.quantityInStock != null ? (
                  selectedPaperItem.quantityInStock.toLocaleString()
                ) : (
                  <span className="text-zinc-400">Select a paper item</span>
                )}
              </div>
            </div>

            {/* Quantity of Sheets Taken */}
            <div className="space-y-1.5">
              <Label>Quantity of Sheets Taken</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={paperFields["quantityOfSheetsTaken"] ?? ""}
                onChange={(e) => {
                  const sheetsVal = e.target.value;
                  setPaperFields((p) => ({
                    ...p,
                    quantityOfSheetsTaken: sheetsVal,
                  }));
                  const sheets = Number(sheetsVal);
                  const cutouts = cuttingPreview?.maxCutOutsPerSheet;
                  if (cutouts != null && sheets > 0) {
                    setCutFields((p) => ({
                      ...p,
                      cutQuantity: String(sheets * cutouts),
                    }));
                  }
                }}
              />
            </div>

            {/* Cost Per Sheet */}
            <div className="space-y-1.5">
              <Label>Cost Per Sheet (₦)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paperFields["costPerSheet"] ?? ""}
                onChange={(e) =>
                  setPaperFields((p) => ({
                    ...p,
                    costPerSheet: e.target.value,
                  }))
                }
              />
              {selectedPaperItem?.costPerSheet != null && (
                <p className="text-xs text-zinc-400">
                  Suggested: {fmt(selectedPaperItem.costPerSheet)}/sheet
                </p>
              )}
            </div>

            {/* Sheets per Packet */}
            <div className="space-y-1.5">
              <Label>Sheets per Packet</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {paperFields["sheetsPerPacket"] ?? (
                  <span className="text-zinc-400">
                    Auto-filled from paper item
                  </span>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={paperFields["stageStatus"] ?? "PENDING"}
                onValueChange={(v) =>
                  v && setPaperFields((p) => ({ ...p, stageStatus: v }))
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
                value={paperFields["expectedTimeline"] ?? ""}
                onChange={(e) =>
                  setPaperFields((p) => ({
                    ...p,
                    expectedTimeline: e.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Cutting Form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cut Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cut Size */}
            <div className="space-y-1.5">
              <Label>Cut Size</Label>
              <Select
                value={cutFields["cutSize"] ?? ""}
                onValueChange={(v) =>
                  v && setCutFields((p) => ({ ...p, cutSize: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cut size" />
                </SelectTrigger>
                <SelectContent>
                  {cutSizeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cut Outs Per Sheet — from preview */}
            <div className="space-y-1.5">
              <Label>Cut Outs Per Sheet</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {cuttingLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                ) : cuttingPreview?.maxCutOutsPerSheet != null ? (
                  cuttingPreview.maxCutOutsPerSheet
                ) : (
                  <span className="text-zinc-400">
                    Select source + cut size
                  </span>
                )}
              </div>
            </div>

            {/* Cost Per Cut — from preview */}
            <div className="space-y-1.5">
              <Label>Cost Per Cut (₦)</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {cuttingLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                ) : cuttingPreview?.costPerCut != null ? (
                  fmt(cuttingPreview.costPerCut)
                ) : (
                  <span className="text-zinc-400">Calculated from rules</span>
                )}
              </div>
            </div>

            {/* Cost Per Cut-Sheet */}
            <div className="space-y-1.5">
              <Label>Cost Per Cut-Sheet (₦)</Label>
              <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {cuttingLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                ) : costPerCutSheet != null ? (
                  fmt(costPerCutSheet)
                ) : (
                  <span className="text-zinc-400">Calculated from rules</span>
                )}
              </div>
            </div>

            {/* Feeds Stage */}
            <div className="space-y-1.5">
              <Label>Feeds Stage (optional)</Label>
              <Select
                value={cutFields["targetOperationStage"] ?? ""}
                onValueChange={(v) =>
                  setCutFields((p) => ({
                    ...p,
                    targetOperationStage: v ?? "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CTP_MAKING">CTP Making</SelectItem>
                  <SelectItem value="PRINTING">Printing</SelectItem>
                  <SelectItem value="DIECUTTING">Die Cutting</SelectItem>
                  <SelectItem value="LAMINATION">Lamination</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cut Status */}
            <div className="space-y-1.5">
              <Label>Cut Status</Label>
              <Select
                value={cutFields["stageStatus"] ?? "PENDING"}
                onValueChange={(v) =>
                  v && setCutFields((p) => ({ ...p, stageStatus: v }))
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

            {/* Cutting Preview Panel */}
            {(paperSize || cutSize) && (
              <div
                className={`rounded-lg border border-dashed p-3 text-sm ${
                  cuttingPreviewError
                    ? "border-red-200 bg-red-50"
                    : "border-teal-200 bg-teal-50/70"
                }`}
              >
                {cuttingLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating…
                  </div>
                ) : cuttingPreviewError ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Cut size doesn&apos;t fit inside the selected source sheet.
                  </div>
                ) : cuttingPreview ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label="Raw Cut Outs"
                      value={String(cuttingPreview.rawCutOuts)}
                    />
                    <Stat
                      label="Bag Sheets"
                      value={String(cuttingPreview.bagSheets)}
                    />
                    <Stat
                      label="Max Cut Outs/Sheet"
                      value={String(cuttingPreview.maxCutOutsPerSheet)}
                    />
                    <Stat
                      label="Cost per Diecut"
                      value={fmt(cuttingPreview.costPerDiecut)}
                    />
                    <Stat
                      label="Sheets Selected"
                      value={
                        cuttingPreview.sheetFractionUsed != null
                          ? String(cuttingPreview.sheetFractionUsed)
                          : "Enter sheets"
                      }
                    />
                    <Stat
                      label="Total Cutouts"
                      value={
                        cuttingPreview.totalCutoutsFromSelectedSheets != null
                          ? String(cuttingPreview.totalCutoutsFromSelectedSheets)
                          : cuttingPreview.requestedCuts != null
                            ? String(cuttingPreview.requestedCuts)
                            : "—"
                      }
                    />
                    <div className="col-span-2 mt-1 flex items-start gap-1.5 text-teal-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {cuttingPreview.totalCutoutsFromSelectedSheets != null
                          ? `${cuttingPreview.totalCutoutsFromSelectedSheets} cutouts will be available for the next stage.`
                          : "Enter quantity of sheets to see total cutouts."}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Info className="h-4 w-4" />
                    Select both source sheet size and cut size to preview.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Info className="h-4 w-4" />
          All other production stages will unlock once Paper Selection status is
          set to <strong>Complete</strong>.
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/production-orders/${id}`)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSave}
            disabled={
              isSaving ||
              (!paperFields["inventoryId"] && !paperFields["paperSize"])
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save & Return to Order"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}
