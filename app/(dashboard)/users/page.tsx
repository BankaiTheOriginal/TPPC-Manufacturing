"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, ChevronRight, Upload, UserCircle, Download } from "lucide-react";
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
  SelectValue,
} from "@/components/ui/select";
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
}

interface LocationOption {
  id: string;
  name: string;
  state: string;
  addressLine: string;
}

interface ImportUserRow {
  staffId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: string;
  location?: string;
  locationId?: string;
  jobTitle?: string;
  department?: string;
  phoneNumber?: string;
  reportingLine?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface ImportUsersResponse {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{
    row: number;
    staffId?: string;
    email?: string;
    message: string;
  }>;
}

const createUserSchema = z.object({
  staffId: z.string().min(1, "Staff ID required"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Min 8 characters"),
  jobTitle: z.string().min(1, "Job title required"),
  department: z.string().min(1, "Department required"),
  locationId: z.string().optional().nullable(),
  phoneNumber: z.string().optional(),
  reportingLine: z.string().optional(),
  role: z.string().min(1, "Role required"),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const LIMIT = 20;

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  const normalizedText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (character === '"') {
      if (inQuotes && normalizedText[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && normalizedText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentCell.trim());
      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((value) => value.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeImportHeader(header: string): keyof ImportUserRow | undefined {
  const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const headerMap: Record<string, keyof ImportUserRow> = {
    staffid: "staffId",
    employeeid: "staffId",
    firstname: "firstName",
    lastname: "lastName",
    email: "email",
    password: "password",
    role: "role",
    accessrole: "role",
    location: "location",
    locationname: "location",
    locationid: "locationId",
    jobtitle: "jobTitle",
    department: "department",
    phonenumber: "phoneNumber",
    phone: "phoneNumber",
    reportingline: "reportingLine",
    addressline1: "addressLine1",
    address1: "addressLine1",
    addressline2: "addressLine2",
    address2: "addressLine2",
    city: "city",
    state: "state",
    postalcode: "postalCode",
    postcode: "postalCode",
    zipcode: "postalCode",
    country: "country",
  };

  return headerMap[normalized];
}

function parseImportedUsers(text: string) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return [];
  }

  const [headerRow, ...valueRows] = rows;
  const normalizedHeaders = headerRow.map(normalizeImportHeader);

  return valueRows
    .map((cells) => {
      const row: ImportUserRow = {};
      normalizedHeaders.forEach((header, index) => {
        const value = cells[index]?.trim();
        if (!header || !value) {
          return;
        }
        row[header] = value;
      });
      return row;
    })
    .filter((row) => Object.keys(row).length > 0);
}

export default function UsersPage() {
  useRequireRole([ROLES.ADMINISTRATOR, ROLES.GENERAL_MANAGER, ROLES.HEAD_OF_OPERATIONS, ROLES.HUMAN_RESOURCES]);
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [defaultImportPassword, setDefaultImportPassword] = useState("");
  const [importSummary, setImportSummary] = useState<ImportUsersResponse | null>(null);

  const { data = [], isFetching } = useQuery<User[]>({
    queryKey: ["users", page],
    queryFn: async () => {
      const res = await api.get("/users", { params: { page, limit: LIMIT } });
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

  const filtered = data.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.staffId.toLowerCase().includes(q) ||
      (u.jobTitle ?? "").toLowerCase().includes(q) ||
      (u.department ?? "").toLowerCase().includes(q) ||
      (u.location?.name ?? "").toLowerCase().includes(q) ||
      (u.phoneNumber ?? "").toLowerCase().includes(q)
    );
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema) as Resolver<CreateUserForm>,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateUserForm) => api.post("/auth/signup", body),
    onSuccess: () => {
      toast.success("Staff member created");
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      reset();
    },
    onError: () => toast.error("Failed to create staff member"),
  });

  const importMutation = useMutation<ImportUsersResponse, unknown, {
    rows: ImportUserRow[];
    defaultPassword?: string;
  }>({
    mutationFn: (body) =>
      api.post("/users/import", body).then((response) => response.data),
    onSuccess: (result) => {
      setImportSummary(result);
      toast.success(
        `Imported ${result.created} user(s), updated ${result.updated}, failed ${result.failed}`,
      );
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowImport(false);
      setImportFile(null);
      setDefaultImportPassword("");
    },
    onError: () => {
      toast.error("Failed to import users");
    },
  });

  const hasMore = data.length === LIMIT;

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/users/bulk-delete", { ids }),
    onSuccess: () => {
      toast.success("Deleted staff members");
      qc.invalidateQueries({ queryKey: ["users"] });
      setSelected(new Set());
      setShowBulkDelete(false);
    },
    onError: () => toast.error("Failed to delete staff members"),
  });

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    const ids = filtered.map((u) => u.id);
    setSelected(new Set(ids));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function downloadTemplateCSV() {
    const link = document.createElement("a");
    link.href = "/user-import-template.csv";
    link.download = "user-import-template.csv";
    link.click();
    toast.success("Template downloaded");
  }

  async function handleImport() {
    if (!importFile) {
      toast.error("Select a CSV file to import");
      return;
    }

    const rows = parseImportedUsers(await importFile.text());
    if (rows.length === 0) {
      toast.error("No importable rows were found in the CSV file");
      return;
    }

    const trimmedDefaultPassword = defaultImportPassword.trim();
    importMutation.mutate({
      rows,
      defaultPassword: trimmedDefaultPassword || undefined,
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            size="sm"
            variant="outline"
            className="shrink-0 gap-2"
            onClick={() => setShowImport(true)}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button
            size="sm"
            className="shrink-0 gap-2 bg-teal-500 text-white hover:bg-teal-600"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            Add Team Member
          </Button>
        </div>
      </div>

      {importSummary && (
        <Card className="border-teal-100 bg-teal-50/50">
          <CardContent className="space-y-2 px-4 py-3 text-sm text-zinc-700">
            <p>
              Import summary: {importSummary.created} created, {importSummary.updated} updated, {importSummary.failed} failed.
            </p>
            {importSummary.errors.length > 0 && (
              <div className="space-y-1 text-xs text-red-600">
                {importSummary.errors.slice(0, 5).map((error) => (
                  <p key={`${error.row}-${error.email ?? error.staffId ?? error.message}`}>
                    Row {error.row}: {error.message}
                    {error.staffId ? ` (${error.staffId})` : error.email ? ` (${error.email})` : ""}
                  </p>
                ))}
                {importSummary.errors.length > 5 && (
                  <p>
                    {importSummary.errors.length - 5} more error(s) were omitted from this summary.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
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
                      onChange={(e) => {
                        if (e.target.checked) selectAllVisible();
                        else clearSelection();
                      }}
                      checked={
                        filtered.length > 0 && selected.size === filtered.length
                      }
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Staff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Staff ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Access
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isFetching && data.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-5 w-28 rounded-full" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </td>
                        <td className="px-6 py-3" />
                      </tr>
                    ))
                  : filtered.map((user) => (
                      <tr
                        key={user.id}
                        className="cursor-pointer transition-colors hover:bg-zinc-50/60"
                        onClick={() => router.push(`/settings/users/${user.id}`)}
                      >
                        <td className="px-4 py-3">
                          <input
                            role="checkbox"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selected.has(user.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelect(user.id);
                            }}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200">
                              <UserCircle className="h-5 w-5 text-zinc-400" />
                            </div>
                            <span className="font-medium text-zinc-800">
                              {user.firstName} {user.lastName}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {user.jobTitle ?? "No job title"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-zinc-500">
                          {user.staffId}
                        </td>
                        <td className="px-6 py-3 text-zinc-500">
                          {user.department ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-zinc-500">
                          {user.location?.name ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-zinc-500">
                          {user.phoneNumber ?? "—"}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[user.role] ?? "bg-zinc-100 text-zinc-600"}`}
                          >
                            {roleLabels[user.role] ?? user.role}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end">
                            <ChevronRight className="h-4 w-4 text-zinc-300" />
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3">
            <p className="text-sm text-zinc-500">
              Page {page} · {filtered.length} records
            </p>
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

      {/* Create Staff Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) reset();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input placeholder="Jane" {...register("firstName")} />
                {errors.firstName && (
                  <p className="text-xs text-red-500">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input placeholder="Doe" {...register("lastName")} />
                {errors.lastName && (
                  <p className="text-xs text-red-500">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Staff ID</Label>
                <Input placeholder="STF-001" {...register("staffId")} />
                {errors.staffId && (
                  <p className="text-xs text-red-500">
                    {errors.staffId.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="jane@tppcng.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input
                  placeholder="Production Supervisor"
                  {...register("jobTitle")}
                />
                {errors.jobTitle && (
                  <p className="text-xs text-red-500">{errors.jobTitle.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="Production" {...register("department")} />
                {errors.department && (
                  <p className="text-xs text-red-500">{errors.department.message}</p>
                )}
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
                          field.onChange(value === "__none__" ? undefined : value)
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
                <Input placeholder="08000000000" {...register("phoneNumber")} />
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Line</Label>
                <Input
                  placeholder="Production Manager"
                  {...register("reportingLine")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
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
                {errors.role && (
                  <p className="text-xs text-red-500">{errors.role.message}</p>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-teal-500 hover:bg-teal-600"
              >
                {createMutation.isPending ? "Creating..." : "Create Team Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showImport}
        onOpenChange={(open) => {
          setShowImport(open);
          if (!open) {
            setImportFile(null);
            setDefaultImportPassword("");
          }
        }}
      >
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-teal-500" />
              Import Staff CSV
            </DialogTitle>
            <p className="text-sm text-zinc-500 mt-1">
              Bulk-import staff members from a comma-separated values file.
            </p>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* CSV Columns */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                CSV Columns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["staffId", "fullName", "role", "jobTitle", "department", "reportingLine", "locationName"].map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                  >
                    {col}
                  </span>
                ))}
                {["email", "phoneNumber"].map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-mono font-medium text-blue-600 ring-1 ring-inset ring-blue-200"
                    title="Optional — auto-generated when omitted"
                  >
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-xs text-zinc-400">
                Columns in{" "}
                <span className="font-medium text-blue-500">blue</span> are
                optional and auto-generated when omitted. Phone numbers are
                normalised to 0XXXXXXXXXX format.
              </p>
            </div>

            {/* Supported Roles */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Supported Roles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "ADMINISTRATOR",
                  "GENERAL_MANAGER",
                  "PRODUCTION_MANAGER",
                  "HEAD_OF_OPERATIONS",
                  "SUPERVISOR",
                  "ACCOUNTANT",
                  "LOGISTICS_TEAM",
                  "DESIGN_TEAM",
                  "HUMAN_RESOURCES",
                  "CUSTOMER_CARE",
                  "FACTORY_WORKER",
                ].map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-200"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* File input */}
            <div className="space-y-1.5">
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  setImportFile(event.target.files?.[0] ?? null)
                }
              />
            </div>

            {/* Default password */}
            <div className="space-y-1.5">
              <Label>Default Password</Label>
              <Input
                type="password"
                placeholder="Optional — used for rows without a password column"
                value={defaultImportPassword}
                onChange={(event) =>
                  setDefaultImportPassword(event.target.value)
                }
              />
              <p className="text-xs text-zinc-400">
                Existing users keep their current password unless the CSV
                includes a password column.
              </p>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-1 flex-row flex-wrap items-center justify-end rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={downloadTemplateCSV}
              className="gap-2 sm:mr-auto"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowImport(false);
                setImportFile(null);
                setDefaultImportPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={importMutation.isPending}
              className="bg-teal-500 hover:bg-teal-600"
              onClick={handleImport}
            >
              {importMutation.isPending ? "Importing..." : "Import Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog
        open={showBulkDelete}
        onOpenChange={(open) => setShowBulkDelete(open)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected staff</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-zinc-600">
              Are you sure you want to delete {selected.size} staff member(s)?
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
    </div>
  );
}
