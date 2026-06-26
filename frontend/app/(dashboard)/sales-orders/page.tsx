"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ChevronRight, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  confirmed: "bg-blue-100 text-blue-700",
  draft: "bg-zinc-100 text-zinc-600",
  void: "bg-red-100 text-red-600",
  overdue: "bg-teal-100 text-teal-700",
  invoiced: "bg-purple-100 text-purple-700",
};

interface SalesOrder {
  salesorderId: string;
  salesorderNumber: string;
  customerName: string;
  customerId: string;
  status: string;
  date: string;
  shipmentDate: string | null;
  referenceNumber: string;
  currencyCode: string;
  subtotal: number;
  total: number;
}

export default function SalesOrdersPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.LOGISTICS_TEAM,
    ROLES.CUSTOMER_CARE,
  ]);
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const {
    data = [],
    isFetching,
    refetch,
  } = useQuery<SalesOrder[]>({
    queryKey: ["sales-orders", page],
    queryFn: async () => {
      const res = await api.get("/zoho/sales-orders", {
        params: { page, per_page: 50 },
      });
      return res.data;
    },
  });

  const filtered = data.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.salesorderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.referenceNumber.toLowerCase().includes(q)
    );
  });

  const hasMore = data.length === 50;

  const handleSync = async () => {
    await qc.invalidateQueries({ queryKey: ["sales-orders"] });
    refetch();
    toast.success("Sales orders refreshed");
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3">
        <ShoppingCart className="h-5 w-5 shrink-0 text-blue-600" />
        <p className="text-sm text-blue-700">
          Sales orders are synced from{" "}
          <span className="font-semibold">Zoho Books</span>. Data shown here is
          read-only.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0 gap-2 border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-transparent dark:bg-popover/70 dark:text-white dark:hover:bg-popover/80"
          onClick={handleSync}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          {isFetching ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Order #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Shipment Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Subtotal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Total
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isFetching && data.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-3 font-mono text-xs font-medium text-zinc-700">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-6 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-20" />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Skeleton className="ml-auto h-4 w-20" />
                        </td>
                        <td className="px-6 py-3" />
                      </tr>
                    ))
                  : filtered.map((order) => (
                      <tr
                        key={order.salesorderId}
                        className="cursor-pointer transition-colors hover:bg-zinc-50/60"
                        onClick={() =>
                          router.push(`/sales-orders/${order.salesorderId}`)
                        }
                      >
                        <td className="px-6 py-3 font-mono text-xs font-medium text-zinc-700">
                          {order.salesorderNumber}
                        </td>
                        <td className="px-6 py-3">
                          <div>
                            <p className="font-medium text-zinc-800">
                              {order.customerName}
                            </p>
                            {order.referenceNumber && (
                              <p className="text-xs text-zinc-400">
                                Ref: {order.referenceNumber}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[order.status] ?? "bg-zinc-100 text-zinc-600"}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-zinc-500">
                          {order.date}
                        </td>
                        <td className="px-6 py-3 text-zinc-500">
                          {order.shipmentDate ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-zinc-700">
                          {order.currencyCode}{" "}
                          {(order.subtotal ?? 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-medium text-zinc-900">
                          {order.currencyCode}{" "}
                          {(order.total ?? 0).toLocaleString()}
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
    </div>
  );
}
