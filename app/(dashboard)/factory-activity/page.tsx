"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Users,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import { useRequireRole, ROLES } from "@/lib/rbac";

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
interface ProductionOrderOption {
  id: string;
  sku: string;
  productName: string;
}
interface FactoryActivity {
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
interface ActivitiesResponse {
  items: FactoryActivity[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const FINISHING_TYPES = [
  "Folding",
  "Pasting / Gluing",
  "Handle Attachment",
  "Packing",
  "QC / Inspection",
  "Stitching",
  "Lamination Finishing",
  "Other",
];

const emptyForm = {
  productOrderId: "",
  locationId: "",
  workDate: "",
  supervisorId: "",
  workerNamesRaw: "", // comma-separated input
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

export default function FactoryActivityPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.SUPERVISOR,
  ]);

  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterLocation, setFilterLocation] = useState("");
  const [filterSupervisor, setFilterSupervisor] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productionOrderSearch, setProductionOrderSearch] = useState("");

  const { data: locations = [] } = useQuery<FactoryLocation[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery<UserOption[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users?limit=200").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: productionOrders = [] } = useQuery<ProductionOrderOption[]>({
    queryKey: ["production-orders-options"],
    queryFn: () =>
      api
        .get("/production-orders", {
          params: { page: 1, limit: 200 },
        })
        .then(
          (r) =>
            (r.data?.items ?? []) as ProductionOrderOption[],
        ),
    staleTime: 5 * 60 * 1000,
  });

  const supervisors = allUsers.filter((u) =>
    [
      "SUPERVISOR",
      "HEAD_OF_OPERATIONS",
      "PRODUCTION_MANAGER",
      "ADMINISTRATOR",
      "GENERAL_MANAGER",
    ].includes(u.role),
  );

  const filteredProductionOrders = productionOrders.filter((order) => {
    const query = productionOrderSearch.trim().toLowerCase();
    if (!query) return true;

    return (
      order.sku.toLowerCase().includes(query) ||
      order.productName.toLowerCase().includes(query)
    );
  });

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["factory-activity", page, filterLocation, filterSupervisor],
    queryFn: () =>
      api
        .get("/factory-activity", {
          params: {
            page,
            limit: 15,
            ...(filterLocation ? { locationId: filterLocation } : {}),
            ...(filterSupervisor ? { supervisorId: filterSupervisor } : {}),
          },
        })
        .then((r) => r.data),
  });

  const activities = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      api.post("/factory-activity", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["factory-activity"] });
      toast.success("Activity recorded");
      closeForm();
    },
    onError: () => toast.error("Failed to save activity"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.patch(`/factory-activity/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["factory-activity"] });
      toast.success("Activity updated");
      closeForm();
    },
    onError: () => toast.error("Failed to update activity"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/factory-activity/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["factory-activity"] });
      toast.success("Activity deleted");
      setShowDeleteId(null);
    },
    onError: () => toast.error("Failed to delete activity"),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, workDate: toInputDate(new Date()) });
    setProductionOrderSearch("");
    setShowForm(true);
  }

  function openEdit(activity: FactoryActivity) {
    setEditingId(activity.id);
    setForm({
      productOrderId: activity.productOrderId ?? "",
      locationId: activity.locationId,
      workDate: toInputDate(activity.workDate),
      supervisorId: activity.supervisorId,
      workerNamesRaw: activity.workerNames.join(", "),
      quantityAllocated: String(activity.quantityAllocated),
      quantityFinished: String(activity.quantityFinished),
      quantityWasted: String(activity.quantityWasted),
      typeOfFinishing: activity.typeOfFinishing ?? "",
      costPerFinish: activity.costPerFinish ?? "",
      notes: activity.notes ?? "",
    });
    setProductionOrderSearch("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setProductionOrderSearch("");
  }

  function handleSubmit() {
    if (!form.productOrderId) {
      toast.error("Select a production order");
      return;
    }
    if (!form.locationId) {
      toast.error("Select a factory location");
      return;
    }
    if (!form.workDate) {
      toast.error("Select the work date");
      return;
    }
    if (!form.supervisorId) {
      toast.error("Select a supervisor");
      return;
    }
    if (!form.quantityAllocated) {
      toast.error("Enter quantity allocated");
      return;
    }

    const workerNames = form.workerNamesRaw
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);

    const body = {
      productOrderId: form.productOrderId,
      locationId: form.locationId,
      workDate: form.workDate,
      supervisorId: form.supervisorId,
      workerNames,
      quantityAllocated: Number(form.quantityAllocated),
      quantityFinished: form.quantityFinished
        ? Number(form.quantityFinished)
        : 0,
      quantityWasted: form.quantityWasted ? Number(form.quantityWasted) : 0,
      typeOfFinishing: form.typeOfFinishing || undefined,
      costPerFinish: form.costPerFinish || undefined,
      notes: form.notes || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Factory Worker Activity
          </h1>
          <p className="text-sm text-zinc-500">
            Track finishing activities, worker output, and wastage by location.
          </p>
        </div>
        <Button
          className="gap-2 bg-teal-500 text-white hover:bg-teal-600"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Record Activity
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <Select
            value={filterLocation}
            onValueChange={(v) => {
              setFilterLocation(v ?? "");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <Select
            value={filterSupervisor}
            onValueChange={(v) => {
              setFilterSupervisor(v ?? "");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by supervisor" />
            </SelectTrigger>
            <SelectContent>
              {supervisors.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterLocation || filterSupervisor) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-600"
            onClick={() => {
              setFilterLocation("");
              setFilterSupervisor("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table / Cards */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm">No activities recorded yet.</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                Record First Activity
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Location
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Production
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Supervisor
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Workers
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Allocated
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Finished
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Wasted
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Efficiency
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Total (N)
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {activities.map((a) => {
                  const efficiency =
                    a.quantityAllocated > 0
                      ? Math.round(
                          (a.quantityFinished / a.quantityAllocated) * 100,
                        )
                      : null;
                  const isExpanded = expandedId === a.id;
                  return (
                    <>
                      <tr
                        key={a.id}
                        className="cursor-pointer hover:bg-zinc-50/60"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(a.workDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {a.location.name}
                          <span className="ml-1 text-xs text-zinc-400">
                            ({a.location.state})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {a.productOrder ? (
                            <div>
                              <div className="font-medium text-zinc-800">
                                {a.productOrder.sku}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {a.productOrder.productName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.supervisor.firstName} {a.supervisor.lastName}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            <Users className="h-3 w-3" />
                            {a.workerNames.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {a.typeOfFinishing ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {a.quantityAllocated.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-green-700">
                          {a.quantityFinished.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600">
                          {a.quantityWasted.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {efficiency !== null ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                efficiency >= 95
                                  ? "bg-green-100 text-green-700"
                                  : efficiency >= 85
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-600"
                              }`}
                            >
                              {efficiency}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-800">
                          {a.totalAmount > 0
                            ? a.totalAmount.toLocaleString("en-NG", {
                                minimumFractionDigits: 2,
                              })
                            : "—"}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => openEdit(a)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-500 hover:bg-red-50"
                              onClick={() => setShowDeleteId(a.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-zinc-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-zinc-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${a.id}-expand`} className="bg-zinc-50/60">
                          <td colSpan={12} className="px-6 py-3">
                            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                              <div>
                                <p className="text-xs text-zinc-500">
                                  Logged At
                                </p>
                                <p className="mt-0.5 text-zinc-800">
                                  {new Date(a.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-zinc-500">Workers</p>
                                <p className="mt-0.5 text-zinc-800">
                                  {a.workerNames.length > 0
                                    ? a.workerNames.join(", ")
                                    : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-zinc-500">
                                  Cost per Finish
                                </p>
                                <p className="mt-0.5 text-zinc-800">
                                  {a.costPerFinish
                                    ? `₦${Number(a.costPerFinish).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                                    : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-zinc-500">
                                  Total Earnings
                                </p>
                                <p className="mt-0.5 font-medium text-zinc-800">
                                  {a.totalAmount > 0
                                    ? `₦${a.totalAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                                    : "—"}
                                </p>
                              </div>
                              {a.notes && (
                                <div className="col-span-2 sm:col-span-4">
                                  <p className="text-xs text-zinc-500">Notes</p>
                                  <p className="mt-0.5 text-zinc-700">
                                    {a.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)} of{" "}
            {data.total} activities
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-500" />
              {editingId ? "Edit Activity" : "Record Factory Activity"}
            </DialogTitle>
            <DialogDescription>
              Track worker output, wastage, and finishing type for this session.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>
                Production Order <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Search production orders..."
                value={productionOrderSearch}
                onChange={(e) => setProductionOrderSearch(e.target.value)}
              />
              <Select
                value={form.productOrderId}
                onValueChange={(v) => {
                  setField("productOrderId", v ?? "");
                  setProductionOrderSearch("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select production order">
                    {form.productOrderId ? (
                      (() => {
                        const order = productionOrders.find(
                          (item) => item.id === form.productOrderId,
                        );
                        return order
                          ? `${order.sku} — ${order.productName}`
                          : form.productOrderId;
                      })()
                    ) : (
                      <span className="text-zinc-400">
                        Select production order
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredProductionOrders.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-zinc-400">
                      {productionOrderSearch.trim()
                        ? "No matching orders found"
                        : "No production orders available"}
                    </div>
                  ) : (
                    filteredProductionOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.sku} — {order.productName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Work Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.workDate}
                onChange={(e) => setField("workDate", e.target.value)}
              />
            </div>

            {/* Factory Location */}
            <div className="space-y-1.5">
              <Label>
                Factory Location <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.locationId}
                onValueChange={(v) => setField("locationId", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location">
                    {form.locationId ? (
                      (() => {
                        const location = locations.find(
                          (item) => item.id === form.locationId,
                        );
                        return location
                          ? `${location.name} (${location.state})`
                          : form.locationId;
                      })()
                    ) : (
                      <span className="text-zinc-400">Select location</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.state})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supervisor */}
            <div className="col-span-2 space-y-1.5">
              <Label>
                Supervisor <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.supervisorId}
                onValueChange={(v) => setField("supervisorId", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor">
                    {form.supervisorId ? (
                      (() => {
                        const s = supervisors.find(
                          (u) => u.id === form.supervisorId,
                        );
                        return s
                          ? `${s.firstName} ${s.lastName} (${s.staffId})`
                          : form.supervisorId;
                      })()
                    ) : (
                      <span className="text-zinc-400">Select supervisor</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.staffId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Worker Names */}
            <div className="col-span-2 space-y-1.5">
              <Label>Names of Workers</Label>
              <Input
                placeholder="e.g. Chidi, Amaka, Emeka (comma-separated)"
                value={form.workerNamesRaw}
                onChange={(e) => setField("workerNamesRaw", e.target.value)}
              />
              <p className="text-xs text-zinc-400">
                Separate names with commas
              </p>
            </div>

            {/* Type of Finishing */}
            <div className="col-span-2 space-y-1.5">
              <Label>Type of Finishing</Label>
              <Select
                value={form.typeOfFinishing}
                onValueChange={(v) => setField("typeOfFinishing", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select finishing type" />
                </SelectTrigger>
                <SelectContent>
                  {FINISHING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Allocated */}
            <div className="space-y-1.5">
              <Label>
                Quantity Allocated <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.quantityAllocated}
                onChange={(e) => setField("quantityAllocated", e.target.value)}
              />
            </div>

            {/* Quantity Finished */}
            <div className="space-y-1.5">
              <Label>Quantity Finished</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.quantityFinished}
                onChange={(e) => setField("quantityFinished", e.target.value)}
              />
            </div>

            {/* Quantity Wasted */}
            <div className="space-y-1.5">
              <Label>Quantity Wasted</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.quantityWasted}
                onChange={(e) => setField("quantityWasted", e.target.value)}
              />
            </div>

            {/* Cost Per Finish */}
            <div className="space-y-1.5">
              <Label>Cost per Finish (₦)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.costPerFinish}
                onChange={(e) => setField("costPerFinish", e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeForm} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              className="bg-teal-500 text-white hover:bg-teal-600"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : editingId ? "Update" : "Save Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!showDeleteId}
        onOpenChange={(o) => !o && setShowDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Activity
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete this activity record? This cannot be
            undone.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                showDeleteId && deleteMutation.mutate(showDeleteId)
              }
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
