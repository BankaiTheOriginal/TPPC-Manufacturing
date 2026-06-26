"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import api from "@/lib/api";

const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "AkwaIbom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "CrossRiver",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

interface Location {
  id: string;
  name: string;
  addressLine: string;
  state: string;
  country: string;
}

const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  addressLine: z.string().min(1, "Address is required"),
  state: z.string().min(1, "State is required"),
});
type LocationForm = z.infer<typeof locationSchema>;

export default function LocationsPage() {
  useRequireRole([ROLES.ADMINISTRATOR, ROLES.HEAD_OF_OPERATIONS]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [showDelete, setShowDelete] = useState<Location | null>(null);

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const filtered = locations.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.state.toLowerCase().includes(search.toLowerCase()) ||
      l.addressLine.toLowerCase().includes(search.toLowerCase()),
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<LocationForm>({
    resolver: zodResolver(locationSchema) as Resolver<LocationForm>,
  });

  function openCreate() {
    reset({ name: "", addressLine: "", state: "" });
    setShowCreate(true);
  }

  function openEdit(loc: Location) {
    reset({ name: loc.name, addressLine: loc.addressLine, state: loc.state });
    setEditing(loc);
  }

  const createMutation = useMutation({
    mutationFn: (body: LocationForm) => api.post("/locations", body),
    onSuccess: () => {
      toast.success("Location created");
      qc.invalidateQueries({ queryKey: ["locations"] });
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Failed to create location"),
  });

  const updateMutation = useMutation({
    mutationFn: (body: LocationForm) =>
      api.patch(`/locations/${editing!.id}`, body),
    onSuccess: () => {
      toast.success("Location updated");
      qc.invalidateQueries({ queryKey: ["locations"] });
      setEditing(null);
      reset();
    },
    onError: () => toast.error("Failed to update location"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/locations/${id}`),
    onSuccess: () => {
      toast.success("Location deleted");
      qc.invalidateQueries({ queryKey: ["locations"] });
      setShowDelete(null);
    },
    onError: () => toast.error("Failed to delete location"),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search locations..."
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
          Add Location
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  State
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Country
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="px-6 py-3">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="px-6 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-6 py-3" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-zinc-400"
                  >
                    <MapPin className="mx-auto mb-2 h-6 w-6 text-zinc-300" />
                    No locations found
                  </td>
                </tr>
              ) : (
                filtered.map((loc) => (
                  <tr key={loc.id} className="hover:bg-zinc-50/60">
                    <td className="px-6 py-3 font-medium text-zinc-800">
                      {loc.name}
                    </td>
                    <td className="px-6 py-3 text-zinc-500">
                      {loc.addressLine}
                    </td>
                    <td className="px-6 py-3 text-zinc-500">{loc.state}</td>
                    <td className="px-6 py-3 text-zinc-500">{loc.country}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                          onClick={() => openEdit(loc)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          onClick={() => setShowDelete(loc)}
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

      {/* Create / Edit Dialog */}
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
            <DialogTitle>
              {editing ? "Edit Location" : "Add Location"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) =>
              editing
                ? updateMutation.mutate(data)
                : createMutation.mutate(data),
            )}
          >
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Location Name</Label>
                <Input
                  placeholder="e.g. Lagos Warehouse"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input
                  placeholder="e.g. 12 Industrial Road"
                  {...register("addressLine")}
                />
                {errors.addressLine && (
                  <p className="text-xs text-red-500">
                    {errors.addressLine.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIGERIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.state && (
                  <p className="text-xs text-red-500">{errors.state.message}</p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                  reset();
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-teal-500 text-white hover:bg-teal-600"
              >
                {isPending ? "Saving..." : editing ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog
        open={showDelete !== null}
        onOpenChange={(open) => !open && setShowDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{showDelete?.name}</span>? This
            cannot be undone.
          </p>
          <DialogFooter className="mt-4">
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
