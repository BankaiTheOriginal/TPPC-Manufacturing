"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Wrench,
  ChevronRight,
  ChevronDown,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Plus,
  X,
  RefreshCw,
  MapPin,
  Clock,
  Scissors,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { CostSummaryPanel } from "@/components/cost-summary-panel";

interface ProductOrderMaterial {
  id: string;
  inventoryId: string;
  quantity: string;
  quantityUsed: string;
  unitPrice: string;
  lineTotal: string;
  endTotal: string;
  inventory?: { itemName: string; sku: string };
}

interface ProductOrderOperation {
  id: string;
  operationStage: string;
  inventoryId?: string | null;
  operationName: string | null;
  labourCost: string | null;
  assignedStaffId: string | null;
  quantityFinished: number | null;
  quantityWasted: number | null;
  estimatedTimeMin: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  // Paper
  paperSize: string | null;
  sheetsPerPacket: number | null;
  costPerPacket: string | null;
  costPerSheet: string | null;
  // Cutting
  cutSize: string | null;
  cutQuantity: number | null;
  costPerCut: string | null;
  // CTP
  ctpMachine: string | null;
  ctpCostPerColor: string | null;
  // Printing
  printMachine: string | null;
  printCostPerColor: string | null;
  // Lamination
  laminationType: string | null;
  laminationSize: string | null;
  glossCost: string | null;
  matteCost: string | null;
  // Diecut
  diecutSize: string | null;
  costPerDiecut: string | null;
  // Finishing
  itemFinished: string | null;
  finishingLocation: string | null;
  twistedHandles: number | null;
  bagBaseSize: string | null;
  costPerFinish: string | null;
  // New operation fields
  vendor: string | null;
  ctpPlates: number | null;
  printImpressions: number | null;
  printCostPerImpression: string | null;
  laminationSheetsCount: number | null;
  itemPackaged: string | null;
  packagingLocation: string | null;
  quantityItemFinished: number | null;
  costPerPackaging: string | null;
  // Cut-pool linking
  targetOperationStage: string | null;
  sourceCuttingOpId: string | null;
  cutsConsumed: number | null;
  cuttingPreview?: CuttingPreview | null;
  // Stage tracking
  stageStatus: string | null;
  locationId: string | null;
  // Lifecycle timestamps
  startedAt: string | null;
  stageMovedAt: string | null;
  completedAt: string | null;
}

interface OperationServiceLine {
  operationId: string;
  operationStage: string;
  stageLabel: string;
  serviceSku: string;
  serviceName: string;
  operationName: string | null;
  stageStatus: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  quantitySource: string | null;
  sourceCostField: string | null;
}

interface FactoryWorkerActivity {
  id: string;
  productOrderId: string | null;
  locationId: string;
  supervisorId: string;
  workerNames: string[];
  workDate: string;
  quantityAllocated: number;
  quantityFinished: number;
  quantityWasted: number;
  typeOfFinishing: string | null;
  costPerFinish: string | null;
  notes: string | null;
  totalAmount: number;
  createdAt: string;
  productOrder: {
    id: string;
    sku: string;
    productName: string;
  } | null;
  location: { id: string; name: string; state: string };
  supervisor: {
    id: string;
    firstName: string;
    lastName: string;
    staffId: string;
  };
}

interface ProductOrder {
  id: string;
  sku: string;
  productName: string;
  productType: string;
  productCategory: string;
  quantity: number;
  orderType: string;
  priority: string;
  status: string | null;
  grandTotal: string;
  subtotal: string;
  labourCost: string;
  zohoBooksId: string | null;
  salesOrderNumber?: string | null;
  salesOrderCustomerName?: string | null;
  referenceId?: string | null;
  zohoLocationId?: string | null;
  zohoLocationName?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  factoryLabourTotal: number;
  materials: ProductOrderMaterial[];
  factoryWorkerActivities: FactoryWorkerActivity[];
  operationServices: OperationServiceLine[];
  operationServicesTotal: number;
  productOrderOperations: ProductOrderOperation[];
}

interface ZohoLocation {
  location_id: string;
  location_name: string;
  status?: string;
  is_primary?: boolean;
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
}

interface ProductionOption {
  value: string;
  label: string;
}

interface MachineOption {
  id: string;
  name: string;
  operationStage: string;
}

interface VendorOption {
  id: string;
  name: string;
  operationStage: string;
}

function normalizeCollectionResponse<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw as T[];
  }

  if (raw && typeof raw === "object") {
    const record = raw as { items?: unknown; data?: unknown };
    if (Array.isArray(record.items)) {
      return record.items as T[];
    }
    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
  }

  return [];
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

const emptyFactoryActivityForm = {
  workDate: "",
  locationId: "",
  supervisorId: "",
  workerNamesRaw: "",
  quantityAllocated: "",
  quantityFinished: "",
  quantityWasted: "",
  typeOfFinishing: "",
  costPerFinish: "",
  notes: "",
};

function toInputDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

// Mirrors backend buildOperationServiceLine logic so the user sees the
// auto-computed per-stage cost live in the dialog before saving.
function computeStageTotal(
  stage: string | null,
  opFields: Record<string, string>,
  productionRules: ProductionRules | undefined,
): { unitCost: number; quantity: number; total: number } | null {
  if (!stage) return null;
  const num = (key: string) => {
    const raw = opFields[key];
    if (raw == null || raw === "") return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  switch (stage) {
    case "CUTTING": {
      const q = num("cutQuantity");
      const u = num("costPerCut");
      return { unitCost: u, quantity: q, total: u * q };
    }
    case "CTP_MAKING": {
      const q = num("ctpPlates") || 1;
      const u = num("ctpCostPerColor");
      return { unitCost: u, quantity: q, total: u * q };
    }
    case "PRINTING": {
      const impCost = num("printCostPerImpression");
      if (impCost > 0) {
        const q = num("printImpressions") || 1;
        return { unitCost: impCost, quantity: q, total: impCost * q };
      }
      const u = num("printCostPerColor");
      return { unitCost: u, quantity: 1, total: u };
    }
    case "DIECUTTING": {
      const q = num("cutQuantity") || num("printImpressions");
      const u = num("costPerDiecut");
      return { unitCost: u, quantity: q, total: u * q };
    }
    case "LAMINATION": {
      const q = num("laminationSheetsCount");
      const rule = productionRules?.lamination.find(
        (l) => l.size === opFields["laminationSize"],
      );
      const type = opFields["laminationType"];
      const ruleCost =
        type === "Matte" ? rule?.matteCost ?? 0 : type === "Gloss" ? rule?.glossCost ?? 0 : 0;
      const u = num(type === "Matte" ? "matteCost" : "glossCost") || ruleCost;
      return { unitCost: u, quantity: q, total: u * q };
    }
    case "FINISHING": {
      const q = num("quantityFinished");
      const finishUnit = num("costPerFinish");
      const baseRule = productionRules?.bagBase.find(
        (b) => b.size === opFields["bagBaseSize"],
      );
      const baseUnit = baseRule?.costPerBag ?? 0;
      const handlesCount = num("twistedHandles");
      const handleUnit = productionRules?.twistedHandles.unitCost ?? 65;
      const unitCost = finishUnit + baseUnit;
      return {
        unitCost,
        quantity: q,
        total: unitCost * q + handlesCount * handleUnit,
      };
    }
    case "PACKAGING": {
      const q = num("quantityItemFinished");
      const u = num("costPerPackaging");
      return { unitCost: u, quantity: q, total: u * q };
    }
    default:
      return null;
  }
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
  finishing: { itemFinished: string; costPerFinish: number }[];
  bagBase: { size: string; label: string; costPerBag: number }[];
  twistedHandles: { unitCost: number; description: string };
}

const statusSchema = z
  .object({
    status: z.string().min(1, "Required"),
    priority: z.string().optional(),
    zohoLocationId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === "COMPLETE" || value.status === "PARTIALLY_COMPLETE") &&
      !value.zohoLocationId?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["zohoLocationId"],
        message: "Select a Zoho location before completing this order",
      });
    }
  });

type StatusForm = z.infer<typeof statusSchema>;

const stageLabels: Record<string, string> = {
  PAPER_SELECTION: "Paper & Cutting",
  CUTTING: "Cutting",
  ARTWORK_DESIGN: "Artwork / Design",
  CTP_MAKING: "CTP Making",
  PRINTING: "Printing",
  DIECUTTING: "Die Cutting",
  LAMINATION: "Lamination",
  FINISHING: "Finishing",
  PACKAGING: "Packaging",
};

const priorityColors: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETE: "bg-green-100 text-green-700",
  PARTIALLY_COMPLETE: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  PARTIALLY_COMPLETE: "Partially Complete",
  CANCELLED: "Cancelled",
};

const laminationTypeOptions: ProductionOption[] = [
  { value: "Gloss", label: "Gloss" },
  { value: "Matte", label: "Matte" },
];

export default function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.SUPERVISOR,
    ROLES.DESIGN_TEAM,
  ]);
  const router = useRouter();
  const qc = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showMarkAs, setShowMarkAs] = useState(false);
  const markAsRef = useRef<HTMLDivElement>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showFactoryActivityForm, setShowFactoryActivityForm] =
    useState(false);
  const [editingFactoryActivityId, setEditingFactoryActivityId] = useState<
    string | null
  >(null);
  const [factoryActivityForm, setFactoryActivityForm] = useState(
    emptyFactoryActivityForm,
  );
  const [showDeleteFactoryActivityId, setShowDeleteFactoryActivityId] =
    useState<string | null>(null);

  // Operation form state â€” common + stage-specific fields
  const [opFields, setOpFields] = useState<Record<string, string>>({});
  const [vendorSearch, setVendorSearch] = useState("");

  function sanitizeStageOperationFields(fields: Record<string, string>) {
    const sanitized = { ...fields };
    delete sanitized.labourCost;
    delete sanitized.quantityWasted;
    return sanitized;
  }

  function openStageDialog(stage: string) {
    // Paper Selection and Cutting now live on their own dedicated page
    if (stage === "PAPER_SELECTION" || stage === "CUTTING") {
      router.push(`/production-orders/${id}/paper-selection`);
      return;
    }

    // Finishing has its own dedicated page
    if (stage === "FINISHING") {
      router.push(`/production-orders/${id}/finishing`);
      return;
    }

    const opsForStage = order?.productOrderOperations.filter(
      (o) => o.operationStage === stage,
    );
    const existing =
      opsForStage && opsForStage.length
        ? opsForStage[opsForStage.length - 1]
        : undefined;
    // Pre-fill from existing operation if present
    const prefilled: Record<string, string> = {};
    if (existing) {
      for (const [k, v] of Object.entries(existing)) {
        if (
          v !== null &&
          v !== undefined &&
          k !== "operationStage" &&
          k !== "cuttingPreview"
        ) {
          prefilled[k] = String(v);
        }
      }
    }

    // (printingOperation removed - not used)

    if (stage === "DIECUTTING") {
      const cuttingOps =
        order?.productOrderOperations.filter(
          (o) => o.operationStage === "CUTTING",
        ) ?? [];
      const lastCut = cuttingOps.length
        ? cuttingOps[cuttingOps.length - 1]
        : null;
      if (!prefilled.diecutSize && lastCut?.cutSize) {
        prefilled.diecutSize = lastCut.cutSize;
      }
      if (
        !prefilled.costPerDiecut &&
        lastCut?.cuttingPreview?.costPerDiecut != null
      ) {
        prefilled.costPerDiecut = String(lastCut.cuttingPreview.costPerDiecut);
      }
    }
    if (stage === "PRINTING") {
      // Sheet size flows from cut size
      const cuttingOps =
        order?.productOrderOperations.filter(
          (o) => o.operationStage === "CUTTING",
        ) ?? [];
      const lastCut = cuttingOps.length
        ? cuttingOps[cuttingOps.length - 1]
        : null;
      if (!prefilled.cutSize && lastCut?.cutSize) {
        prefilled.cutSize = lastCut.cutSize;
      }
    }
    if (stage === "CUTTING") {
      // Prefill paperSize/cost from the last paper selection if present
      const paperOps =
        order?.productOrderOperations.filter(
          (o) => o.operationStage === "PAPER_SELECTION",
        ) ?? [];
      const lastPaper = paperOps.length ? paperOps[paperOps.length - 1] : null;
      if (!prefilled.inventoryId && lastPaper?.inventoryId) {
        prefilled.inventoryId = lastPaper.inventoryId;
      }
      if (!prefilled.paperSize && lastPaper?.paperSize) {
        prefilled.paperSize = lastPaper.paperSize;
      }
      if (!prefilled.costPerSheet && lastPaper?.costPerSheet != null) {
        prefilled.costPerSheet = String(lastPaper.costPerSheet);
      }
    }
    if (stage === "LAMINATION") {
      const cuttingOps =
        order?.productOrderOperations.filter(
          (o) => o.operationStage === "CUTTING",
        ) ?? [];
      const lastCut = cuttingOps.length
        ? cuttingOps[cuttingOps.length - 1]
        : null;
      if (!prefilled.laminationSize && lastCut?.cutSize) {
        prefilled.laminationSize = lastCut.cutSize;
      }
    }

    setVendorSearch("");
    setOpFields(sanitizeStageOperationFields(prefilled));
    setSelectedStage(stage);
  }

  const opMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/production-orders/${id}/operations`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-filter-options"] });
      toast.success("Operation saved");
      setSelectedStage(null);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to save operation";
      toast.error(message);
    },
  });

  // Fields that are valid to send to the backend for each stage.
  // Only these keys (plus the COMMON_OP_FIELDS) are included in the payload.
  const STAGE_OP_FIELDS: Record<string, ReadonlySet<string>> = {
    PAPER_SELECTION: new Set([
      "inventoryId", "paperSelectionOpId", "paperSize", "sheetsPerPacket",
      "costPerPacket", "costPerSheet", "warehouseLocationId",
      "quantityOfSheetsTaken", "targetOperationStage",
    ]),
    CUTTING: new Set([
      "paperSelectionOpId", "inventoryId", "paperSize", "costPerSheet",
      "cutSize", "cutQuantity", "costPerCut", "targetOperationStage",
      "sourceCuttingOpId", "cutsConsumed",
    ]),
    ARTWORK_DESIGN: new Set([
      "vendor", "artworkDesignerId", "numberOfDesigns", "designNames",
      "designStatus",
    ]),
    CTP_MAKING: new Set([
      "vendor", "ctpMachine", "ctpPlates", "ctpCostPerColor", "ctpType",
      "sourceCuttingOpId", "cutsConsumed",
    ]),
    PRINTING: new Set([
      "vendor", "printMachine", "printImpressions", "printCostPerImpression",
      "printCostPerColor", "cutSize", "sourceCuttingOpId", "cutsConsumed",
    ]),
    DIECUTTING: new Set([
      "vendor", "diecutSize", "costPerDiecut", "printImpressions",
      "sourceCuttingOpId", "cutsConsumed",
    ]),
    LAMINATION: new Set([
      "vendor", "laminationType", "laminationSize", "glossCost", "matteCost",
      "laminationSheetsCount", "costPerLamination",
      "sourceCuttingOpId", "cutsConsumed",
    ]),
    FINISHING: new Set([
      "itemFinished", "finishingLocation", "twistedHandles", "costPerFinish",
      "bagBaseSize", "quantityFinished", "wastageFromPrinting",
      "wastageFromDiecutting", "wastageFromLaminating", "wastageFromHandling",
    ]),
    PACKAGING: new Set([
      "itemPackaged", "packagingLocation", "quantityItemFinished",
      "costPerPackaging",
    ]),
  };
  // Fields sent for every stage
  const COMMON_OP_FIELDS = new Set([
    "id", "assignedStaffId", "stageStatus",
    "locationId", "expectedTimeline",
  ]);

  // Fields that should be coerced to numbers before sending
  const NUMERIC_OP_FIELDS = new Set([
    "sheetsPerPacket", "cutQuantity", "quantityWasted", "estimatedTimeMin",
    "twistedHandles", "ctpPlates", "printImpressions", "laminationSheetsCount",
    "quantityItemFinished", "cutsConsumed", "numberOfDesigns", "quantityFinished",
    "wastageFromPrinting", "wastageFromDiecutting", "wastageFromLaminating",
    "wastageFromHandling",
  ]);

  function submitOperation() {
    if (!selectedStage) return;
    if (selectedStage === "CUTTING") {
      if (!opFields["cutQuantity"]) {
        toast.error("Enter the number of cuts for this cutting operation");
        return;
      }
      if (cuttingPreview?.exceedsMaxCutOuts) {
        toast.error(
          "Requested cuts are higher than the maximum cut outs per sheet",
        );
        return;
      }
      if (cuttingPreview?.exceedsRemainingPaper) {
        toast.error("This cut uses more paper than remains on this order");
        return;
      }
    }

    const allowedKeys = new Set([
      ...COMMON_OP_FIELDS,
      ...(STAGE_OP_FIELDS[selectedStage] ?? []),
    ]);

    const payload: Record<string, unknown> = {
      operationStage: selectedStage,
      operationName: stageLabels[selectedStage] ?? selectedStage,
    };

    // Auto-compute totalWastage for Finishing
    if (selectedStage === "FINISHING") {
      payload.totalWastage =
        Number(opFields["wastageFromPrinting"] ?? 0) +
        Number(opFields["wastageFromDiecutting"] ?? 0) +
        Number(opFields["wastageFromLaminating"] ?? 0) +
        Number(opFields["wastageFromHandling"] ?? 0);
    }

    if (
      opFields["stageStatus"] === "COMPLETE" &&
      totalCutQuantity > 0 &&
      selectedStage !== "PAPER_SELECTION" &&
      selectedStage !== "CUTTING"
    ) {
      payload.quantityFinished = totalCutQuantity;
      if (selectedStage === "PACKAGING") {
        payload.quantityItemFinished = totalCutQuantity;
      }
    }

    for (const [k, v] of Object.entries(opFields)) {
      if (!allowedKeys.has(k)) continue;
      if (v === "") continue;
      if (k === "locationId" && v === "__none__") continue;
      // Skip quantity fields already set above for COMPLETE status
      if (
        opFields["stageStatus"] === "COMPLETE" &&
        totalCutQuantity > 0 &&
        selectedStage !== "PAPER_SELECTION" &&
        selectedStage !== "CUTTING" &&
        (k === "quantityFinished" ||
          (selectedStage === "PACKAGING" && k === "quantityItemFinished"))
      ) {
        continue;
      }
      payload[k] = NUMERIC_OP_FIELDS.has(k) ? Number(v) : v;
    }

    opMutation.mutate(payload);
  }

  const { data: order, isLoading } = useQuery<ProductOrder>({
    queryKey: ["production-orders", id],
    queryFn: () => api.get(`/production-orders/${id}`).then((r) => r.data),
  });

  const operationServices = order?.operationServices ?? [];
  const factoryWorkerActivities = order?.factoryWorkerActivities ?? [];
  const servicesTotal = order?.operationServicesTotal ?? 0;
  const factoryLabourTotal = order?.factoryLabourTotal ?? 0;
  const materialsAndPaperTotal = order
    ? Math.max(parseFloat(order.subtotal) - servicesTotal, 0)
    : 0;

  const { data: productionRules } = useQuery<ProductionRules>({
    queryKey: ["production-order-rules"],
    queryFn: () => api.get("/production-orders/rules").then((r) => r.data),
    enabled: selectedStage !== null,
    staleTime: 5 * 60 * 1000,
  });

  const selectedPaperSize = opFields["paperSize"] ?? "";
  const selectedCutSize = opFields["cutSize"] ?? "";
  const selectedCostPerSheet = opFields["costPerSheet"] ?? "";
  const selectedRequestedCuts = opFields["cutQuantity"] ?? "";
  const selectedCuttingInventoryId = opFields["inventoryId"] ?? "";
  const editingOperationId = opFields["id"] ?? "";

  const {
    data: cuttingPreview,
    error: cuttingPreviewError,
    isFetching: isCuttingPreviewLoading,
  } = useQuery<CuttingPreview>({
    queryKey: [
      "production-order-cutting-preview",
      selectedPaperSize,
      selectedCutSize,
      selectedCostPerSheet,
      selectedRequestedCuts,
      selectedCuttingInventoryId,
      editingOperationId,
    ],
    queryFn: () =>
      api
        .get("/production-orders/cutting-preview", {
          params: {
            paperSize: selectedPaperSize,
            cutSize: selectedCutSize,
            productOrderId: id,
            ...(selectedCuttingInventoryId
              ? { inventoryId: selectedCuttingInventoryId }
              : {}),
            ...(selectedRequestedCuts
              ? { requestedCuts: selectedRequestedCuts }
              : {}),
            ...(editingOperationId ? { operationId: editingOperationId } : {}),
            ...(selectedCostPerSheet
              ? { costPerSheet: selectedCostPerSheet }
              : {}),
          },
        })
        .then((r) => r.data),
    enabled:
      selectedStage === "CUTTING" &&
      selectedPaperSize.length > 0 &&
      selectedCutSize.length > 0,
    retry: false,
  });

  const { data: allUsers = [] } = useQuery<
    {
      id: string;
      firstName: string;
      lastName: string;
      staffId: string;
      role: string;
    }[]
  >({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users?limit=200").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: stageMachinery = [] } = useQuery<MachineOption[]>({
    queryKey: ["machinery", selectedStage],
    queryFn: () =>
      api
        .get("/machinery", {
          params: selectedStage ? { operationStage: selectedStage } : undefined,
        })
        .then((r) => normalizeCollectionResponse<MachineOption>(r.data)),
    enabled: selectedStage !== null,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: stageVendors = [] } = useQuery<VendorOption[]>({
    queryKey: ["vendors", selectedStage],
    queryFn: () =>
      api
        .get("/vendors", {
          params: selectedStage ? { operationStage: selectedStage } : undefined,
        })
        .then((r) => normalizeCollectionResponse<VendorOption>(r.data)),
    enabled: selectedStage !== null,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const factorySupervisors = allUsers.filter((userOption) =>
    [
      "SUPERVISOR",
      "HEAD_OF_OPERATIONS",
      "PRODUCTION_MANAGER",
      "ADMINISTRATOR",
      "GENERAL_MANAGER",
    ].includes(userOption.role),
  );

  const saveFactoryActivityMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (editingFactoryActivityId) {
        return api
          .patch(`/factory-activity/${editingFactoryActivityId}`, body)
          .then((r) => r.data);
      }

      return api.post("/factory-activity", body).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      qc.invalidateQueries({ queryKey: ["factory-activity"] });
      toast.success(
        editingFactoryActivityId
          ? "Factory labour updated"
          : "Factory labour added",
      );
      setShowFactoryActivityForm(false);
      setEditingFactoryActivityId(null);
      setFactoryActivityForm(emptyFactoryActivityForm);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to save factory labour";
      toast.error(message);
    },
  });

  const deleteFactoryActivityMutation = useMutation({
    mutationFn: (activityId: string) => api.delete(`/factory-activity/${activityId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      qc.invalidateQueries({ queryKey: ["factory-activity"] });
      toast.success("Factory labour removed");
      setShowDeleteFactoryActivityId(null);
    },
    onError: () => toast.error("Failed to remove factory labour"),
  });

  const assignMutation = useMutation({
    mutationFn: (body: { operationStage: string; assignedStaffId: string }) =>
      api.post(`/production-orders/${id}/operations`, body).then((r) => r.data),
    onMutate: async (body) => {
      // Cancel any in-flight refetch so it doesn't overwrite the optimistic update
      await qc.cancelQueries({ queryKey: ["production-orders", id] });
      const previous = qc.getQueryData<ProductOrder>(["production-orders", id]);
      // Optimistically patch the operation in the cache.
      // If no operation row exists yet for this stage, insert a placeholder so
      // the assigned-staff name appears immediately before the server responds.
      qc.setQueryData<ProductOrder>(["production-orders", id], (old) => {
        if (!old) return old;
        const hasExisting = old.productOrderOperations.some(
          (op) => op.operationStage === body.operationStage,
        );
        if (hasExisting) {
          const ops = old.productOrderOperations.map((op) =>
            op.operationStage === body.operationStage
              ? { ...op, assignedStaffId: body.assignedStaffId }
              : op,
          );
          return { ...old, productOrderOperations: ops };
        }
        // No row yet — insert a minimal placeholder so the UI reflects the pick
        const placeholder: ProductOrderOperation = {
          id: `optimistic-${body.operationStage}`,
          operationStage: body.operationStage,
          operationName: null,
          labourCost: null,
          assignedStaffId: body.assignedStaffId,
          quantityFinished: null,
          quantityWasted: null,
          estimatedTimeMin: null,
          stageStatus: "PENDING",
          paperSize: null, sheetsPerPacket: null, costPerPacket: null, costPerSheet: null,
          cutSize: null, cutQuantity: null, costPerCut: null,
          ctpMachine: null, ctpCostPerColor: null,
          printMachine: null, printCostPerColor: null,
          laminationType: null, laminationSize: null, glossCost: null, matteCost: null,
          diecutSize: null, costPerDiecut: null,
          itemFinished: null, finishingLocation: null, twistedHandles: null,
          bagBaseSize: null, costPerFinish: null,
          vendor: null, ctpPlates: null, printImpressions: null,
          printCostPerImpression: null, laminationSheetsCount: null,
          itemPackaged: null, packagingLocation: null,
          quantityItemFinished: null, costPerPackaging: null,
          targetOperationStage: null, sourceCuttingOpId: null, cutsConsumed: null,
          locationId: null, startedAt: null, stageMovedAt: null, completedAt: null,
          inventoryId: null, createdAt: null, updatedAt: null,
        };
        return {
          ...old,
          productOrderOperations: [...old.productOrderOperations, placeholder],
        };
      });
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      // Roll back on failure
      if (ctx?.previous) {
        qc.setQueryData(["production-orders", id], ctx.previous);
      }
      toast.error("Failed to assign operation");
    },
    onSuccess: (returnedOp: ProductOrderOperation) => {
      // Replace the placeholder (or existing row) with the real server response
      // so the cache is accurate immediately — no full refetch delay.
      qc.setQueryData<ProductOrder>(["production-orders", id], (old) => {
        if (!old) return old;
        const alreadyIn = old.productOrderOperations.some(
          (op) => op.id === returnedOp.id,
        );
        const ops = alreadyIn
          ? old.productOrderOperations.map((op) =>
              op.id === returnedOp.id ? returnedOp : op,
            )
          : old.productOrderOperations
              .filter((op) => op.id !== `optimistic-${returnedOp.operationStage}`)
              .concat(returnedOp);
        return { ...old, productOrderOperations: ops };
      });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Operation assigned");
    },
  });

  const sourceSheetOptions = productionRules?.sourceSheetSizes ?? [];
  const cutSizeOptions = productionRules?.cutSizes ?? [];
  const paperItems =
    productionRules?.paperItems ?? productionRules?.paperTypes ?? [];
  const getPaperItemKey = (paper: ProductionPaperItem) =>
    String(paper.itemId ?? paper.sku ?? paper.paperType);
  const selectedPaperItem =
    paperItems.find(
      (paper) =>
        paper.itemId === opFields["inventoryId"] ||
        getPaperItemKey(paper) === opFields["paperItemKey"] ||
        paper.paperType === opFields["paperType"] ||
        (paper.sourceSheetSize === opFields["paperSize"] &&
          (paper.costPerSheet == null ||
            Number(paper.costPerSheet) ===
              Number(opFields["costPerSheet"] ?? ""))),
    ) ?? null;
  const selectedPaperOptionKey = selectedPaperItem
    ? getPaperItemKey(selectedPaperItem)
    : "";
  const paperItemOptions = paperItems.map((paper) => ({
    value: getPaperItemKey(paper),
    label: `${paper.itemName}${paper.sku ? ` (${paper.sku})` : ""} · ${paper.sourceSheetSizeLabel}`,
  }));
  function handlePaperSelect(paperKey: string) {
    const paper = paperItems.find((item) => getPaperItemKey(item) === paperKey);
    if (!paper) return;
    setOpFields((prev) => ({
      ...prev,
      inventoryId: paper.itemId ?? "",
      paperItemKey: paperKey,
      paperType: paper.paperType,
      paperSize: paper.sourceSheetSize,
      costPerSheet:
        paper.costPerSheet != null ? String(paper.costPerSheet) : "",
      sheetsPerPacket:
        paper.sheetsPerPacket != null ? String(paper.sheetsPerPacket) : "",
      costPerPacket:
        paper.costPerPacket != null ? String(paper.costPerPacket) : "",
    }));
  }
  function editOperation(op: ProductOrderOperation) {
    const prefilled: Record<string, string> = {};
    for (const [k, v] of Object.entries(
      op as unknown as Record<string, unknown>,
    )) {
      if (
        v !== null &&
        v !== undefined &&
        k !== "operationStage" &&
        k !== "cuttingPreview"
      ) {
        prefilled[k] = String(v);
      }
    }
    setOpFields(sanitizeStageOperationFields(prefilled));
  }
  const stageMachineOptions = stageMachinery.map((item) => ({
    value: item.name,
    label: item.name,
  }));
  const ctpMachineOptions =
    selectedStage === "CTP_MAKING" && stageMachineOptions.length > 0
      ? stageMachineOptions
      : (productionRules?.ctp.map((item) => ({
          value: item.machine,
          label: `${item.machine} (${formatCurrency(item.costPerColor)}/color)`,
        })) ?? []);
  const printMachineOptions =
    selectedStage === "PRINTING" && stageMachineOptions.length > 0
      ? stageMachineOptions
      : (productionRules?.print.map((item) => ({
          value: item.machine,
          label: `${item.machine} (${formatCurrency(item.costPerColor)}/color)`,
        })) ?? []);
  const stageVendorOptions = stageVendors.map((item) => ({
    value: item.name,
    label: item.name,
  }));
  const ctpVendorOptions =
    selectedStage === "CTP_MAKING" ? stageVendorOptions : [];
  const printingVendorOptions =
    selectedStage === "PRINTING" ? stageVendorOptions : [];
  const diecutVendorOptions =
    selectedStage === "DIECUTTING" ? stageVendorOptions : [];
  const laminationVendorOptions =
    selectedStage === "LAMINATION" ? stageVendorOptions : [];
  const laminationSizeOptions =
    productionRules?.lamination.map((item) => ({
      value: item.size,
      label: item.sizeLabel,
    })) ?? [];
  const finishingItemOptions =
    productionRules?.finishing.map((item) => ({
      value: item.itemFinished,
      label: `${item.itemFinished} (${String(item.costPerFinish)})`,
    })) ?? [];
  const cuttingOperations =
    order?.productOrderOperations.filter(
      (o) => o.operationStage === "CUTTING",
    ) ?? [];
  const totalCutQuantity = cuttingOperations.reduce(
    (sum, operation) => sum + (operation.cutQuantity ?? 0),
    0,
  );
  const latestCuttingOperation =
    cuttingOperations.length > 0
      ? cuttingOperations[cuttingOperations.length - 1]
      : null;
  const printingCuttingPreview = latestCuttingOperation?.cuttingPreview ?? null;

  /** Remaining cut pieces for a given cutting operation (client-side calc) */
  function getRemainingCuts(cutOp: ProductOrderOperation): number | null {
    if (cutOp.cutQuantity == null) return null;
    const allOps = order?.productOrderOperations ?? [];
    const consumed = allOps
      .filter((op) => op.sourceCuttingOpId === cutOp.id)
      .reduce(
        (sum, op) => sum + (op.cutsConsumed ?? 0) + (op.quantityWasted ?? 0),
        0,
      );
    return cutOp.cutQuantity - consumed;
  }

  /** Build options for the "Source Cut" selector shown on downstream stage dialogs */
  const sourceCutOptions = cuttingOperations.map((co) => {
    const remaining = getRemainingCuts(co);
    return {
      value: co.id,
      label: `${co.cutSize ?? "Cut"} — ${co.cutQuantity ?? 0} produced${remaining != null ? `, ${remaining} remaining` : ""}${co.targetOperationStage ? ` (→ ${co.targetOperationStage})` : ""}`,
    };
  });

  const totalRemainingCuts = cuttingOperations.reduce((sum, operation) => {
    const remaining = getRemainingCuts(operation);
    return sum + (remaining ?? operation.cutQuantity ?? 0);
  }, 0);
  const cutSummaryBySize = cuttingOperations.reduce(
    (summary, operation) => {
      const key = operation.cutSize ?? "Unspecified";
      const current = summary.get(key) ?? { produced: 0, remaining: 0 };
      current.produced += operation.cutQuantity ?? 0;
      current.remaining += getRemainingCuts(operation) ?? 0;
      summary.set(key, current);
      return summary;
    },
    new Map<string, { produced: number; remaining: number }>(),
  );

  // --- Add Material ---
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [matInventoryId, setMatInventoryId] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matUnitPrice, setMatUnitPrice] = useState("");
  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
  const inventoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close inventory dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        inventoryDropdownRef.current &&
        !inventoryDropdownRef.current.contains(e.target as Node)
      ) {
        setShowInventoryDropdown(false);
      }
    }
    if (showInventoryDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInventoryDropdown]);

  // Search-only UI state (debounced + paging)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [matSelectedLabel, setMatSelectedLabel] = useState("");
  const [searchPage, setSearchPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(inventorySearch), 300);
    return () => clearTimeout(t);
  }, [inventorySearch]);

  const inventorySearchQuery = useQuery<Record<string, unknown>[]>({
    queryKey: ["inventory-search", debouncedSearch, searchPage],
    queryFn: () =>
      api
        .get("/inventory", {
          params: {
            q: debouncedSearch || undefined,
            page: searchPage,
            limit: 50,
          },
        })
        .then((r) => {
          const d = r.data;
          if (Array.isArray(d)) {
            return d as Record<string, unknown>[];
          }
          if (d && typeof d === "object") {
            const obj = d as Record<string, unknown>;
            if (Array.isArray(obj.items)) {
              return obj.items as Record<string, unknown>[];
            }
          }
          return [] as Record<string, unknown>[];
        }),
    enabled: showAddMaterial && debouncedSearch.length > 0,
  });

  const inventorySearchResults = (inventorySearchQuery.data ?? []) as Array<{
    itemId?: string;
    id?: string;
    sku?: string;
    itemName?: string;
    name?: string;
    rate?: number;
    price?: number | string;
  }>;
  const isSearching = inventorySearchQuery.isFetching;

  const addMaterialMutation = useMutation({
    mutationFn: (body: {
      inventoryId: string;
      quantity: string;
      unitPrice: string;
    }) =>
      api.post(`/production-orders/${id}/materials`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      toast.success("Material added");
      setShowAddMaterial(false);
      setMatInventoryId("");
      setMatQty("");
      setMatUnitPrice("");
    },
    onError: () => toast.error("Failed to add material"),
  });

  const removeMaterialMutation = useMutation({
    mutationFn: (materialId: string) =>
      api.delete(`/production-orders/${id}/materials/${materialId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      toast.success("Material removed");
    },
    onError: () => toast.error("Failed to remove material"),
  });

  // --- Update Material Usage ---
  const [editingUsage, setEditingUsage] = useState<string | null>(null);
  const [usageValue, setUsageValue] = useState("");

  const updateUsageMutation = useMutation({
    mutationFn: (body: { materialId: string; quantityUsed: string }) =>
      api
        .patch(`/production-orders/${id}/materials/${body.materialId}/usage`, {
          quantityUsed: body.quantityUsed,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      toast.success("Usage updated");
      setEditingUsage(null);
    },
    onError: () => toast.error("Failed to update usage"),
  });

  function openAddMaterial() {
    setMatInventoryId("");
    setMatQty("");
    setMatUnitPrice("");
    setMatSelectedLabel("");
    setInventorySearch("");
    setDebouncedSearch("");
    setSearchPage(1);
    setShowInventoryDropdown(false);
    setShowAddMaterial(true);
  }

  function handleInventorySelect(
    invId: string,
    price?: string,
    label?: string,
  ) {
    console.log("handleInventorySelect:", { invId, price, label });
    setMatInventoryId(invId);
    if (price) setMatUnitPrice(price);
    if (label) setMatSelectedLabel(label);
    // clear search when user picks an item
    setInventorySearch("");
    setDebouncedSearch("");
    setSearchPage(1);
  }

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<StatusForm>({
    resolver: zodResolver(statusSchema) as Resolver<StatusForm>,
  });

  const selectedStatus = useWatch({ control, name: "status" });

  const zohoLocationsQuery = useQuery<ZohoLocation[]>({
    queryKey: ["zoho-locations"],
    queryFn: () =>
      api.get("/zoho/locations").then((r) => r.data as ZohoLocation[]),
    enabled: showEdit,
    staleTime: 1000 * 60 * 5,
  });

  interface FactoryLocation {
    id: string;
    name: string;
    state: string;
  }
  const factoryLocationsQuery = useQuery<FactoryLocation[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const factoryLocations = factoryLocationsQuery.data ?? [];

  function openCreateFactoryActivity() {
    setEditingFactoryActivityId(null);
    setFactoryActivityForm({
      ...emptyFactoryActivityForm,
      workDate: toInputDate(new Date()),
    });
    setShowFactoryActivityForm(true);
  }

  function openEditFactoryActivity(activity: FactoryWorkerActivity) {
    setEditingFactoryActivityId(activity.id);
    setFactoryActivityForm({
      workDate: toInputDate(activity.workDate),
      locationId: activity.locationId,
      supervisorId: activity.supervisorId,
      workerNamesRaw: activity.workerNames.join(", "),
      quantityAllocated: String(activity.quantityAllocated),
      quantityFinished: String(activity.quantityFinished),
      quantityWasted: String(activity.quantityWasted),
      typeOfFinishing: activity.typeOfFinishing ?? "",
      costPerFinish: activity.costPerFinish ?? "",
      notes: activity.notes ?? "",
    });
    setShowFactoryActivityForm(true);
  }

  function closeFactoryActivityForm() {
    setShowFactoryActivityForm(false);
    setEditingFactoryActivityId(null);
    setFactoryActivityForm(emptyFactoryActivityForm);
  }

  function saveFactoryActivity() {
    if (!factoryActivityForm.workDate) {
      toast.error("Select the work date");
      return;
    }
    if (!factoryActivityForm.locationId) {
      toast.error("Select a factory location");
      return;
    }
    if (!factoryActivityForm.supervisorId) {
      toast.error("Select a supervisor");
      return;
    }
    if (!factoryActivityForm.quantityAllocated) {
      toast.error("Enter quantity allocated");
      return;
    }

    const workerNames = factoryActivityForm.workerNamesRaw
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    saveFactoryActivityMutation.mutate({
      productOrderId: id,
      workDate: factoryActivityForm.workDate,
      locationId: factoryActivityForm.locationId,
      supervisorId: factoryActivityForm.supervisorId,
      workerNames,
      quantityAllocated: Number(factoryActivityForm.quantityAllocated),
      quantityFinished: factoryActivityForm.quantityFinished
        ? Number(factoryActivityForm.quantityFinished)
        : 0,
      quantityWasted: factoryActivityForm.quantityWasted
        ? Number(factoryActivityForm.quantityWasted)
        : 0,
      typeOfFinishing: factoryActivityForm.typeOfFinishing || undefined,
      costPerFinish: factoryActivityForm.costPerFinish || undefined,
      notes: factoryActivityForm.notes || undefined,
    });
  }

  function handleMarkAs(newStatus: string) {
    if (newStatus === "COMPLETE" || newStatus === "PARTIALLY_COMPLETE") {
      reset({
        status: newStatus,
        priority: order?.priority ?? "MEDIUM",
        zohoLocationId: order?.zohoLocationId ?? "",
      });
      setShowEdit(true);
    } else {
      updateMutation.mutate({
        status: newStatus,
        priority: order?.priority ?? "MEDIUM",
      });
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (markAsRef.current && !markAsRef.current.contains(e.target as Node)) {
        setShowMarkAs(false);
      }
    }
    if (showMarkAs) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMarkAs]);

  const updateMutation = useMutation({
    mutationFn: async (body: StatusForm) => {
      console.log("[production-order] sending status update", {
        productionOrderId: id,
        body,
      });
      const response = await api.patch(`/production-orders/${id}`, body);
      console.log("[production-order] status update response", response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log("[production-order] update success", data);
      if (data?.zohoSync) {
        console.log("[production-order] zoho sync result", data.zohoSync);
        if (data.zohoSync.success) {
          toast.success("Order updated and Zoho sync started successfully");
        } else {
          toast.error(
            `Order updated but Zoho sync failed: ${data.zohoSync.error ?? "Unknown error"}`,
          );
        }
      } else {
        toast.success("Order updated");
      }
      qc.invalidateQueries({ queryKey: ["production-orders", id] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      setShowEdit(false);
    },
    onError: (error) => {
      console.error("[production-order] update failed", error);
      toast.error("Failed to update order");
    },
  });

  const isUpdatingOrder = updateMutation.isPending;
  const zohoLocations = zohoLocationsQuery.data ?? [];
  const updateStatusLabel =
    selectedStatus === "COMPLETE"
      ? "Completing order and syncing inventory"
      : selectedStatus === "PARTIALLY_COMPLETE"
        ? "Creating partial assembly and syncing inventory"
        : "Updating production order";
  const updateStatusDetail =
    selectedStatus === "COMPLETE"
      ? "We're applying inventory changes and syncing Zoho. This can take a few seconds."
      : selectedStatus === "PARTIALLY_COMPLETE"
        ? "We're creating a partial Zoho assembly with current material usage. This can take a few seconds."
        : "We're saving the latest status and refreshing the order details.";

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/production-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Order deleted");
      router.replace("/production-orders");
    },
    onError: () => toast.error("Failed to delete order"),
  });

  const repeatMutation = useMutation({
    mutationFn: () =>
      api.post(`/production-orders/${id}/repeat`).then((r) => r.data),
    onSuccess: (newOrder) => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Order repeated");
      router.push(`/production-orders/${newOrder.id}`);
    },
    onError: () => toast.error("Failed to repeat order"),
  });

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/production-orders"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Production Orders
        </Link>
        <div className="flex items-center gap-2">
          {order?.status === "COMPLETE" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => repeatMutation.mutate()}
              disabled={repeatMutation.isPending || isLoading}
            >
              <RefreshCw className="h-4 w-4" />
              {repeatMutation.isPending ? "Creating..." : "Repeat Order"}
            </Button>
          )}
          <div className="relative" ref={markAsRef}>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowMarkAs((s) => !s)}
              disabled={isLoading}
            >
              Mark as
              <ChevronDown className="h-4 w-4" />
            </Button>
            {showMarkAs && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {[
                  { value: "PENDING", label: "Pending" },
                  { value: "IN_PROGRESS", label: "In Progress" },
                  { value: "PARTIALLY_COMPLETE", label: "Partially Complete" },
                  { value: "COMPLETE", label: "Complete" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-50 ${
                      order?.status === value
                        ? "font-semibold text-zinc-900"
                        : "text-zinc-700"
                    }`}
                    onClick={() => {
                      setShowMarkAs(false);
                      handleMarkAs(value);
                    }}
                  >
                    {label}
                    {order?.status === value && (
                      <span className="ml-1 text-xs text-zinc-400">
                        (current)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowDelete(true)}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Order Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-zinc-900">
                  {order?.productName}
                </h1>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[order?.status ?? "PENDING"] ?? "bg-zinc-100 text-zinc-600"}`}
                >
                  {statusLabels[order?.status ?? "PENDING"] ??
                    order?.status ??
                    "PENDING"}
                </span>
              </>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <p className="font-mono text-sm text-zinc-500">{order?.sku}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </>
          ) : (
            <>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[order?.priority ?? "MEDIUM"] ?? "bg-zinc-100 text-zinc-600"}`}
              >
                {order?.priority}
              </span>
              <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                Qty: {order?.quantity.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main - Operations & Materials */}
        <div className="space-y-6 xl:col-span-2">
          {/* Operations Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-zinc-400" />
                Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3"
                    >
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const stageKeys = Object.keys(stageLabels).filter(
                    (s) => s !== "CUTTING",
                  );
                  const stageStatuses = stageKeys.map((stage) => {
                    const ops =
                      order?.productOrderOperations.filter(
                        (o) => o.operationStage === stage,
                      ) ?? [];
                    return ops.length
                      ? (ops[ops.length - 1].stageStatus ?? "PENDING")
                      : "PENDING";
                  });
                  const relevant = stageStatuses.filter((s) => s !== "NA");
                  const completed = stageStatuses.filter(
                    (s) => s === "COMPLETE",
                  ).length;
                  const pct =
                    order?.status === "COMPLETE"
                      ? 100
                      : relevant.length === 0
                        ? 0
                        : Math.round((completed / relevant.length) * 100);

                  const stageStatusColors: Record<string, string> = {
                    PENDING: "bg-zinc-200 text-zinc-600",
                    IN_PROGRESS: "bg-blue-100 text-blue-700",
                    PARTIALLY_COMPLETE: "bg-amber-100 text-amber-700",
                    COMPLETE: "bg-green-100 text-green-700",
                    NA: "bg-zinc-100 text-zinc-400",
                  };
                  const stageStatusLabels: Record<string, string> = {
                    PENDING: "Pending",
                    IN_PROGRESS: "In Progress",
                    PARTIALLY_COMPLETE: "Partially Complete",
                    COMPLETE: "Complete",
                    NA: "N/A",
                  };

                  return (
                    <>
                      {/* Progress bar */}
                      <div className="space-y-1 border-b border-zinc-100 px-4 py-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Stage Progress</span>
                          <span className="font-semibold text-zinc-700">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-zinc-400">
                          {completed} of {relevant.length} relevant stage
                          {relevant.length !== 1 ? "s" : ""} complete
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="w-8 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                #
                              </th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Stage
                              </th>
                              <th className="w-52 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Assigned To
                              </th>
                              <th className="w-28 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Status
                              </th>
                              <th className="w-36 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Started
                              </th>
                              <th className="w-36 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Last Move
                              </th>
                              <th className="w-36 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Completed
                              </th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Key Details
                              </th>
                              <th className="w-20 px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {stageKeys.map((stage, idx) => {
                              const ops =
                                order?.productOrderOperations.filter(
                                  (o) => o.operationStage === stage,
                                ) ?? [];
                              const op = ops.length
                                ? ops[ops.length - 1]
                                : undefined;
                              const ss = op?.stageStatus ?? "PENDING";
                              const assignedUser = allUsers.find(
                                (u) => u.id === op?.assignedStaffId,
                              );

                              const isPaperStage =
                                stage === "PAPER_SELECTION" ||
                                stage === "CUTTING";

                              // Build key details summary
                              const parts: string[] = [];
                              if (stage === "PAPER_SELECTION") {
                                const allPaperOps = (
                                  order?.productOrderOperations ?? []
                                ).filter(
                                  (o) => o.operationStage === "PAPER_SELECTION",
                                );
                                if (allPaperOps.length > 1) {
                                  parts.push(
                                    `${allPaperOps.length} paper types`,
                                  );
                                } else {
                                  if (op?.paperSize) parts.push(op.paperSize);
                                  if (op?.costPerSheet)
                                    parts.push(
                                      `₦${Number(op.costPerSheet).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/sheet`,
                                    );
                                  if (op?.sheetsPerPacket)
                                    parts.push(`${op.sheetsPerPacket} sheets`);
                                }
                              } else if (stage === "CUTTING") {
                                if (totalCutQuantity > 0) {
                                  parts.push(`${totalCutQuantity} total cuts`);
                                  parts.push(`${totalRemainingCuts} remaining`);
                                }
                                if (cutSummaryBySize.size > 0) {
                                  parts.push(
                                    Array.from(cutSummaryBySize.entries())
                                      .map(
                                        ([size, summary]) =>
                                          `${size}: ${summary.produced}`,
                                      )
                                      .join(", "),
                                  );
                                } else if (op?.cutSize) {
                                  parts.push(op.cutSize);
                                }
                                if (op?.costPerCut)
                                  parts.push(
                                    `₦${Number(op.costPerCut).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/cut`,
                                  );
                                if (op?.targetOperationStage)
                                  parts.push(`→ ${op.targetOperationStage}`);
                              } else if (stage === "CTP_MAKING") {
                                if (op?.vendor) parts.push(String(op.vendor));
                                if (op?.ctpMachine) parts.push(op.ctpMachine);
                                if (op?.ctpPlates)
                                  parts.push(`${op.ctpPlates} plates`);
                                if (op?.ctpCostPerColor)
                                  parts.push(
                                    `₦${Number(op.ctpCostPerColor).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/plate`,
                                  );
                              } else if (stage === "PRINTING") {
                                if (op?.vendor) parts.push(String(op.vendor));
                                if (op?.printMachine)
                                  parts.push(op.printMachine);
                                if (op?.printImpressions)
                                  parts.push(
                                    `${op.printImpressions} impressions`,
                                  );
                                if (op?.printCostPerImpression)
                                  parts.push(
                                    `₦${Number(op.printCostPerImpression).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/impression`,
                                  );
                              } else if (stage === "DIECUTTING") {
                                if (op?.vendor) parts.push(String(op.vendor));
                                if (op?.diecutSize) parts.push(op.diecutSize);
                                if (op?.costPerDiecut)
                                  parts.push(
                                    `₦${Number(op.costPerDiecut).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/diecut`,
                                  );
                                if (op?.quantityWasted)
                                  parts.push(`${op.quantityWasted} wasted`);
                              } else if (stage === "LAMINATION") {
                                if (op?.vendor) parts.push(String(op.vendor));
                                if (op?.laminationType && op?.laminationSize)
                                  parts.push(
                                    `${op.laminationType} ${op.laminationSize}`,
                                  );
                                else if (op?.laminationType)
                                  parts.push(op.laminationType);
                                if (op?.laminationSheetsCount)
                                  parts.push(
                                    `${op.laminationSheetsCount} sheets`,
                                  );
                                if (op?.quantityWasted)
                                  parts.push(`${op.quantityWasted} wasted`);
                              } else if (stage === "FINISHING") {
                                if (op?.itemFinished)
                                  parts.push(op.itemFinished);
                                if (op?.quantityFinished != null)
                                  parts.push(`${op.quantityFinished} finished`);
                                if (op?.costPerFinish)
                                  parts.push(
                                    `₦${Number(op.costPerFinish).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/finish`,
                                  );
                                if (op?.quantityWasted)
                                  parts.push(`${op.quantityWasted} wasted`);
                              } else if (stage === "PACKAGING") {
                                if (op?.itemPackaged)
                                  parts.push(String(op.itemPackaged));
                                if (op?.costPerPackaging)
                                  parts.push(
                                    `₦${Number(op.costPerPackaging).toLocaleString("en-NG", { minimumFractionDigits: 2 })}/pack`,
                                  );
                                if (op?.quantityItemFinished)
                                  parts.push(
                                    `${op.quantityItemFinished} items`,
                                  );
                                if (op?.quantityWasted)
                                  parts.push(`${op.quantityWasted} wasted`);
                              }
                              const keyDetails =
                                parts.length > 0 ? parts.join(" · ") : null;

                              const rowBg = ss === "COMPLETE"
                                  ? "bg-green-50/40"
                                  : ss === "PARTIALLY_COMPLETE"
                                    ? "bg-amber-50/40"
                                  : ss === "IN_PROGRESS"
                                    ? "bg-blue-50/30"
                                    : ss === "NA"
                                      ? "bg-zinc-50/30 opacity-60"
                                      : "bg-zinc-50/30";

                              return (
                                <tr
                                  key={stage}
                                  className={`cursor-pointer transition-colors hover:bg-blue-50/30 ${rowBg}`}
                                  onClick={() => openStageDialog(stage)}
                                >
                                  <td className="px-4 py-3">
                                    <div
                                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                        isPaperStage
                                            ? "bg-blue-100 text-blue-700"
                                            : ss === "COMPLETE"
                                              ? "bg-green-100 text-green-700"
                                              : ss === "PARTIALLY_COMPLETE"
                                                ? "bg-amber-100 text-amber-700"
                                              : ss === "IN_PROGRESS"
                                                ? "bg-blue-100 text-blue-700"
                                                : ss === "NA"
                                                  ? "bg-zinc-100 text-zinc-400"
                                                  : "bg-zinc-200 text-zinc-600"
                                      }`}
                                    >
                                      {isPaperStage && stage === "PAPER_SELECTION" ? (
                                        <Scissors className="h-3 w-3" />
                                      ) : (
                                        idx + 1
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-medium text-zinc-800">
                                        {stageLabels[stage]}
                                      </span>

                                      {stage === "CUTTING" && (
                                        <span className="rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                                          via Paper Selection
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td
                                    className="px-4 py-3"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Select
                                      value={op?.assignedStaffId ?? "__none__"}
                                      onValueChange={(v) => {
                                        if (v && v !== "__none__") {
                                          assignMutation.mutate({
                                            operationStage: stage,
                                            assignedStaffId: v,
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 w-full text-xs">
                                        <SelectValue>
                                          {assignedUser ? (
                                            `${assignedUser.firstName} ${assignedUser.lastName} (${assignedUser.staffId})`
                                          ) : (
                                            <span className="text-zinc-400">
                                              Unassigned
                                            </span>
                                          )}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">
                                          — Unassigned —
                                        </SelectItem>
                                        {allUsers.map((u) => (
                                          <SelectItem key={u.id} value={u.id}>
                                            {u.firstName} {u.lastName} (
                                            {u.staffId})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${stageStatusColors[ss] ?? "bg-zinc-100 text-zinc-500"}`}
                                    >
                                      {stageStatusLabels[ss] ?? ss}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {op?.startedAt ? (
                                      <span
                                        className="text-xs text-zinc-600"
                                        title={new Date(
                                          op.startedAt,
                                        ).toLocaleString()}
                                      >
                                        {new Date(
                                          op.startedAt,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        <span className="ml-1 text-zinc-400">
                                          {new Date(
                                            op.startedAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-300">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {op?.stageMovedAt ? (
                                      <span
                                        className="text-xs text-zinc-600"
                                        title={new Date(
                                          op.stageMovedAt,
                                        ).toLocaleString()}
                                      >
                                        {new Date(
                                          op.stageMovedAt,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        <span className="ml-1 text-zinc-400">
                                          {new Date(
                                            op.stageMovedAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-300">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {op?.completedAt ? (
                                      <span
                                        className="text-xs text-zinc-600"
                                        title={new Date(
                                          op.completedAt,
                                        ).toLocaleString()}
                                      >
                                        {new Date(
                                          op.completedAt,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        <span className="ml-1 text-zinc-400">
                                          {new Date(
                                            op.completedAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-300">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="max-w-xs px-4 py-3">
                                    {keyDetails ? (
                                      <span className="text-xs text-zinc-600">
                                        {keyDetails}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-300">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {isPaperStage && stage === "PAPER_SELECTION" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs text-blue-600"
                                        onClick={() =>
                                          router.push(
                                            `/production-orders/${id}/paper-selection`,
                                          )
                                        }
                                      >
                                        Open
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => openStageDialog(stage)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Total production time summary */}
                      {(() => {
                        const ops = order?.productOrderOperations ?? [];
                        const earliest = ops
                          .map((o) => o.startedAt)
                          .filter(Boolean)
                          .map((d) => new Date(d!).getTime())
                          .sort((a, b) => a - b)[0];
                        const latest = ops
                          .map((o) => o.completedAt)
                          .filter(Boolean)
                          .map((d) => new Date(d!).getTime())
                          .sort((a, b) => b - a)[0];

                        if (!earliest) return null;

                        const diffMs = latest
                          ? latest - earliest
                          : Date.now() - earliest;
                        const diffMin = Math.floor(diffMs / 60000);
                        const hours = Math.floor(diffMin / 60);
                        const mins = diffMin % 60;
                        const durationLabel =
                          hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                        return (
                          <div className="flex items-center gap-3 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span>
                              <span className="font-medium text-zinc-700">
                                Total production time:
                              </span>{" "}
                              {durationLabel}
                              {!latest && (
                                <span className="ml-1 text-zinc-400">
                                  (in progress)
                                </span>
                              )}
                            </span>
                            {earliest && (
                              <span className="text-zinc-400">
                                · Started {new Date(earliest).toLocaleString()}
                              </span>
                            )}
                            {latest && (
                              <span className="text-zinc-400">
                                · Finished {new Date(latest).toLocaleString()}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-zinc-400" />
                Materials
              </CardTitle>
              <Button
                size="sm"
                className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
                onClick={openAddMaterial}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" />
                Add Material
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Item
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Qty Used
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Unit Price (N)
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Line Total (N)
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      End Total (N)
                    </th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-10" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-10" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                        <td className="px-5 py-3" />
                      </tr>
                    ))
                  ) : (order?.materials.length ?? 0) === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-zinc-400"
                      >
                        No materials assigned
                      </td>
                    </tr>
                  ) : (
                    order?.materials.map((m) => (
                      <tr
                        key={`${m.id}-${m.inventoryId}`}
                        className="hover:bg-zinc-50/50"
                      >
                        <td className="px-5 py-3 font-medium">
                          <div>{m.inventory?.itemName ?? m.inventoryId}</div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {parseFloat(m.quantity).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {editingUsage === m.id ? (
                            <form
                              className="inline-flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                updateUsageMutation.mutate({
                                  materialId: m.id,
                                  quantityUsed: usageValue,
                                });
                              }}
                            >
                              <Input
                                type="number"
                                step="0.0001"
                                className="h-7 w-20 text-right text-xs"
                                value={usageValue}
                                onChange={(e) => setUsageValue(e.target.value)}
                                autoFocus
                              />
                              <Button
                                type="submit"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={updateUsageMutation.isPending}
                              >
                                Update
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1 text-xs"
                                onClick={() => setEditingUsage(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </form>
                          ) : (
                            <button
                              className="cursor-pointer rounded px-1.5 py-0.5 tabular-nums transition-colors hover:bg-zinc-100"
                              onClick={() => {
                                setEditingUsage(m.id);
                                setUsageValue(m.quantityUsed ?? "0");
                              }}
                              title="Click to edit quantity used"
                            >
                              {parseFloat(
                                m.quantityUsed ?? "0",
                              ).toLocaleString()}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {parseFloat(m.unitPrice).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {parseFloat(m.lineTotal).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {parseFloat(m.endTotal ?? m.lineTotal).toLocaleString(
                            "en-NG",
                            {
                              minimumFractionDigits: 2,
                            },
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => removeMaterialMutation.mutate(m.id)}
                            disabled={removeMaterialMutation.isPending}
                            className="rounded p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-zinc-400" />
                Services
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Service
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Stage
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Unit Cost (N)
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Total (N)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-5 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-5 py-3">
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-10" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                      </tr>
                    ))
                  ) : operationServices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-zinc-400"
                      >
                        No services activated yet
                      </td>
                    </tr>
                  ) : (
                    operationServices.map((service) => (
                      <tr
                        key={`${service.operationId}-${service.serviceSku}`}
                        className="hover:bg-zinc-50/50"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-zinc-900">
                            {service.serviceName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {service.operationName ?? service.serviceSku}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-zinc-600">
                          {service.stageLabel}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[service.stageStatus ?? "PENDING"] ?? statusColors.PENDING}`}
                          >
                            {statusLabels[service.stageStatus ?? "PENDING"] ??
                              service.stageStatus ??
                              "Pending"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {service.quantity.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {service.unitCost.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {service.totalCost.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-zinc-400" />
                Factory Labour
              </CardTitle>
              <Button
                size="sm"
                className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
                onClick={openCreateFactoryActivity}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Date
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Location / Workers
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Supervisor / Type
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Finished
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Cost / Finish (N)
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Total (N)
                    </th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-5 py-3">
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="px-5 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-10" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-16" />
                        </td>
                        <td className="px-5 py-3" />
                      </tr>
                    ))
                  ) : factoryWorkerActivities.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-zinc-400"
                      >
                        No factory labour entries recorded yet
                      </td>
                    </tr>
                  ) : (
                    factoryWorkerActivities.map((activity) => (
                      <tr
                        key={activity.id}
                        className="hover:bg-zinc-50/50"
                      >
                        <td className="px-5 py-3 text-zinc-600">
                          {new Date(activity.workDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-zinc-900">
                            {activity.location.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {activity.workerNames.length > 0
                              ? activity.workerNames.join(", ")
                              : "No workers listed"}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-zinc-800">
                            {activity.supervisor.firstName} {activity.supervisor.lastName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {activity.typeOfFinishing ?? "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {activity.quantityFinished.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {activity.costPerFinish
                            ? Number(activity.costPerFinish).toLocaleString(
                                "en-NG",
                                {
                                  minimumFractionDigits: 2,
                                },
                              )
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">
                          {activity.totalAmount > 0
                            ? activity.totalAmount.toLocaleString("en-NG", {
                                minimumFractionDigits: 2,
                              })
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => openEditFactoryActivity(activity)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-500 hover:bg-red-50"
                              onClick={() =>
                                setShowDeleteFactoryActivityId(activity.id)
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Order Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-20 mb-1" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              ) : (
                <>
                  <div>
                    <p className="text-xs text-zinc-500">SKU</p>
                    <p className="mt-0.5 font-mono text-sm">{order?.sku}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Product Name</p>
                    <p className="mt-0.5 text-sm">{order?.productName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Product Type</p>
                    <p className="mt-0.5 text-sm">{order?.productType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Product Category</p>
                    <p className="mt-0.5 text-sm">{order?.productCategory}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Quantity</p>
                    <p className="mt-0.5 text-sm tabular-nums">
                      {order?.quantity.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Order Type</p>
                    <p className="mt-0.5 text-sm">{order?.orderType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Initiated At</p>
                    <p className="mt-0.5 text-sm">
                      {order?.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  {order?.salesOrderNumber && (
                    <div>
                      <p className="text-xs text-zinc-500">Sales Order</p>
                      <p className="mt-0.5 text-sm">
                        {order.salesOrderNumber}
                        {order.salesOrderCustomerName
                          ? ` — ${order.salesOrderCustomerName}`
                          : ""}
                      </p>
                    </div>
                  )}
                  {order?.referenceId && (
                    <div>
                      <p className="text-xs text-zinc-500">Reference ID</p>
                      <p className="mt-0.5 font-mono text-sm break-all">
                        {order.referenceId}
                      </p>
                    </div>
                  )}
                  {order?.zohoBooksId && (
                    <div>
                      <p className="text-xs text-zinc-500">Zoho Books ID</p>
                      <p className="mt-0.5 font-mono text-sm">
                        {order.zohoBooksId}
                      </p>
                    </div>
                  )}
                  {order?.zohoLocationName && (
                    <div>
                      <p className="text-xs text-zinc-500">Zoho Location</p>
                      <p className="mt-0.5 text-sm">{order.zohoLocationName}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost Summary (N)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Materials &amp; Paper</p>
                    <p className="text-sm tabular-nums">
                      {materialsAndPaperTotal.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Services</p>
                    <p className="text-sm tabular-nums">
                      {servicesTotal.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Factory Labour</p>
                    <p className="text-sm tabular-nums">
                      {factoryLabourTotal.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Subtotal</p>
                    <p className="text-sm tabular-nums">
                      {order
                        ? parseFloat(order.subtotal).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })
                        : "â€”"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">Labour Cost</p>
                    <p className="text-sm tabular-nums">
                      {order
                        ? parseFloat(order.labourCost).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })
                        : "â€”"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      Grand Total
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {order
                        ? parseFloat(order.grandTotal).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })
                        : "â€”"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {order?.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Cost Summary Panel */}
          {order && <CostSummaryPanel orderId={id} />}
        </div>
      </div>

      {/* Confirm Complete / Partially Complete Dialog */}
      <Dialog
        open={showEdit}
        onOpenChange={(open) => !isUpdatingOrder && setShowEdit(open)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedStatus === "PARTIALLY_COMPLETE"
                ? "Mark as Partially Complete"
                : "Mark as Complete"}
            </DialogTitle>
            <DialogDescription>
              {selectedStatus === "PARTIALLY_COMPLETE"
                ? "A partial Zoho assembly will be created using the current material quantities used. The order will remain open for further work."
                : "A Zoho assembly will be created and inventory will be updated. This completes the production order."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Zoho Location</Label>
                <Controller
                  name="zohoLocationId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger
                        disabled={
                          isUpdatingOrder || zohoLocationsQuery.isLoading
                        }
                      >
                        <SelectValue
                          placeholder={
                            zohoLocationsQuery.isLoading
                              ? "Loading locations..."
                              : "Select Zoho location"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {zohoLocations.map((location) => (
                          <SelectItem
                            key={location.location_id}
                            value={location.location_id}
                          >
                            {location.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.zohoLocationId && (
                  <p className="text-xs text-red-500">
                    {errors.zohoLocationId.message}
                  </p>
                )}
                {!zohoLocationsQuery.isLoading &&
                  zohoLocations.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No Zoho locations were returned. Reconnect Zoho or check
                      your Inventory locations.
                    </p>
                  )}
              </div>
              {isUpdatingOrder && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="mt-0.5 h-4 w-4 animate-spin text-teal-500" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-teal-900">
                        {updateStatusLabel}
                      </p>
                      <p className="text-xs leading-5 text-teal-700">
                        {updateStatusDetail}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEdit(false)}
                disabled={isUpdatingOrder}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdatingOrder || zohoLocationsQuery.isLoading}
                className="bg-teal-500 text-white hover:bg-teal-600"
              >
                {isUpdatingOrder && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isUpdatingOrder ? "Updating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Order
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{order?.productName}</span>? This
            cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFactoryActivityForm}
        onOpenChange={(open) => !open && closeFactoryActivityForm()}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-teal-500" />
              {editingFactoryActivityId
                ? "Edit Factory Labour"
                : "Add Factory Labour"}
            </DialogTitle>
            <DialogDescription>
              Record the factory workers, work date, and finishing output tied to
              this production order.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Work Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={factoryActivityForm.workDate}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    workDate: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Factory Location <span className="text-red-500">*</span>
              </Label>
              <Select
                value={factoryActivityForm.locationId}
                onValueChange={(value) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    locationId: value ?? "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location">
                    {factoryActivityForm.locationId ? (
                      (() => {
                        const location = factoryLocations.find(
                          (item) => item.id === factoryActivityForm.locationId,
                        );
                        return location
                          ? `${location.name} (${location.state})`
                          : factoryActivityForm.locationId;
                      })()
                    ) : (
                      <span className="text-zinc-400">Select location</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {factoryLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.state})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>
                Supervisor <span className="text-red-500">*</span>
              </Label>
              <Select
                value={factoryActivityForm.supervisorId}
                onValueChange={(value) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    supervisorId: value ?? "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor">
                    {factoryActivityForm.supervisorId ? (
                      (() => {
                        const supervisor = factorySupervisors.find(
                          (userOption) =>
                            userOption.id === factoryActivityForm.supervisorId,
                        );
                        return supervisor
                          ? `${supervisor.firstName} ${supervisor.lastName} (${supervisor.staffId})`
                          : factoryActivityForm.supervisorId;
                      })()
                    ) : (
                      <span className="text-zinc-400">Select supervisor</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {factorySupervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.firstName} {supervisor.lastName} (
                      {supervisor.staffId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Names of Workers</Label>
              <Input
                placeholder="e.g. Chidi, Amaka, Emeka"
                value={factoryActivityForm.workerNamesRaw}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    workerNamesRaw: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Type of Finishing</Label>
              <Input
                placeholder="e.g. Handle Attachment"
                value={factoryActivityForm.typeOfFinishing}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    typeOfFinishing: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Quantity Allocated <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                value={factoryActivityForm.quantityAllocated}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    quantityAllocated: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Quantity Finished</Label>
              <Input
                type="number"
                min="0"
                value={factoryActivityForm.quantityFinished}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    quantityFinished: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Quantity Wasted</Label>
              <Input
                type="number"
                min="0"
                value={factoryActivityForm.quantityWasted}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    quantityWasted: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cost per Finish (₦)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={factoryActivityForm.costPerFinish}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    costPerFinish: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={factoryActivityForm.notes}
                onChange={(e) =>
                  setFactoryActivityForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={closeFactoryActivityForm}
              disabled={saveFactoryActivityMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-teal-500 text-white hover:bg-teal-600"
              onClick={saveFactoryActivity}
              disabled={saveFactoryActivityMutation.isPending}
            >
              {saveFactoryActivityMutation.isPending
                ? "Saving..."
                : editingFactoryActivityId
                  ? "Update"
                  : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!showDeleteFactoryActivityId}
        onOpenChange={(open) => !open && setShowDeleteFactoryActivityId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Factory Labour
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Remove this factory labour entry from the production order?
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteFactoryActivityId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteFactoryActivityMutation.isPending}
              onClick={() =>
                showDeleteFactoryActivityId &&
                deleteFactoryActivityMutation.mutate(showDeleteFactoryActivityId)
              }
            >
              {deleteFactoryActivityMutation.isPending
                ? "Deleting..."
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Operation Dialog */}
      <Dialog
        open={selectedStage !== null}
        onOpenChange={(open) => !open && setSelectedStage(null)}
      >
        <DialogContent className="!w-[95vw] !max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              {selectedStage ? stageLabels[selectedStage] : ""}
            </DialogTitle>
            <DialogDescription>
              Fill in the details for this production stage. Leave fields blank
              to skip them.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-3 overflow-y-auto py-2 pr-1">
            {/* Common fields */}
            <Section title="General" cols={3}>
              {/* Expected Timeline (due date — shown in the Tasks module) */}
              <div className="space-y-1.5">
                <Label>Expected Timeline</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={opFields["expectedTimeline"] ?? ""}
                  onChange={(e) =>
                    setOpFields((p) => ({ ...p, expectedTimeline: e.target.value }))
                  }
                />
              </div>
              {/* Stage status — hidden for Printing (it has its own status field) */}
              {selectedStage !== "PRINTING" && (
              <div className="space-y-1.5">
                <Label>Stage Status</Label>
                <Select
                  value={opFields["stageStatus"] ?? "PENDING"}
                  onValueChange={(v) => {
                    if (v == null) return;
                    setOpFields((p) => ({
                      ...p,
                      stageStatus: v,
                      ...(v === "COMPLETE" &&
                      totalCutQuantity > 0 &&
                      selectedStage !== "PAPER_SELECTION" &&
                      selectedStage !== "CUTTING"
                        ? {
                            quantityFinished: String(totalCutQuantity),
                            ...(selectedStage === "PACKAGING"
                              ? {
                                  quantityItemFinished:
                                    String(totalCutQuantity),
                                }
                              : {}),
                          }
                        : {}),
                    }));
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Stage status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="PARTIALLY_COMPLETE">Partially Complete</SelectItem>
                    <SelectItem value="COMPLETE">Complete</SelectItem>
                    <SelectItem value="NA">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}
              {/* Location */}
              <div className="space-y-1.5">
                <Label>Factory Location</Label>
                <Select
                  value={opFields["locationId"] ?? ""}
                  onValueChange={(v) =>
                    setOpFields((p) => ({
                      ...p,
                      locationId: v ?? "",
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <span
                      data-slot="select-value"
                      className="flex flex-1 text-left"
                    >
                      {(() => {
                        const loc = factoryLocations.find(
                          (l) => l.id === opFields["locationId"],
                        );
                        return loc ? (
                          `${loc.name} (${loc.state})`
                        ) : (
                          <span className="text-muted-foreground">
                            Select location
                          </span>
                        );
                      })()}
                    </span>
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
              {/* Assigned To */}
              <div className="space-y-1.5">
                <Label>Assign Staff Member</Label>
                <Select
                  value={opFields["assignedStaffId"] ?? ""}
                  onValueChange={(v) =>
                    v != null &&
                    setOpFields((prev) => ({ ...prev, assignedStaffId: v }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <span
                      data-slot="select-value"
                      className="flex flex-1 text-left"
                    >
                      {(() => {
                        const s = allUsers.find(
                          (u) => u.id === opFields["assignedStaffId"],
                        );
                        return s ? (
                          `${s.firstName} ${s.lastName} (${s.staffId})`
                        ) : (
                          <span className="text-muted-foreground">
                            Select a staff member
                          </span>
                        );
                      })()}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}{" "}
                        <span className="text-zinc-400">({u.staffId})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Section>

            {/* Paper Selection */}
            {selectedStage === "PAPER_SELECTION" && (
              <Section title="Paper Selection">
                {/* Existing paper selections */}
                {(() => {
                  const existingPaperOps = (
                    order?.productOrderOperations ?? []
                  ).filter((o) => o.operationStage === "PAPER_SELECTION");
                  if (existingPaperOps.length === 0) return null;
                  return (
                    <div className="col-span-2">
                      <Label>Papers on This Order</Label>
                      <div className="mt-1 space-y-1.5">
                        {existingPaperOps.map((p) => {
                          const paperMeta = paperItems.find(
                            (pi) => pi.itemId === p.inventoryId,
                          );
                          const paperDisplayName =
                            paperMeta?.itemName ?? p.paperSize ?? "Paper";
                          const paperSizeLabel =
                            paperMeta?.sourceSheetSizeLabel ??
                            p.paperSize ??
                            null;
                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                            >
                              <div>
                                <span className="font-medium">
                                  {paperDisplayName}
                                </span>
                                {paperSizeLabel &&
                                  paperSizeLabel !== paperDisplayName && (
                                    <span className="ml-2 text-xs text-zinc-400">
                                      {paperSizeLabel}
                                    </span>
                                  )}
                                {p.costPerSheet && (
                                  <span className="ml-2 text-xs text-zinc-500">
                                    {formatCurrency(Number(p.costPerSheet))}
                                    /sheet
                                  </span>
                                )}
                                {p.sheetsPerPacket && (
                                  <span className="ml-2 text-xs text-zinc-500">
                                    {p.sheetsPerPacket} sheets
                                  </span>
                                )}
                                {p.targetOperationStage && (
                                  <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                                    → {p.targetOperationStage}
                                  </span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => editOperation(p)}
                              >
                                Edit
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {/* New paper button */}
                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpFields({})}
                  >
                    + New Paper
                  </Button>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Paper Item</Label>
                  <Select
                    value={selectedPaperOptionKey}
                    onValueChange={(v) => v != null && handlePaperSelect(v)}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {selectedPaperOptionKey ? (
                          (paperItemOptions.find(
                            (p) => p.value === selectedPaperOptionKey,
                          )?.label ?? selectedPaperOptionKey)
                        ) : (
                          <span className="text-zinc-400">
                            Select paper item
                          </span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {paperItemOptions.map((paper) => (
                        <SelectItem key={paper.value} value={paper.value}>
                          {paper.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ReadOnlyField
                  label="Source Sheet Size"
                  value={
                    selectedPaperItem?.sourceSheetSizeLabel ??
                    opFields["paperSize"] ??
                    "Select a paper item"
                  }
                />
                <Field
                  label="Cost per Sheet (₦)"
                  field="costPerSheet"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Quantity of Sheets Taken"
                  field="sheetsPerPacket"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                {/* Which stage will use this paper */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Used By Stage (optional)</Label>
                  <Select
                    value={opFields["targetOperationStage"] || ""}
                    onValueChange={(v) =>
                      setOpFields((p) => ({
                        ...p,
                        targetOperationStage: v ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUTTING">Cutting</SelectItem>
                      <SelectItem value="CTP_MAKING">CTP Making</SelectItem>
                      <SelectItem value="PRINTING">Printing</SelectItem>
                      <SelectItem value="DIECUTTING">Die Cutting</SelectItem>
                      <SelectItem value="LAMINATION">Lamination</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Section>
            )}

            {/* Artwork / Design */}
            {selectedStage === "ARTWORK_DESIGN" && (
              <Section title="Artwork / Product Design">
                <div className="col-span-2 space-y-1.5">
                  <Label>Select Designer</Label>
                  <Select
                    value={opFields["vendor"] ?? ""}
                    onValueChange={(v) =>
                      v != null && setOpFields((p) => ({ ...p, vendor: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {opFields["vendor"] ? (
                          opFields["vendor"]
                        ) : (
                          <span className="text-zinc-400">Select designer</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      showSearch
                      searchValue={vendorSearch}
                      onSearchChange={setVendorSearch}
                      searchPlaceholder="Search vendors..."
                    >
                      {stageVendors
                        .filter(
                          (v) =>
                            !vendorSearch ||
                            v.name
                              .toLowerCase()
                              .includes(vendorSearch.toLowerCase()),
                        )
                        .map((v) => (
                          <SelectItem key={v.id} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field
                  label="Number of Designs"
                  field="numberOfDesigns"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="col-span-2 space-y-1.5">
                  <Label>Names of Product Designs</Label>
                  <Input
                    placeholder="e.g. Front design, Back design, Side panel"
                    value={opFields["designNames"] ?? ""}
                    onChange={(e) =>
                      setOpFields((p) => ({
                        ...p,
                        designNames: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <p className="text-xs text-zinc-400">
                    Separate multiple designs with commas
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Design Status</Label>
                  <Select
                    value={opFields["designStatus"] ?? ""}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, designStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="IN_REVIEW">In Review</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="SENT_FOR_CTP">Sent for CTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
              </Section>
            )}

            {/* CTP Making */}
            {selectedStage === "CTP_MAKING" && (
              <Section title="CTP Making">
                <div className="space-y-1.5">
                  <Label>Vendor / Supplier</Label>
                  <Select
                    value={opFields["vendor"] ?? ""}
                    onValueChange={(v) =>
                      v != null && setOpFields((p) => ({ ...p, vendor: v }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {opFields["vendor"] ? (
                          opFields["vendor"]
                        ) : (
                          <span className="text-zinc-400">Select vendor</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      showSearch
                      searchValue={vendorSearch}
                      onSearchChange={setVendorSearch}
                      searchPlaceholder="Search vendors..."
                    >
                      {stageVendors
                        .filter(
                          (v) =>
                            !vendorSearch ||
                            v.name
                              .toLowerCase()
                              .includes(vendorSearch.toLowerCase()),
                        )
                        .map((v) => (
                          <SelectItem key={v.id} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <SelectField
                  label="CTP Machine / Type"
                  field="ctpMachine"
                  placeholder="Select CTP machine"
                  options={ctpMachineOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="No. of CTP Plates"
                  field="ctpPlates"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="CTP Cost per Plate (₦)"
                  field="ctpCostPerColor"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={opFields["stageStatus"] ?? "PENDING"}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, stageStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                      <SelectItem value="NA">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Source cut linkage */}
                {cuttingOperations.length > 0 && (
                  <>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Source Cut (optional)</Label>
                      <Select
                        value={opFields["sourceCuttingOpId"] ?? ""}
                        onValueChange={(v) =>
                          setOpFields((p) => ({
                            ...p,
                            sourceCuttingOpId: v ?? "",
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select source cut" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceCutOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Field
                      label="Cuts Consumed"
                      field="cutsConsumed"
                      type="number"
                      opFields={opFields}
                      setOpFields={setOpFields}
                    />
                    {opFields["sourceCuttingOpId"] &&
                      (() => {
                        const srcCut = cuttingOperations.find(
                          (c) => c.id === opFields["sourceCuttingOpId"],
                        );
                        if (!srcCut) return null;
                        const remaining = getRemainingCuts(srcCut);
                        if (remaining == null) return null;
                        const afterThisOp =
                          remaining - Number(opFields["cutsConsumed"] ?? 0);
                        return (
                          <ReadOnlyField
                            label="Remaining Cuts After This Op"
                            value={String(afterThisOp)}
                            hint="Cuts left in the selected cut pool after this operation."
                          />
                        );
                      })()}
                  </>
                )}
              </Section>
            )}

            {/* Printing */}
            {selectedStage === "PRINTING" && (
              <Section title="Printing">
                <div className="space-y-1.5">
                  <Label>Vendor / Supplier</Label>
                  <Select
                    value={opFields["vendor"] ?? ""}
                    onValueChange={(v) =>
                      v != null && setOpFields((p) => ({ ...p, vendor: v }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {opFields["vendor"] ? (
                          opFields["vendor"]
                        ) : (
                          <span className="text-zinc-400">Select vendor</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      showSearch
                      searchValue={vendorSearch}
                      onSearchChange={setVendorSearch}
                      searchPlaceholder="Search vendors..."
                    >
                      {stageVendors
                        .filter(
                          (v) =>
                            !vendorSearch ||
                            v.name
                              .toLowerCase()
                              .includes(vendorSearch.toLowerCase()),
                        )
                        .map((v) => (
                          <SelectItem key={v.id} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <ReadOnlyField
                  label="Sheet Size (from Cutting)"
                  value={opFields["cutSize"] ?? "—"}
                  hint="Auto-filled from the last Cutting operation."
                />
                <SelectField
                  label="Print Machine"
                  field="printMachine"
                  placeholder="Select print machine"
                  options={printMachineOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>No. of Print Impressions</Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={opFields["printImpressions"] ?? ""}
                    onChange={(e) =>
                      setOpFields((prev) => ({
                        ...prev,
                        printImpressions: e.target.value,
                      }))
                    }
                    className="h-8 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cost per Impression (₦)</Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={opFields["printCostPerImpression"] ?? ""}
                    onChange={(e) =>
                      setOpFields((prev) => ({
                        ...prev,
                        printCostPerImpression: e.target.value,
                      }))
                    }
                    className="h-8 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={opFields["stageStatus"] ?? "PENDING"}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, stageStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                      <SelectItem value="NA">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Source cut linkage */}
                {cuttingOperations.length > 0 && (
                  <>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Source Cut (optional)</Label>
                      <Select
                        value={opFields["sourceCuttingOpId"] ?? ""}
                        onValueChange={(v) =>
                          setOpFields((p) => ({
                            ...p,
                            sourceCuttingOpId: v ?? "",
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select source cut" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceCutOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Field
                      label="Cuts Consumed"
                      field="cutsConsumed"
                      type="number"
                      opFields={opFields}
                      setOpFields={setOpFields}
                    />
                    {opFields["sourceCuttingOpId"] &&
                      (() => {
                        const srcCut = cuttingOperations.find(
                          (c) => c.id === opFields["sourceCuttingOpId"],
                        );
                        if (!srcCut) return null;
                        const remaining = getRemainingCuts(srcCut);
                        if (remaining == null) return null;
                        const afterThisOp =
                          remaining - Number(opFields["cutsConsumed"] ?? 0);
                        return (
                          <ReadOnlyField
                            label="Remaining Cuts After This Op"
                            value={String(afterThisOp)}
                            hint="Cuts left in the selected cut pool after this operation."
                          />
                        );
                      })()}
                  </>
                )}
              </Section>
            )}

            {selectedStage === "CUTTING" && (
              <Section title="Cutting">
                {cuttingOperations.length > 0 && (
                  <div className="col-span-2">
                    <div className="mb-3 rounded border bg-zinc-50 px-3 py-2 text-sm">
                      <div className="font-medium text-zinc-700">
                        Cut Summary: {totalCutQuantity} total cut(s)
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {totalRemainingCuts} remaining across{" "}
                        {cuttingOperations.length} cut job(s)
                        {cutSummaryBySize.size > 0
                          ? ` - ${Array.from(cutSummaryBySize.entries())
                              .map(
                                ([size, summary]) =>
                                  `${size}: ${summary.produced}`,
                              )
                              .join(", ")}`
                          : ""}
                      </div>
                    </div>
                    <Label>Existing Cuts</Label>
                    <div className="space-y-2">
                      {cuttingOperations.map((co) => (
                        <div
                          key={co.id}
                          className="flex items-center justify-between rounded border px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {co.cutSize ?? "-"}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {co.cutQuantity ? `${co.cutQuantity} cut(s)` : ""}
                              {co.cuttingPreview?.sheetFractionUsed != null
                                ? ` · ${co.cuttingPreview.sheetFractionUsed} sheet(s) used`
                                : ""}
                              {co.costPerCut
                                ? ` · ${formatCurrency(Number(co.costPerCut))}/cut`
                                : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => editOperation(co)}
                            >
                              Edit
                            </Button>
                            <div className="text-xs text-zinc-400">
                              {co.createdAt
                                ? new Date(co.createdAt).toLocaleString()
                                : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="col-span-2 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // preserve last paper selection when starting a new cut
                      const paperOps =
                        order?.productOrderOperations.filter(
                          (o) => o.operationStage === "PAPER_SELECTION",
                        ) ?? [];
                      const lastPaper = paperOps.length
                        ? paperOps[paperOps.length - 1]
                        : null;
                      const prefilled: Record<string, string> = {};
                      if (lastPaper?.inventoryId)
                        prefilled.inventoryId = lastPaper.inventoryId;
                      if (lastPaper?.paperSize)
                        prefilled.paperSize = lastPaper.paperSize;
                      if (lastPaper?.costPerSheet != null)
                        prefilled.costPerSheet = String(lastPaper.costPerSheet);
                      setOpFields(prefilled);
                    }}
                    className="ml-auto"
                  >
                    New Cut
                  </Button>
                </div>
                {/* Source paper selector (shown when multiple paper selections exist) */}
                {(() => {
                  const paperOps = (order?.productOrderOperations ?? []).filter(
                    (o) => o.operationStage === "PAPER_SELECTION",
                  );
                  if (paperOps.length <= 1) return null;
                  return (
                    <div className="col-span-2 space-y-1.5">
                      <Label>Source Paper</Label>
                      <Select
                        value={opFields["inventoryId"] ?? ""}
                        onValueChange={(v) => {
                          const sel = paperOps.find((p) => p.inventoryId === v);
                          setOpFields((prev) => ({
                            ...prev,
                            inventoryId: v ?? "",
                            paperSize: sel?.paperSize ?? prev.paperSize,
                            costPerSheet:
                              sel?.costPerSheet != null
                                ? String(sel.costPerSheet)
                                : prev.costPerSheet,
                          }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select source paper" />
                        </SelectTrigger>
                        <SelectContent>
                          {paperOps.map((p) => {
                            const pMeta = paperItems.find(
                              (pi) => pi.itemId === p.inventoryId,
                            );
                            const pName =
                              pMeta?.itemName ?? p.paperSize ?? "Paper";
                            const pSize =
                              pMeta?.sourceSheetSizeLabel ??
                              p.paperSize ??
                              null;
                            return (
                              <SelectItem
                                key={p.id}
                                value={p.inventoryId ?? p.id}
                              >
                                {pName}
                                {pSize && pSize !== pName ? ` (${pSize})` : ""}
                                {p.costPerSheet
                                  ? ` — ${formatCurrency(Number(p.costPerSheet))}/sheet`
                                  : ""}
                                {p.targetOperationStage
                                  ? ` (→ ${p.targetOperationStage})`
                                  : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}
                <SelectField
                  label="Cut Size"
                  field="cutSize"
                  placeholder="Select cut size"
                  options={cutSizeOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Requested Cuts</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter number of cuts"
                    className="h-8 text-sm"
                    value={opFields["cutQuantity"] ?? ""}
                    onChange={(e) =>
                      setOpFields((prev) => ({
                        ...prev,
                        cutQuantity: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-zinc-400">
                    Enter how many cuts you want to take from the selected
                    source sheet.
                  </p>
                </div>
                {/* Which downstream stage will consume these cuts */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Feeds Stage (optional)</Label>
                  <Select
                    value={opFields["targetOperationStage"] || ""}
                    onValueChange={(v) =>
                      setOpFields((p) => ({
                        ...p,
                        targetOperationStage: v ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
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
                <ReadOnlyField
                  label="Max Cut Outs per Sheet"
                  value={
                    isCuttingPreviewLoading
                      ? "Calculating..."
                      : cuttingPreview
                        ? String(cuttingPreview.maxCutOutsPerSheet)
                        : "Select source and cut size"
                  }
                  hint="Calculated automatically from the selected source sheet and cut size."
                />
                <ReadOnlyField
                  label="Remaining Cut Capacity"
                  value={
                    isCuttingPreviewLoading
                      ? "Calculating..."
                      : cuttingPreview?.remainingCutCapacity != null
                        ? String(cuttingPreview.remainingCutCapacity)
                        : "Enter requested cuts"
                  }
                  hint="How many more cuts of this size still fit on one full source sheet."
                />
                <ReadOnlyField
                  label="Cost per Cut (₦)"
                  value={
                    isCuttingPreviewLoading
                      ? "Calculating..."
                      : cuttingPreview?.costPerCut != null
                        ? formatCurrency(cuttingPreview.costPerCut)
                        : (opFields["costPerCut"] ?? "Auto-calculated")
                  }
                  hint="Resolved from the workbook cut-out pricing tiers."
                />
                <div className="col-span-2 rounded-lg border border-dashed border-teal-200 bg-teal-50/70 px-3 py-3 text-sm text-zinc-700">
                  {cuttingPreviewError ? (
                    <p className="text-red-600">
                      This cut size does not fit inside the selected source
                      sheet.
                    </p>
                  ) : cuttingPreview ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Raw Cut Outs
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.rawCutOuts}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Bag Sheets
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.bagSheets}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Cost per Diecut
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.costPerDiecut != null
                            ? formatCurrency(cuttingPreview.costPerDiecut)
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Sheet Qty Used by This Cut
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.sheetFractionUsed != null
                            ? cuttingPreview.sheetFractionUsed.toLocaleString()
                            : "Enter requested cuts"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Paper Used Cost
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.costOfPaperUsed != null
                            ? formatCurrency(cuttingPreview.costOfPaperUsed)
                            : "Enter cost per sheet to preview"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Used on This Order
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.usedSheetsOnOrder != null
                            ? cuttingPreview.usedSheetsOnOrder.toLocaleString()
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          Remaining Paper Qty on Order
                        </p>
                        <p className="font-medium text-zinc-900">
                          {cuttingPreview.remainingSheetsOnOrder != null
                            ? cuttingPreview.remainingSheetsOnOrder.toLocaleString()
                            : cuttingPreview.sourcePaperQuantityPlanned != null
                              ? cuttingPreview.sourcePaperQuantityPlanned.toLocaleString()
                              : "-"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        {cuttingPreview.exceedsMaxCutOuts ? (
                          <p className="font-medium text-red-600">
                            Requested cuts are higher than the maximum cut outs
                            per sheet.
                          </p>
                        ) : cuttingPreview.exceedsRemainingPaper ? (
                          <p className="font-medium text-red-600">
                            This cut uses more source paper than remains
                            available on this order.
                          </p>
                        ) : (
                          <p className="text-zinc-600">
                            {cuttingPreview.remainingCutsForThisSizeOnOrder !=
                            null
                              ? `${cuttingPreview.remainingCutsForThisSizeOnOrder} more cut(s) of this size can still be allocated on this order after this entry.`
                              : "Enter requested cuts to see how much paper this cut will consume."}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p>
                      Select source sheet size and cut size to preview the
                      cut-out calculation.
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Die Cutting */}
            {selectedStage === "DIECUTTING" && (
              <Section title="Die Cutting">
                <div className="space-y-1.5">
                  <Label>Vendor / Supplier</Label>
                  <Select
                    value={opFields["vendor"] ?? ""}
                    onValueChange={(v) =>
                      v != null && setOpFields((p) => ({ ...p, vendor: v }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {opFields["vendor"] ? (
                          opFields["vendor"]
                        ) : (
                          <span className="text-zinc-400">Select vendor</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      showSearch
                      searchValue={vendorSearch}
                      onSearchChange={setVendorSearch}
                      searchPlaceholder="Search vendors..."
                    >
                      {stageVendors
                        .filter(
                          (v) =>
                            !vendorSearch ||
                            v.name
                              .toLowerCase()
                              .includes(vendorSearch.toLowerCase()),
                        )
                        .map((v) => (
                          <SelectItem key={v.id} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <SelectField
                  label="Diecut Size"
                  field="diecutSize"
                  placeholder="Select diecut size"
                  options={cutSizeOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <ReadOnlyField
                  label="Cost per Diecut (₦)"
                  value={
                    printingCuttingPreview?.costPerDiecut != null
                      ? formatCurrency(printingCuttingPreview.costPerDiecut)
                      : (opFields["costPerDiecut"] ??
                        "Set cut size in Printing")
                  }
                  hint="This follows the same cut-out pricing tier from the workbook."
                />
                <Field
                  label="No. of Pieces to Diecut"
                  field="printImpressions"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={opFields["stageStatus"] ?? "PENDING"}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, stageStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                      <SelectItem value="NA">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Source cut linkage */}
                {cuttingOperations.length > 0 && (
                  <>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Source Cut (optional)</Label>
                      <Select
                        value={opFields["sourceCuttingOpId"] ?? ""}
                        onValueChange={(v) =>
                          setOpFields((p) => ({
                            ...p,
                            sourceCuttingOpId: v ?? "",
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select source cut" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceCutOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Field
                      label="Cuts Consumed"
                      field="cutsConsumed"
                      type="number"
                      opFields={opFields}
                      setOpFields={setOpFields}
                    />
                    {opFields["sourceCuttingOpId"] &&
                      (() => {
                        const srcCut = cuttingOperations.find(
                          (c) => c.id === opFields["sourceCuttingOpId"],
                        );
                        if (!srcCut) return null;
                        const remaining = getRemainingCuts(srcCut);
                        if (remaining == null) return null;
                        const afterThisOp =
                          remaining - Number(opFields["cutsConsumed"] ?? 0);
                        return (
                          <ReadOnlyField
                            label="Remaining Cuts After This Op"
                            value={String(afterThisOp)}
                            hint="Cuts left in the selected cut pool after this operation."
                          />
                        );
                      })()}
                  </>
                )}
              </Section>
            )}

            {/* Lamination */}
            {selectedStage === "LAMINATION" && (
              <Section title="Lamination">
                <div className="space-y-1.5">
                  <Label>Vendor / Supplier</Label>
                  <Select
                    value={opFields["vendor"] ?? ""}
                    onValueChange={(v) =>
                      v != null && setOpFields((p) => ({ ...p, vendor: v }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {opFields["vendor"] ? (
                          opFields["vendor"]
                        ) : (
                          <span className="text-zinc-400">Select vendor</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      showSearch
                      searchValue={vendorSearch}
                      onSearchChange={setVendorSearch}
                      searchPlaceholder="Search vendors..."
                    >
                      {stageVendors
                        .filter(
                          (v) =>
                            !vendorSearch ||
                            v.name
                              .toLowerCase()
                              .includes(vendorSearch.toLowerCase()),
                        )
                        .map((v) => (
                          <SelectItem key={v.id} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <SelectField
                  label="Lamination Type"
                  field="laminationType"
                  placeholder="Select lamination type"
                  options={laminationTypeOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <SelectField
                  label="Lamination Size"
                  field="laminationSize"
                  placeholder="Select lamination size"
                  options={laminationSizeOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <ReadOnlyField
                  label="Cost per Lamination (₦)"
                  value={(() => {
                    const rule = productionRules?.lamination.find(
                      (l) => l.size === opFields["laminationSize"],
                    );
                    if (!rule) return "—";
                    if (opFields["laminationType"] === "Gloss")
                      return rule.glossCost > 0
                        ? formatCurrency(rule.glossCost)
                        : "—";
                    if (opFields["laminationType"] === "Matte")
                      return rule.matteCost > 0
                        ? formatCurrency(rule.matteCost)
                        : "—";
                    return "—";
                  })()}
                  hint="Auto-calculated from selected lamination type and size."
                />
                <Field
                  label="No. of Sheets Laminated"
                  field="laminationSheetsCount"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={opFields["stageStatus"] ?? "PENDING"}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, stageStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                      <SelectItem value="NA">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Section>
            )}

            {/* Finishing */}
            {selectedStage === "FINISHING" && (
              <Section title="Finishing" cols={3}>
                {/* Factory location */}
                <div className="col-span-3 space-y-1.5">
                  <Label>Factory Location</Label>
                  <Select
                    value={opFields["finishingLocation"] ?? ""}
                    onValueChange={(v) =>
                      setOpFields((p) => ({
                        ...p,
                        finishingLocation: v ?? "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
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
                <SelectField
                  label="Name of Product Finished"
                  field="itemFinished"
                  placeholder="Select finished item"
                  options={finishingItemOptions}
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Cost per Finish (₦)"
                  field="costPerFinish"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Quantity of Finished Products"
                  field="quantityFinished"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                {/* Bag base (workbook: small/medium=₦5, large=₦10, xlarge=₦15) */}
                <div className="space-y-1.5">
                  <Label>Bag Base Size (optional)</Label>
                  <Select
                    value={opFields["bagBaseSize"] ?? ""}
                    onValueChange={(v) =>
                      setOpFields((p) => ({ ...p, bagBaseSize: v ?? "" }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <span
                        data-slot="select-value"
                        className="flex flex-1 text-left"
                      >
                        {opFields["bagBaseSize"] ? (
                          productionRules?.bagBase.find(
                            (b) => b.size === opFields["bagBaseSize"],
                          )?.label ?? opFields["bagBaseSize"]
                        ) : (
                          <span className="text-zinc-400">
                            Select bag base size
                          </span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {(productionRules?.bagBase ?? []).map((b) => (
                        <SelectItem key={b.size} value={b.size}>
                          {b.label} ({formatCurrency(b.costPerBag)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ReadOnlyField
                  label="Bag Base Cost (₦)"
                  value={(() => {
                    const rule = productionRules?.bagBase.find(
                      (b) => b.size === opFields["bagBaseSize"],
                    );
                    return rule
                      ? formatCurrency(rule.costPerBag)
                      : "—";
                  })()}
                  hint="Auto-resolved from selected bag base size."
                />
                {/* Twisted handles (workbook: flat ₦65 per handle) */}
                <Field
                  label="Twisted Handles (count)"
                  field="twistedHandles"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <ReadOnlyField
                  label="Twisted Handle Cost (₦)"
                  value={(() => {
                    const count = Number(opFields["twistedHandles"] ?? 0);
                    const unit =
                      productionRules?.twistedHandles.unitCost ?? 65;
                    if (!Number.isFinite(count) || count <= 0) return "—";
                    return formatCurrency(count * unit);
                  })()}
                  hint="Count × ₦65 per handle (workbook rate)."
                />
                {/* Wastage breakdown */}
                <Field
                  label="Wastage from Printing"
                  field="wastageFromPrinting"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Wastage from Diecutting"
                  field="wastageFromDiecutting"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Wastage from Laminating"
                  field="wastageFromLaminating"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Wastage from Handling / Stains"
                  field="wastageFromHandling"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <ReadOnlyField
                  label="Total Wastages"
                  value={String(
                    Number(opFields["wastageFromPrinting"] ?? 0) +
                      Number(opFields["wastageFromDiecutting"] ?? 0) +
                      Number(opFields["wastageFromLaminating"] ?? 0) +
                      Number(opFields["wastageFromHandling"] ?? 0),
                  )}
                  hint="Auto-sum of all wastage categories"
                />
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={opFields["stageStatus"] ?? "PENDING"}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, stageStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                      <SelectItem value="NA">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Section>
            )}

            {/* Packaging */}
            {selectedStage === "PACKAGING" && (
              <Section title="Packaging">
                <Field
                  label="Item Packaged"
                  field="itemPackaged"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Packaging Location"
                  field="packagingLocation"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Quantity Item Finished"
                  field="quantityItemFinished"
                  type="number"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Cost per Packaging (₦)"
                  field="costPerPackaging"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <Field
                  label="Expected Timeline"
                  field="expectedTimeline"
                  type="date"
                  opFields={opFields}
                  setOpFields={setOpFields}
                />
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={opFields["stageStatus"] ?? "PENDING"}
                    onValueChange={(v) =>
                      v != null &&
                      setOpFields((p) => ({ ...p, stageStatus: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                      <SelectItem value="NA">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Section>
            )}
          </div>

          {(() => {
            const stageTotal = computeStageTotal(
              selectedStage,
              opFields,
              productionRules,
            );
            if (!stageTotal) return null;
            return (
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-teal-700">
                      Auto-Computed Stage Total
                    </p>
                    <p className="text-[11px] text-teal-700/80">
                      Unit cost × quantity (workbook rules). Persisted
                      server-side when saving.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-teal-900">
                      {formatCurrency(stageTotal.total)}
                    </p>
                    <p className="text-[11px] text-teal-700/80">
                      {formatCurrency(stageTotal.unitCost)} ×{" "}
                      {stageTotal.quantity.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedStage(null)}
              disabled={opMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={submitOperation}
              disabled={
                opMutation.isPending ||
                (selectedStage === "CUTTING" &&
                  (!opFields["cutQuantity"] ||
                    cuttingPreview?.exceedsMaxCutOuts === true ||
                    cuttingPreview?.exceedsRemainingPaper === true))
              }
            >
              {opMutation.isPending ? "Saving..." : "Save Operation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Material Dialog */}
      <Dialog open={showAddMaterial} onOpenChange={setShowAddMaterial}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-500" />
              Add Raw Material
            </DialogTitle>
            <DialogDescription>
              Select a raw material from inventory and specify the quantity
              needed for this production order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Inventory Item — combobox dropdown */}
            <div className="space-y-1.5">
              <Label>
                Inventory Item <span className="text-red-500">*</span>
              </Label>
              <div className="relative" ref={inventoryDropdownRef}>
                {/* Trigger */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-accent/40 transition-colors"
                  onClick={() => {
                    setShowInventoryDropdown((v) => !v);
                    if (!showInventoryDropdown) {
                      // focus the search input after a tick
                      setTimeout(() => {
                        const el =
                          inventoryDropdownRef.current?.querySelector<HTMLInputElement>(
                            "input[data-inv-search]",
                          );
                        el?.focus();
                      }, 50);
                    }
                  }}
                >
                  <span
                    className={
                      matInventoryId && matSelectedLabel
                        ? "text-zinc-800"
                        : "text-zinc-400"
                    }
                  >
                    {matInventoryId && matSelectedLabel
                      ? matSelectedLabel
                      : "Search inventory by name or SKU"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-400 transition-transform ${showInventoryDropdown ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown panel */}
                {showInventoryDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
                    {/* Search input inside dropdown */}
                    <div className="border-b border-zinc-100 p-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                        <input
                          data-inv-search
                          type="text"
                          placeholder="Type to search inventory..."
                          className="w-full rounded border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                          value={inventorySearch}
                          onChange={(e) => {
                            setInventorySearch(e.target.value);
                            setSearchPage(1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape")
                              setShowInventoryDropdown(false);
                          }}
                        />
                      </div>
                    </div>

                    {/* Results list */}
                    <div className="max-h-52 overflow-auto">
                      {debouncedSearch.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-zinc-400">
                          Type to search inventory
                        </p>
                      ) : isSearching ? (
                        <p className="px-3 py-3 text-sm text-zinc-400">
                          Searching…
                        </p>
                      ) : inventorySearchResults.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-zinc-400">
                          No results found
                        </p>
                      ) : (
                        inventorySearchResults.map((item, idx) => {
                          const rec = item as Record<string, unknown>;
                          const invId =
                            (typeof rec.itemId === "string" && rec.itemId) ||
                            (typeof rec.item_id === "string" && rec.item_id) ||
                            (typeof rec.id === "string" && rec.id) ||
                            (typeof rec.sku === "string" && rec.sku) ||
                            "";
                          const sku =
                            typeof rec.sku === "string" ? rec.sku : "";
                          const name =
                            (typeof rec.itemName === "string" &&
                              rec.itemName) ||
                            (typeof rec.name === "string" && rec.name) ||
                            "";
                          const rawRate = rec.rate ?? rec.price;
                          const rate =
                            typeof rawRate === "number" ||
                            typeof rawRate === "string"
                              ? rawRate
                              : undefined;
                          const isSelected = matInventoryId === String(invId);
                          return (
                            <button
                              key={`${invId}-${sku}-${idx}`}
                              type="button"
                              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-zinc-50 ${isSelected ? "bg-teal-50 text-teal-700" : "text-zinc-800"}`}
                              onClick={() => {
                                if (!invId) return;
                                handleInventorySelect(
                                  String(invId),
                                  rate !== undefined ? String(rate) : undefined,
                                  `${name} (${sku})`,
                                );
                                setShowInventoryDropdown(false);
                              }}
                            >
                              <span>{name}</span>
                              <span className="font-mono text-xs text-zinc-400">
                                {sku}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {inventorySearchResults.length === 50 &&
                      debouncedSearch.length > 0 && (
                        <div className="border-t border-zinc-100 p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs"
                            onClick={() => setSearchPage((p) => p + 1)}
                          >
                            Load more results
                          </Button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0"
                  value={matQty}
                  onChange={(e) => setMatQty(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Unit Price (N) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={matUnitPrice}
                  onChange={(e) => setMatUnitPrice(e.target.value)}
                />
              </div>
            </div>

            {matQty && matUnitPrice && (
              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-500">Line Total: </span>
                <span className="font-semibold">
                  N
                  {(
                    parseFloat(matQty || "0") * parseFloat(matUnitPrice || "0")
                  ).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowAddMaterial(false)}
              disabled={addMaterialMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-teal-500 text-white hover:bg-teal-600"
              onClick={() =>
                addMaterialMutation.mutate({
                  inventoryId: matInventoryId,
                  quantity: matQty,
                  unitPrice: matUnitPrice,
                })
              }
              disabled={
                addMaterialMutation.isPending ||
                !matInventoryId ||
                !matQty ||
                !matUnitPrice
              }
            >
              {addMaterialMutation.isPending ? "Adding..." : "Add Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- small helper components ---------- */

function Section({
  title,
  children,
  cols = 2,
}: {
  title: string;
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  const colClass =
    cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-200 bg-zinc-100 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {title}
        </p>
      </div>
      <div className={`grid ${colClass} gap-4 p-4`}>{children}</div>
    </div>
  );
}

function Field({
  label,
  field,
  type = "text",
  opFields,
  setOpFields,
}: {
  label: string;
  field: string;
  type?: string;
  opFields: Record<string, string>;
  setOpFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder="—"
        value={opFields[field] ?? ""}
        onChange={(e) =>
          setOpFields((prev) => ({ ...prev, [field]: e.target.value }))
        }
        className="h-8 text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  field,
  placeholder,
  options,
  opFields,
  setOpFields,
}: {
  label: string;
  field: string;
  placeholder: string;
  options: ProductionOption[];
  opFields: Record<string, string>;
  setOpFields: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={opFields[field] ?? ""}
        onValueChange={(value) =>
          value != null && setOpFields((prev) => ({ ...prev, [field]: value }))
        }
      >
        <SelectTrigger className="h-8 w-full text-sm">
          <span data-slot="select-value" className="flex flex-1 text-left">
            {opFields[field] ? (
              (options.find((o) => o.value === opFields[field])?.label ??
              opFields[field])
            ) : (
              <span className="text-zinc-400">{placeholder}</span>
            )}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex h-8 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
        {value}
      </div>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return `₦${numericValue.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
