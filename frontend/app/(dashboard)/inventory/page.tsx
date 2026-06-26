"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState, useEffect, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import api from "@/lib/api";

interface InventoryItem {
  id: string;
  sku: string;
  itemName: string;
  itemType: string;
  category: string;
  quantityInStock: number;
  averagePrice: string;
  price: string;
  receivedDate: string;
  lastRestockDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const itemSchema = z.object({
  sku: z.string().min(1, "Required"),
  itemName: z.string().min(1, "Required"),
  itemType: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  quantityInStock: z.coerce.number().min(0, "Must be >= 0"),
  averagePrice: z.coerce.number().min(0, "Must be >= 0").optional(),
  price: z.coerce.number().min(0, "Must be >= 0").optional(),
  receivedDate: z.string().min(1, "Required"),
  lastRestockDate: z.string().optional(),
});

type ItemForm = z.infer<typeof itemSchema>;

const RAW_MATERIAL_TYPES = [
  "Paper / Board",
  "Ink / Coating",
  "Lamination Film",
  "Dye / Pigment",
  "Chemical",
  "Adhesive / Glue",
  "Packaging Material",
  "Metal / Wire",
  "Consumable",
  "Other",
];

const LIMIT = 20;

export default function InventoryPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.SUPERVISOR,
  ]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const trimmedSearch = search.trim();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(trimmedSearch), 300);
    return () => clearTimeout(t);
  }, [trimmedSearch]);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data, isLoading } = useQuery<{
    items: InventoryItem[];
    page: number;
    perPage: number;
  }>({
    queryKey: ["inventory", page, debouncedSearch],
    queryFn: () =>
      api
        .get("/inventory", {
          params: debouncedSearch
            ? { q: debouncedSearch, page, limit: LIMIT }
            : { page, limit: LIMIT },
        })
        .then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema) as Resolver<ItemForm>,
  });

  function openCreate() {
    reset({
      sku: "",
      itemName: "",
      itemType: "",
      category: "",
      quantityInStock: 0,
      averagePrice: 0,
      price: 0,
      receivedDate: "",
      lastRestockDate: "",
    });
    setShowCreate(true);
  }

  function openEdit(item: InventoryItem) {
    reset({
      sku: item.sku,
      itemName: item.itemName,
      itemType: item.itemType,
      category: item.category,
      quantityInStock: item.quantityInStock,
      averagePrice: parseFloat(item.averagePrice),
      price: parseFloat(item.price),
      receivedDate: item.receivedDate ? item.receivedDate.slice(0, 10) : "",
      lastRestockDate: item.lastRestockDate
        ? item.lastRestockDate.slice(0, 10)
        : "",
    });
    setEditItem(item);
  }

  const createMutation = useMutation({
    mutationFn: (body: ItemForm) =>
      api.post("/inventory", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item created");
      setShowCreate(false);
    },
    onError: () => toast.error("Failed to create item"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ItemForm }) =>
      api.patch(`/inventory/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item updated");
      setEditItem(null);
    },
    onError: () => toast.error("Failed to update item"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item deleted");
      setDeleteItem(null);
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/inventory/bulk-delete", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Items deleted");
      setSelected(new Set());
      setShowBulkDelete(false);
    },
    onError: () => toast.error("Failed to delete items"),
  });

  function onSubmit(values: ItemForm) {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, body: values });
    } else {
      createMutation.mutate(values);
    }
  }

  const rawItems = (data?.items ?? []) as unknown[];

  const items: InventoryItem[] = rawItems.map((it) => {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;

      // If backend returned a local inventory record, use as-is
      if ("id" in o && typeof o["id"] === "string" && "itemName" in o) {
        return o as unknown as InventoryItem;
      }

      const stock =
        (typeof o["stockOnHand"] === "number" &&
          (o["stockOnHand"] as number)) ||
        (typeof o["stock_on_hand"] === "number" &&
          (o["stock_on_hand"] as number)) ||
        0;

      const rate =
        (typeof o["rate"] === "number" && (o["rate"] as number)) ||
        (typeof o["sales_rate"] === "number" && (o["sales_rate"] as number)) ||
        (typeof o["price"] === "number" && (o["price"] as number)) ||
        0;

      const purchase =
        (typeof o["purchaseRate"] === "number" &&
          (o["purchaseRate"] as number)) ||
        (typeof o["purchase_rate"] === "number" &&
          (o["purchase_rate"] as number)) ||
        (typeof o["averagePrice"] === "number" &&
          (o["averagePrice"] as number)) ||
        0;

      return {
        id: String(
          o["itemId"] ??
            o["item_id"] ??
            o["id"] ??
            `zoho-${String(o["sku"] ?? "")}`,
        ),
        sku: String(o["sku"] ?? ""),
        itemName: String(o["itemName"] ?? o["name"] ?? ""),
        itemType: String(o["itemType"] ?? o["item_type"] ?? ""),
        category: String(o["category"] ?? ""),
        quantityInStock: Math.round(Number(stock ?? 0)),
        averagePrice: String(purchase ?? 0),
        price: String(rate ?? 0),
        receivedDate: String(o["receivedDate"] ?? ""),
        lastRestockDate: (o["lastRestockDate"] as string) ?? null,
        createdAt: String(o["createdAt"] ?? o["created_time"] ?? ""),
        updatedAt: String(o["updatedAt"] ?? o["last_modified_time"] ?? ""),
      };
    }

    return {
      id: "",
      sku: "",
      itemName: "",
      itemType: "",
      category: "",
      quantityInStock: 0,
      averagePrice: "0",
      price: "0",
      receivedDate: "",
      lastRestockDate: null,
      createdAt: "",
      updatedAt: "",
    };
  });

  const filtered = items;
  const hasMore = (items.length ?? 0) === LIMIT;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.post("/zoho/items/sync-local");
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Inventory refreshed");
    } catch {
      toast.error("Failed to refresh inventory");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search inventory..."
            value={search}
            onChange={(ev: ChangeEvent<HTMLInputElement>) => {
              setSearch(ev.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              className="shrink-0 gap-2 bg-red-600 text-white hover:bg-red-700"
              onClick={() => setShowBulkDelete(true)}
            >
              Delete Selected ({selected.size})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={handleSync}
            disabled={isLoading || isSyncing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing ? "Updating..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            className="shrink-0 gap-2 bg-teal-500 text-white hover:bg-teal-600"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-3">
                    <input
                      role="checkbox"
                      type="checkbox"
                      className="h-4 w-4"
                      onChange={(ev: ChangeEvent<HTMLInputElement>) => {
                        if (ev.target.checked)
                          setSelected(new Set(items.map((i) => i.id)));
                        else setSelected(new Set());
                      }}
                      checked={
                        items.length > 0 && selected.size === items.length
                      }
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Item Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Qty in Stock
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                            <Package className="h-4 w-4 text-zinc-400" />
                          </div>
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Skeleton className="ml-auto h-4 w-12" />
                      </td>
                      <td className="px-6 py-3" />
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-zinc-400"
                    >
                      No items found
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-zinc-50/60"
                    >
                      <td className="px-4 py-3">
                        <input
                          role="checkbox"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selected.has(item.id)}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-zinc-500">
                        {item.sku}
                      </td>
                      <td className="px-6 py-3 font-medium text-zinc-900">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                            <Package className="h-4 w-4 text-zinc-400" />
                          </div>
                          {item.itemName}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-zinc-500">
                        {item.itemType}
                      </td>
                      <td className="px-6 py-3 text-zinc-500">
                        {item.category}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {item.quantityInStock.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteItem(item)}
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3">
            <p className="text-sm text-zinc-500">Page {page}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showCreate || editItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditItem(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editItem ? "Edit Raw Material" : "Add Raw Material"}
            </DialogTitle>
            <p className="text-xs text-zinc-400">
              Inventory is used exclusively for raw materials consumed in
              production.
            </p>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input placeholder="e.g. PAP-001" {...register("sku")} />
                {errors.sku && (
                  <p className="text-xs text-red-500">{errors.sku.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Item Name</Label>
                <Input
                  placeholder="e.g. A4 Paper Sheets"
                  {...register("itemName")}
                />
                {errors.itemName && (
                  <p className="text-xs text-red-500">
                    {errors.itemName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Material Type <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="itemType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => v != null && field.onChange(v)}
                    >
                      <SelectTrigger className="w-full">
                        <span
                          data-slot="select-value"
                          className="flex flex-1 text-left"
                        >
                          {field.value ? (
                            field.value
                          ) : (
                            <span className="text-muted-foreground">
                              Select type
                            </span>
                          )}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {RAW_MATERIAL_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.itemType && (
                  <p className="text-xs text-red-500">
                    {errors.itemType.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input placeholder="e.g. Paper" {...register("category")} />
                {errors.category && (
                  <p className="text-xs text-red-500">
                    {errors.category.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Qty in Stock</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...register("quantityInStock")}
                />
                {errors.quantityInStock && (
                  <p className="text-xs text-red-500">
                    {errors.quantityInStock.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Average Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("averagePrice")}
                />
                {errors.averagePrice && (
                  <p className="text-xs text-red-500">
                    {errors.averagePrice.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("price")}
                />
                {errors.price && (
                  <p className="text-xs text-red-500">{errors.price.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Received Date</Label>
                <Input type="date" {...register("receivedDate")} />
                {errors.receivedDate && (
                  <p className="text-xs text-red-500">
                    {errors.receivedDate.message}
                  </p>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>
                  Last Restock Date{" "}
                  <span className="text-zinc-400">(optional)</span>
                </Label>
                <Input type="date" {...register("lastRestockDate")} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setEditItem(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-500 text-white hover:bg-teal-600"
              >
                {isSubmitting
                  ? "Saving..."
                  : editItem
                    ? "Update Item"
                    : "Save Raw Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Bulk delete confirmation */}
      <Dialog
        open={showBulkDelete}
        onOpenChange={(open) => setShowBulkDelete(open)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected items</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-zinc-600">
              Are you sure you want to delete {selected.size} inventory item(s)?
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Item
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteItem?.itemName}</span>? This
            action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
