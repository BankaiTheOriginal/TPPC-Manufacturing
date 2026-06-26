"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import api from "@/lib/api";

interface Vendor {
  id: string;
  name: string;
  operationStage: string;
}

const vendorSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required"),
  operationStage: z.string().min(1, "Operation is required"),
});

type VendorForm = z.infer<typeof vendorSchema>;

const operationStageOptions = STAGE_ORDER.map((stage) => ({
  value: stage,
  label: STAGE_LABELS[stage] ?? stage,
}));

function getErrorMessage(error: unknown, fallback: string) {
  const message =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response
      ?.data?.message === "string"
      ? (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message
      : null;

  return message || fallback;
}

export default function VendorsPage() {
  useRequireRole([ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS]);

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [showDelete, setShowDelete] = useState<Vendor | null>(null);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: () => api.get("/vendors").then((r) => r.data),
  });

  const filtered = vendors.filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return (
      item.name.toLowerCase().includes(query) ||
      (STAGE_LABELS[item.operationStage] ?? item.operationStage)
        .toLowerCase()
        .includes(query)
    );
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<VendorForm>({
    resolver: zodResolver(vendorSchema) as Resolver<VendorForm>,
  });

  function openCreate() {
    reset({ name: "", operationStage: "" });
    setShowCreate(true);
  }

  function openEdit(vendor: Vendor) {
    reset({ name: vendor.name, operationStage: vendor.operationStage });
    setEditing(vendor);
  }

  const createMutation = useMutation({
    mutationFn: (body: VendorForm) => api.post("/vendors", body),
    onSuccess: () => {
      toast.success("Vendor created");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setShowCreate(false);
      reset();
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Failed to create vendor")),
  });

  const updateMutation = useMutation({
    mutationFn: (body: VendorForm) => api.patch(`/vendors/${editing!.id}`, body),
    onSuccess: () => {
      toast.success("Vendor updated");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setEditing(null);
      reset();
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Failed to update vendor")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/${id}`),
    onSuccess: () => {
      toast.success("Vendor deleted");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setShowDelete(null);
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Failed to delete vendor")),
  });

  function onSubmit(values: VendorForm) {
    if (editing) {
      updateMutation.mutate(values);
      return;
    }

    createMutation.mutate(values);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-2 bg-teal-500 text-white hover:bg-teal-600"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Operation
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-3">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-6 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-6 py-3" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-10 text-center text-zinc-400"
                  >
                    <ShoppingCart className="mx-auto mb-2 h-6 w-6 text-zinc-300" />
                    No vendors found
                  </td>
                </tr>
              ) : (
                filtered.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-zinc-50/60">
                    <td className="px-6 py-3 font-medium text-zinc-800">
                      {vendor.name}
                    </td>
                    <td className="px-6 py-3 text-zinc-500">
                      {STAGE_LABELS[vendor.operationStage] ??
                        vendor.operationStage}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                          onClick={() => openEdit(vendor)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          onClick={() => setShowDelete(vendor)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog
        open={showCreate || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditing(null);
            reset();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-name">Vendor Name</Label>
              <Input id="vendor-name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Operation</Label>
              <Controller
                control={control}
                name="operationStage"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operation">
                        {field.value ? (
                          STAGE_LABELS[field.value] ?? field.value
                        ) : (
                          <span className="text-zinc-400">Select operation</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {operationStageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.operationStage && (
                <p className="text-xs text-red-500">
                  {errors.operationStage.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-teal-500 text-white hover:bg-teal-600"
                disabled={isPending}
              >
                {isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete !== null} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">
            Remove {showDelete?.name ?? "this vendor"} from the vendor list?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => showDelete && deleteMutation.mutate(showDelete.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}