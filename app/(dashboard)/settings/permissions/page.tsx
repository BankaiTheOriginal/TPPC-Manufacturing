"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { ROLES, useRequireRole } from "@/lib/rbac";
import { roleColors } from "@/lib/user-role-display";

interface PermissionModule {
  key: string;
  label: string;
  path: string;
  actions: string[];
  category: string;
}

interface RolePermission {
  role: string;
  label: string;
  description: string;
  permissions: PermissionModule[];
}

interface UserPermissionSummary {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  jobTitle?: string | null;
  department?: string | null;
  permissions: PermissionModule[];
}

export default function PermissionsPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.HUMAN_RESOURCES,
  ]);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading: isLoadingRoles, isError: isRolesError } = useQuery<RolePermission[]>({
    queryKey: ["permissions", "roles"],
    queryFn: () => api.get("/permissions/roles").then((response) => response.data),
  });

  const { data: users = [], isLoading: isLoadingUsers, isError: isUsersError } = useQuery<UserPermissionSummary[]>({
    queryKey: ["permissions", "users"],
    queryFn: () => api.get("/permissions/users").then((response) => response.data),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/users/${userId}`, { role }).then((response) => response.data),
    onSuccess: () => {
      toast.success("User role updated");
      queryClient.invalidateQueries({ queryKey: ["permissions", "users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Failed to update user role"),
  });

  if (isRolesError || isUsersError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load permissions data. You may not have access to this page, or the server encountered an error. Contact an administrator if the problem persists.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review module rights by access role and see which staff members are assigned to each role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-teal-500 text-white hover:bg-teal-600"
            onClick={() => router.push("/settings/users")}
          >
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => toast.info("Role setup is synced from the application role catalog.")}
          >
            <Plus className="h-4 w-4" />
            Add Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {isLoadingRoles
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          : roles.map((role) => {
              const assignedUsers = users.filter((user) => user.role === role.role).length;

              return (
                <Card key={role.role} className="border-zinc-200">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base text-zinc-900">
                        <ShieldCheck className="h-4 w-4 text-zinc-400" />
                        {role.label}
                      </CardTitle>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[role.role] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {assignedUsers} staff
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-zinc-600">{role.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {role.permissions.map((permission) => (
                      <div
                        key={`${role.role}-${permission.key}`}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-zinc-900">{permission.label}</p>
                          <span className="text-xs uppercase tracking-wide text-zinc-400">
                            {permission.category}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">
                          {permission.actions.join(" - ")}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff Access Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Staff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Access Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Rights
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoadingUsers
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-44" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-28 rounded-full" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-full" /></td>
                      </tr>
                    ))
                  : users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-medium text-zinc-900">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {user.staffId}
                              {user.jobTitle ? ` - ${user.jobTitle}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-zinc-600">
                          {user.department ?? "-"}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Select
                            value={user.role}
                            onValueChange={(role) => {
                              if (!role) return;
                              updateRoleMutation.mutate({
                                userId: user.id,
                                role,
                              });
                            }}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-48">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.role} value={role.role}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {user.permissions.map((permission) => (
                              <span
                                key={`${user.id}-${permission.key}`}
                                className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                              >
                                {permission.label}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
