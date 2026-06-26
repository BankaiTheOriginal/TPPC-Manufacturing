"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  MapPin,
  UserCircle,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { roleColors, roleLabels } from "@/lib/user-role-display";

interface User {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  locationId?: string | null;
  location?: LocationOption | null;
  jobTitle?: string | null;
  department?: string | null;
  phoneNumber?: string | null;
  reportingLine?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface LocationOption {
  id: string;
  name: string;
  state: string;
  addressLine: string;
}

const editSchema = z.object({
  staffId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).optional().or(z.literal("")),
  locationId: z.string().nullable().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  phoneNumber: z.string().optional(),
  reportingLine: z.string().optional(),
  role: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.HUMAN_RESOURCES,
  ]);
  const router = useRouter();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["users", id],
    queryFn: async () => {
      const res = await api.get(`/users/${id}`);
      return res.data;
    },
  });

  const { data: locations = [] } = useQuery<LocationOption[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await api.get("/locations");
      return res.data;
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema) as Resolver<EditForm>,
  });

  const openEdit = () => {
    if (user) {
      reset({
        staffId: user.staffId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        locationId: user.locationId ?? null,
        jobTitle: user.jobTitle ?? "",
        department: user.department ?? "",
        phoneNumber: user.phoneNumber ?? "",
        reportingLine: user.reportingLine ?? "",
        role: user.role,
        password: "",
      });
    }
    setShowEdit(true);
  };

  const updateMutation = useMutation({
    mutationFn: (body: EditForm) => {
      const payload: Record<string, unknown> = { ...body };
      if (!payload.password) delete payload.password;
      if (!payload.email) delete payload.email;
      if (payload.locationId === undefined) delete payload.locationId;
      return api.patch(`/users/${id}`, payload);
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users", id] });
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowEdit(false);
    },
    onError: () => toast.error("Failed to update user"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api.patch(`/users/${id}`, { isActive }).then((r) => r.data),
    onSuccess: (_data, isActive) => {
      toast.success(isActive ? "User activated" : "User deactivated");
      qc.invalidateQueries({ queryKey: ["users", id] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Failed to update account status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success("User deleted");
      router.push("/settings/users");
    },
    onError: () => toast.error("Failed to delete user"),
  });

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings/users"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Staff Directory
        </Link>
        <div className="flex items-center gap-2">
          {user && (
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 ${
                user.isActive
                  ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                  : "border-green-200 text-green-700 hover:bg-green-50"
              }`}
              onClick={() => toggleActiveMutation.mutate(!user.isActive)}
              disabled={toggleActiveMutation.isPending}
            >
              {user.isActive ? (
                <UserX className="h-4 w-4" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              {toggleActiveMutation.isPending
                ? "Updating..."
                : user.isActive
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={openEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-500 text-2xl font-bold text-white">
          {user ? (
            `${user.firstName[0]}${user.lastName[0]}`
          ) : (
            <UserCircle className="h-10 w-10" />
          )}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-3">
            {isLoading ? (
              <Skeleton className="h-7 w-40" />
            ) : (
              <h1 className="text-xl font-semibold text-zinc-900">
                {user?.firstName} {user?.lastName}
              </h1>
            )}
            {isLoading ? (
              <Skeleton className="h-5 w-28 rounded-full" />
            ) : user ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[user.role] ?? "bg-zinc-100 text-zinc-600"}`}
              >
                {roleLabels[user.role] ?? user.role}
              </span>
            ) : null}
          </div>
          {!isLoading && user?.jobTitle ? (
            <p className="text-sm text-zinc-500">
              {user.jobTitle}
              {user.department ? ` · ${user.department}` : ""}
            </p>
          ) : null}
          <div className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Mail className="h-3.5 w-3.5" />
            {isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <span>{user?.email}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {isLoading
                ? [
                    "Staff ID",
                    "First Name",
                    "Last Name",
                    "Email",
                    "Job Title",
                    "Department",
                    "Contact",
                    "Reporting Line",
                    "Access Role",
                    "Active",
                    "Last Login",
                    "Created At",
                  ].map((f) => (
                    <div key={f} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-500">{f}</p>
                      <Skeleton className="h-5 w-full" />
                    </div>
                  ))
                : [
                    { label: "Staff ID", value: user?.staffId },
                    { label: "First Name", value: user?.firstName },
                    { label: "Last Name", value: user?.lastName },
                    { label: "Email", value: user?.email },
                    { label: "Job Title", value: user?.jobTitle },
                    { label: "Department", value: user?.department },
                    {
                      label: "Location",
                      value: user?.location
                        ? `${user.location.name} (${user.location.state})`
                        : "—",
                    },
                    { label: "Contact", value: user?.phoneNumber },
                    { label: "Reporting Line", value: user?.reportingLine },
                    {
                      label: "Access Role",
                      value: roleLabels[user?.role ?? ""] ?? user?.role,
                    },
                    { label: "Active", value: user?.isActive ? "Yes" : "No" },
                    {
                      label: "Last Login",
                      value: user?.lastLogin
                        ? new Date(user.lastLogin).toLocaleString()
                        : "Never",
                    },
                    {
                      label: "Created At",
                      value: user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-500">
                        {label}
                      </p>
                      <p className="text-sm text-zinc-800">{value ?? "—"}</p>
                    </div>
                  ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-zinc-400" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {isLoading
                ? [
                    "Address Line 1",
                    "Address Line 2",
                    "City",
                    "State",
                    "Postal Code",
                    "Country",
                  ].map((f) => (
                    <div key={f} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-500">{f}</p>
                      <Skeleton className="h-5 w-full" />
                    </div>
                  ))
                : [
                    { label: "Address Line 1", value: user?.addressLine1 },
                    { label: "Address Line 2", value: user?.addressLine2 },
                    { label: "City", value: user?.city },
                    { label: "State", value: user?.state },
                    { label: "Postal Code", value: user?.postalCode },
                    { label: "Country", value: user?.country },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-500">
                        {label}
                      </p>
                      <p className="text-sm text-zinc-800">{value ?? "—"}</p>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                <p className="text-sm text-zinc-600">Account Status</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-16 rounded-full" />
                ) : (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user?.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                  >
                    {user?.isActive ? "Active" : "Inactive"}
                  </span>
                )}
              </div>
              {!isLoading && user && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full gap-2 ${
                    user.isActive
                      ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                      : "border-green-200 text-green-700 hover:bg-green-50"
                  }`}
                  onClick={() => toggleActiveMutation.mutate(!user.isActive)}
                  disabled={toggleActiveMutation.isPending}
                >
                  {user.isActive ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {toggleActiveMutation.isPending
                    ? "Updating..."
                    : user.isActive
                      ? "Deactivate User"
                      : "Activate User"}
                </Button>
              )}
              <div>
                <p className="text-xs text-zinc-500">Last Login</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-4 w-36" />
                ) : (
                  <p className="mt-1 text-sm text-zinc-800">
                    {user?.lastLogin
                      ? new Date(user.lastLogin).toLocaleString()
                      : "Never"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-zinc-500">Member Since</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-4 w-28" />
                ) : (
                  <p className="mt-1 text-sm text-zinc-800">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "—"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={showEdit}
        onOpenChange={(open) => {
          setShowEdit(open);
          if (!open) reset();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))}>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input {...register("firstName")} />
                {errors.firstName && (
                  <p className="text-xs text-red-500">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-xs text-red-500">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Staff ID</Label>
                <Input {...register("staffId")} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input {...register("jobTitle")} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input {...register("department")} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Controller
                  name="locationId"
                  control={control}
                  render={({ field }) => {
                    const selectedLocation = locations.find(
                      (location) => location.id === field.value,
                    );

                    return (
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === "__none__" ? null : value)
                        }
                        value={field.value ?? "__none__"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select location">
                            {selectedLocation ? (
                              `${selectedLocation.name} (${selectedLocation.state})`
                            ) : (
                              <span className="text-zinc-400">No location</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No location</SelectItem>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name} ({location.state})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input {...register("phoneNumber")} />
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Line</Label>
                <Input {...register("reportingLine")} />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Access Role</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowEdit(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-teal-500 hover:bg-teal-600"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {user?.firstName} {user?.lastName}
            </span>
            ? This cannot be undone.
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
