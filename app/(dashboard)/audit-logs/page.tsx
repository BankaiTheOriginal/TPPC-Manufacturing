"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import api from "@/lib/api";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  eventCategory: "AUTH" | "RBAC" | "DATA" | "SYSTEM";
  status: "SUCCESS" | "FAILURE";
  severity: "INFO" | "WARN" | "CRITICAL";
  actorType: "USER" | "SYSTEM" | "API_KEY";
  actorEmail: string | null;
  impersonatedById: string | null;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  httpMethod: string | null;
  route: string | null;
  requestId: string | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  prevHash: string | null;
  hash: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    staffId: string;
  };
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 50;

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILURE: "bg-red-100 text-red-700",
  LOGOUT: "bg-zinc-100 text-zinc-700",
  TOKEN_REFRESH: "bg-sky-100 text-sky-700",
  TOKEN_ROTATE: "bg-sky-100 text-sky-700",
  USER_CREATED: "bg-green-100 text-green-700",
  USER_UPDATED: "bg-blue-100 text-blue-700",
  ROLE_CHANGED: "bg-amber-100 text-amber-800",
};

const CATEGORIES = ["All", "AUTH", "RBAC", "DATA", "SYSTEM"];
const STATUSES = ["All", "SUCCESS", "FAILURE"];

const ENTITY_TYPES = [
  "All",
  "User",
  "Inventory",
  "Product",
  "ProductOrder",
  "SalesOrder",
  "Operation",
  "AuditLog",
];

const ACTIONS = [
  "All",
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "TOKEN_REFRESH",
  "TOKEN_ROTATE",
  "USER_CREATED",
  "ROLE_CHANGED",
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function AuditLogsPage() {
  useRequireRole([ROLES.ADMINISTRATOR]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("All");
  const [action, setAction] = useState("All");
  const [eventCategory, setEventCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<
    | { valid: boolean; inspected: number; brokenAt?: { id: string; reason: string } }
    | null
  >(null);

  const params: Record<string, string | number> = {
    page,
    limit: LIMIT,
  };
  if (entityType !== "All") params.entityType = entityType;
  if (action !== "All") params.action = action;
  if (eventCategory !== "All") params.eventCategory = eventCategory;
  if (status !== "All") params.status = status;

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", page, entityType, action, eventCategory, status],
    queryFn: () => api.get("/audit-logs", { params }).then((r) => r.data),
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const filtered = search.trim()
    ? logs.filter(
        (l) =>
          l.entityType.toLowerCase().includes(search.toLowerCase()) ||
          l.entityId.toLowerCase().includes(search.toLowerCase()) ||
          l.user?.staffId.toLowerCase().includes(search.toLowerCase()) ||
          `${l.user?.firstName} ${l.user?.lastName}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : logs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100">
            <ScrollText className="h-4 w-4 text-zinc-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Audit Trail</h1>
            <p className="text-xs text-zinc-400">
              {isLoading
                ? "Loading…"
                : `${total.toLocaleString()} total events`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {verifyResult && (
            <Badge
              className={
                verifyResult.valid
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }
            >
              {verifyResult.valid
                ? `Chain OK — ${verifyResult.inspected} rows`
                : `Chain broken at ${verifyResult.brokenAt?.id}`}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={verifying}
            onClick={async () => {
              setVerifying(true);
              try {
                const res = await api.get("/audit-logs/verify");
                setVerifyResult(res.data);
              } finally {
                setVerifying(false);
              }
            }}
          >
            {verifying ? "Verifying…" : "Verify chain"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search entity, ID or staff…"
            className="pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(String(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={action}
          onValueChange={(v) => {
            setAction(String(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={eventCategory}
          onValueChange={(v) => {
            setEventCategory(String(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(String(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Timestamp
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Category
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Action
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Entity
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Performed by
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Status
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-zinc-400"
                  >
                    No audit events found
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer hover:bg-zinc-50/70"
                    onClick={() => setSelected(log)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className="bg-zinc-100 text-zinc-700 text-[10px]">
                        {log.eventCategory}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        className={`text-xs font-semibold ${actionColors[log.action] ?? "bg-zinc-100 text-zinc-600"}`}
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-zinc-700">
                      {log.entityType}
                      <div className="font-mono text-[10px] text-zinc-400">
                        {log.entityId.length > 16
                          ? `${log.entityId.slice(0, 8)}…`
                          : log.entityId}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {log.user ? (
                        <span>
                          {log.user.firstName} {log.user.lastName}{" "}
                          <span className="text-xs text-zinc-400">
                            ({log.user.staffId})
                          </span>
                        </span>
                      ) : log.actorEmail ? (
                        <span className="text-xs text-zinc-500">
                          {log.actorEmail}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        className={
                          log.status === "FAILURE"
                            ? "bg-red-100 text-red-700 text-[10px]"
                            : "bg-emerald-100 text-emerald-700 text-[10px]"
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge
                className={`text-xs font-semibold ${selected ? (actionColors[selected.action] ?? "") : ""}`}
              >
                {selected?.action}
              </Badge>
              <span className="text-zinc-700">{selected?.entityType}</span>
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400">Entity ID</p>
                  <p className="mt-0.5 font-mono text-xs break-all">
                    {selected.entityId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Timestamp (UTC)</p>
                  <p className="mt-0.5 font-mono text-xs">
                    {new Date(selected.createdAt).toISOString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Performed by</p>
                  <p className="mt-0.5">
                    {selected.user
                      ? `${selected.user.firstName} ${selected.user.lastName} (${selected.user.staffId})`
                      : selected.actorEmail ?? selected.userId ?? "system"}
                  </p>
                  {selected.impersonatedById && (
                    <p className="text-[10px] text-amber-700">
                      impersonating {selected.impersonatedById}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Actor type</p>
                  <p className="mt-0.5 font-mono text-xs">{selected.actorType}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Category / Status / Severity</p>
                  <p className="mt-0.5 text-xs">
                    {selected.eventCategory} · {selected.status} · {selected.severity}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">IP · Method · Route</p>
                  <p className="mt-0.5 font-mono text-[11px] break-all">
                    {selected.ipAddress ?? "—"} · {selected.httpMethod ?? "—"} ·{" "}
                    {selected.route ?? "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-zinc-400">Request ID</p>
                  <p className="mt-0.5 font-mono text-[11px] break-all">
                    {selected.requestId ?? "—"}
                  </p>
                </div>
              </div>

              {selected.changes && Object.keys(selected.changes).length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Changes (before / after)
                  </p>
                  <pre className="max-h-96 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-green-400 leading-relaxed whitespace-pre-wrap break-all">
                    {JSON.stringify(selected.changes, null, 2)}
                  </pre>
                </div>
              )}

              {selected.metadata &&
                Object.keys(selected.metadata).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Metadata
                    </p>
                    <pre className="max-h-60 overflow-auto rounded-lg bg-zinc-100 p-4 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap break-all">
                      {JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                )}

              {selected.userAgent && (
                <div>
                  <p className="text-xs text-zinc-400">User Agent</p>
                  <p className="mt-0.5 text-xs text-zinc-500 break-all">
                    {selected.userAgent}
                  </p>
                </div>
              )}

              <div className="border-t border-zinc-100 pt-3">
                <p className="text-xs text-zinc-400">Hash chain</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-500 break-all">
                  prev: {selected.prevHash ?? "genesis"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-zinc-700 break-all">
                  this: {selected.hash}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
