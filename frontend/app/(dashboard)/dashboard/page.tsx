"use client";

import {
  ClipboardList,
  ShoppingCart,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListChecks,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { STAGE_LABELS } from "@/lib/constants";
import { useAuthStore } from "@/lib/stores/auth-store";
import { canAccess } from "@/lib/rbac";

interface ProductionOrder {
  id: string;
  sku: string;
  productName: string;
  status: string;
  priority: string;
  quantity: number;
}

function statusConfig(status: string) {
  const map: Record<
    string,
    { label: string; icon: typeof Clock; className: string }
  > = {
    PENDING: {
      label: "Pending",
      icon: Clock,
      className: "bg-zinc-100 text-zinc-700",
    },
    ASSIGNED: {
      label: "Assigned",
      icon: Clock,
      className: "bg-blue-100 text-blue-700",
    },
    WORK_IN_PROGRESS: {
      label: "In Progress",
      icon: TrendingUp,
      className: "bg-teal-100 text-teal-700",
    },
    PAUSED: {
      label: "Paused",
      icon: AlertCircle,
      className: "bg-yellow-100 text-yellow-700",
    },
    COMPLETE: {
      label: "Complete",
      icon: CheckCircle2,
      className: "bg-emerald-100 text-emerald-700",
    },
  };
  return (
    map[status] ?? {
      label: status,
      icon: Clock,
      className: "bg-zinc-100 text-zinc-700",
    }
  );
}

function priorityConfig(priority: string) {
  const map: Record<string, string> = {
    HIGH: "bg-red-100 text-red-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    LOW: "bg-zinc-100 text-zinc-600",
  };
  return map[priority] ?? "bg-zinc-100 text-zinc-600";
}

const stageOverviewCards = [
  { label: STAGE_LABELS.CTP_MAKING, stage: "CTP_MAKING" },
  { label: STAGE_LABELS.PRINTING, stage: "PRINTING" },
  { label: STAGE_LABELS.DIECUTTING, stage: "DIECUTTING" },
  { label: STAGE_LABELS.LAMINATION, stage: "LAMINATION" },
  { label: STAGE_LABELS.PACKAGING, stage: "PACKAGING" },
  { label: STAGE_LABELS.FINISHING, stage: "FINISHING" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: productionOrders = [] } = useQuery<ProductionOrder[]>({
    queryKey: ["dashboard-production-orders"],
    queryFn: async () => {
      const res = await api.get("/production-orders", {
        params: { page: 1, limit: 50 },
      });
      const d = res.data;
      // Handle both new { items } and legacy array shapes
      if (d && !Array.isArray(d) && Array.isArray(d.items)) return d.items;
      return d;
    },
  });

  const { data: tasksData } = useQuery<{ total: number }>({
    queryKey: ["dashboard-tasks-count"],
    queryFn: async () => {
      const res = await api.get("/production-orders/tasks", {
        params: { page: 1, limit: 1 },
      });
      return res.data;
    },
  });

  const { data: stageCountsMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["dashboard-stage-counts"],
    queryFn: async () => {
      const results = await Promise.all(
        stageOverviewCards.map(({ stage }) =>
          api
            .get("/production-orders/tasks", {
              params: { page: 1, limit: 1, stage, status: "IN_PROGRESS" },
            })
            .then((r) => ({ stage, count: r.data.total as number })),
        ),
      );
      const map: Record<string, number> = {};
      for (const { stage, count } of results) map[stage] = count;
      return map;
    },
  });

  const { data: users = [] } = useQuery<unknown[]>({
    queryKey: ["dashboard-users"],
    queryFn: async () => {
      const res = await api.get("/users", { params: { page: 1, limit: 1000 } });
      return res.data;
    },
  });

  const { data: salesOrders = [] } = useQuery<unknown[]>({
    queryKey: ["dashboard-sales-orders"],
    queryFn: async () => {
      const res = await api.get("/zoho/sales-orders", {
        params: { per_page: 200 },
      });
      return res.data;
    },
  });

  const activeOrders = productionOrders.filter(
    (o) => o.status !== "COMPLETE" && o.status !== "CANCELLED",
  );

  const recentOrders = [...productionOrders].slice(0, 5);

  const statCards = [
    {
      label: "Active Production Orders",
      value: activeOrders.length,
      icon: ClipboardList,
      href: "/production-orders",
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      label: "Sales Orders",
      value: salesOrders.length,
      icon: ShoppingCart,
      href: "/sales-orders",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Staff Members",
      value: users.length,
      icon: Users,
      href: "/settings/users",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Active Tasks",
      value: tasksData?.total ?? 0,
      icon: ListChecks,
      href: "/tasks",
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  const visibleStatCards = statCards.filter((card) =>
    canAccess(user?.role ?? "", card.href),
  );

  const statGridColsClass =
    visibleStatCards.length >= 4
      ? "xl:grid-cols-4"
      : visibleStatCards.length === 3
        ? "xl:grid-cols-3"
        : visibleStatCards.length === 2
          ? "xl:grid-cols-2"
          : "";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${statGridColsClass}`}
      >
        {visibleStatCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.bg}`}
                  >
                    <Icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-zinc-900">
                      {card.value}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      {card.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Production Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent Production Orders</CardTitle>
          <Link
            href="/production-orders"
            className="text-sm font-medium text-teal-600 hover:text-teal-700"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {productionOrders.length === 0
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </td>
                      </tr>
                    ))
                  : recentOrders.length === 0
                    ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                          No production orders yet
                        </td>
                      </tr>
                    )
                  : recentOrders.map((order) => {
                      const s = statusConfig(order.status);
                      const StatusIcon = s.icon;
                      return (
                        <tr
                          key={order.id}
                          className="cursor-pointer transition-colors hover:bg-zinc-50/50"
                          onClick={() =>
                            router.push(`/production-orders/${order.id}`)
                          }
                        >
                          <td className="px-6 py-3 font-mono text-xs text-zinc-500">
                            {order.sku}
                          </td>
                          <td className="px-6 py-3 font-medium text-zinc-900">
                            {order.productName}
                          </td>
                          <td className="px-6 py-3 text-zinc-600">
                            {order.quantity.toLocaleString()}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityConfig(order.priority)}`}
                            >
                              {order.priority}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {s.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Operation Stages Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stageOverviewCards.map(({ label, stage }) => {
          const count = stageCountsMap[stage] ?? 0;
          return (
            <Card key={stage}>
              <CardContent className="p-4 text-center">
                <div className="mb-2">
                  <p className="text-2xl font-bold text-zinc-800">
                    {count.toLocaleString()}
                  </p>
                </div>
                <p className="text-xs font-medium text-zinc-500">{label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
