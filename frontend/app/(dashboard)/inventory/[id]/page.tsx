"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  averagePrice: z.coerce.number().min(0, "Must be >= 0"),
  price: z.coerce.number().min(0, "Must be >= 0"),
  receivedDate: z.string().min(1, "Required"),
  lastRestockDate: z.string().optional(),
});

type ItemForm = z.infer<typeof itemSchema>;

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function InventoryDetailPage({
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
  ]);
  const router = useRouter();
  const qc = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: item, isLoading } = useQuery<InventoryItem>({
    queryKey: ["inventory", id],
    queryFn: () => api.get(`/inventory/${id}`).then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema) as Resolver<ItemForm>,
  });

  function openEdit() {
    if (!item) return;
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
    setShowEdit(true);
  }

  const updateMutation = useMutation({
    mutationFn: (body: ItemForm) =>
      api.patch(`/inventory/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", id] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item updated");
      setShowEdit(false);
    },
    onError: () => toast.error("Failed to update item"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item deleted");
      router.replace("/inventory");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/inventory"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={openEdit}
            disabled={isLoading}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
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

      {/* Item Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <Package className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          {isLoading ? (
            <>
              <Skeleton className="mb-1 h-7 w-48" />
              <Skeleton className="h-4 w-24" />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-zinc-900">
                {item?.itemName}
              </h1>
              <p className="font-mono text-sm text-zinc-500">{item?.sku}</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {isLoading ? (
                [
                  "SKU",
                  "Item Name",
                  "Item Type",
                  "Category",
                  "Received Date",
                  "Last Restock Date",
                ].map((f) => (
                  <div key={f} className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">{f}</Label>
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">SKU</Label>
                    <p className="font-mono text-sm">{item?.sku}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Item Name</Label>
                    <p className="text-sm">{item?.itemName}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Item Type</Label>
                    <p className="text-sm">{item?.itemType}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Category</Label>
                    <p className="text-sm">{item?.category}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">
                      Received Date
                    </Label>
                    <p className="text-sm">
                      {item?.receivedDate ? fmt(item.receivedDate) : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">
                      Last Restock Date
                    </Label>
                    <p className="text-sm">
                      {item?.lastRestockDate ? fmt(item.lastRestockDate) : "—"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock & Pricing */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">Quantity in Stock</p>
              {isLoading ? (
                <Skeleton className="mt-1 h-9 w-24" />
              ) : (
                <p className="mt-1 text-3xl font-bold text-zinc-900 tabular-nums">
                  {item?.quantityInStock.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing (₦)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500">Average Price</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-28" />
                ) : (
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {item
                      ? parseFloat(item.averagePrice).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                        })
                      : "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-500">Unit Price</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-28" />
                ) : (
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {item
                      ? parseFloat(item.price).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                        })
                      : "—"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))}>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input {...register("sku")} />
                {errors.sku && (
                  <p className="text-xs text-red-500">{errors.sku.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Item Name</Label>
                <Input {...register("itemName")} />
                {errors.itemName && (
                  <p className="text-xs text-red-500">
                    {errors.itemName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Item Type</Label>
                <Input {...register("itemType")} />
                {errors.itemType && (
                  <p className="text-xs text-red-500">
                    {errors.itemType.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input {...register("category")} />
                {errors.category && (
                  <p className="text-xs text-red-500">
                    {errors.category.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Qty in Stock</Label>
                <Input type="number" {...register("quantityInStock")} />
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
                <Input type="number" step="0.01" {...register("price")} />
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
                onClick={() => setShowEdit(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-500 text-white hover:bg-teal-600"
              >
                {isSubmitting ? "Saving..." : "Update Item"}
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
              Delete Item
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{item?.itemName}</span>? This action
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
    </div>
  );
}
