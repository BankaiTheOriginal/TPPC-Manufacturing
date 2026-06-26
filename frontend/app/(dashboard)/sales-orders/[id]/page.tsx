"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ShoppingCart,
  Calendar,
  User,
  Mail,
  FileText,
  Factory,
  Plus,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";
import api from "@/lib/api";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  confirmed: "bg-blue-100 text-blue-700",
  draft: "bg-zinc-100 text-zinc-600",
  void: "bg-red-100 text-red-600",
  overdue: "bg-teal-100 text-teal-700",
  invoiced: "bg-purple-100 text-purple-700",
};

interface LineItem {
  lineItemId: string;
  itemId: string;
  name: string;
  sku: string;
  description: string;
  quantity: number;
  rate: number;
  total: number;
  unit: string;
}

interface SalesOrderDetail {
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
  notes: string | null;
  lineItems: LineItem[];
}

export default function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.LOGISTICS_TEAM,
    ROLES.CUSTOMER_CARE,
  ]);
  const router = useRouter();

  // Send to Production dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priority, setPriority] = useState<string>("MEDIUM");
  // Per-line-item quantities, inclusion flags, product type and category
  const [lineQtys, setLineQtys] = useState<Record<string, number>>({});
  const [lineIncluded, setLineIncluded] = useState<Record<string, boolean>>({});
  const [lineProductType, setLineProductType] = useState<Record<string, string>>({});
  const [lineProductCategory, setLineProductCategory] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: async (data: {
      shared: {
        priority: string;
      };
      items: {
        lineItemId: string;
        name: string;
        sku: string;
        description: string;
        quantity: number;
        salesQty: number;
        productType: string;
        productCategory: string;
      }[];
      salesorderId: string;
      salesorderNumber: string;
    }) => {
      const settled = await Promise.allSettled(
        data.items.map((item) => {
          const productName =
            item.name?.trim() ||
            item.description?.trim() ||
            item.sku?.trim() ||
            `Item ${item.lineItemId}`;
          const sku =
            (item.sku && item.sku.trim()) || item.lineItemId;
          return api.post("/production-orders", {
            sku: `${data.salesorderNumber}-${sku}`,
            productName,
            productType: item.productType,
            productCategory: item.productCategory,
            quantity: item.quantity,
            orderType: "MAKE_TO_ORDER",
            priority: data.shared.priority,
            zohoBooksId: data.salesorderId,
          });
        }),
      );
      const fulfilled: { id: string }[] = [];
      const failed: (typeof data.items)[number][] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          fulfilled.push(r.value.data as { id: string });
        } else {
          failed.push(data.items[i]);
        }
      });
      return { fulfilled, failed };
    },
    onSuccess: ({ fulfilled, failed }) => {
      if (fulfilled.length === 0) {
        toast.error(
          `Failed to create production order${failed.length > 1 ? "s" : ""}`,
        );
        return;
      }
      setDialogOpen(false);
      if (failed.length > 0) {
        toast.warning(
          `${fulfilled.length} of ${fulfilled.length + failed.length} production orders created`,
        );
      } else if (fulfilled.length === 1) {
        toast.success("Production order created");
      } else {
        toast.success(`${fulfilled.length} production orders created`);
      }
      if (fulfilled.length === 1 && failed.length === 0) {
        router.push(`/production-orders/${fulfilled[0].id}`);
      } else {
        router.push(`/production-orders`);
      }
    },
    onError: () => toast.error("Failed to create production order(s)"),
  });

  function openProductionDialog() {
    setPriority("MEDIUM");
    // Reset per-line-item state when order loads
    if (order) {
      const qtys: Record<string, number> = {};
      const incl: Record<string, boolean> = {};
      const types: Record<string, string> = {};
      const categories: Record<string, string> = {};
      for (const item of order.lineItems) {
        qtys[item.lineItemId] = item.quantity;
        incl[item.lineItemId] = true;
        types[item.lineItemId] = "";
        categories[item.lineItemId] = "";
      }
      setLineQtys(qtys);
      setLineIncluded(incl);
      setLineProductType(types);
      setLineProductCategory(categories);
    }
    setDialogOpen(true);
  }

  function handleSendToProduction() {
    if (!order) return;
    const included = order.lineItems.filter(
      (item) => lineIncluded[item.lineItemId] !== false,
    );
    if (included.length === 0) {
      toast.error("Select at least one line item");
      return;
    }
    const missing = included.find(
      (item) =>
        !lineProductType[item.lineItemId] ||
        !lineProductCategory[item.lineItemId],
    );
    if (missing) {
      toast.error(
        `Select product type and category for ${missing.name || missing.sku || "each item"}`,
      );
      return;
    }
    createMutation.mutate({
      shared: {
        priority: priority || "MEDIUM",
      },
      items: included.map((item) => ({
        lineItemId: item.lineItemId,
        name: item.name,
        sku: item.sku,
        description: item.description,
        quantity: lineQtys[item.lineItemId] ?? item.quantity,
        salesQty: item.quantity,
        productType: lineProductType[item.lineItemId],
        productCategory: lineProductCategory[item.lineItemId],
      })),
      salesorderId: order.salesorderId,
      salesorderNumber: order.salesorderNumber,
    });
  }

  const { data: order, isLoading } = useQuery<SalesOrderDetail>({
    queryKey: ["sales-orders", id],
    queryFn: async () => {
      const res = await api.get(`/zoho/sales-orders/${id}`);
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/sales-orders"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sales Orders
        </Link>
        <div className="flex items-center gap-2">
          {order && order.status === "draft" && (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
              onClick={openProductionDialog}
            >
              <Factory className="h-4 w-4" />
              Send to Production
            </Button>
          )}
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
            Zoho Books
          </span>
        </div>
      </div>

      {/* Order Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-3">
            {isLoading ? (
              <Skeleton className="h-7 w-44" />
            ) : (
              <h1 className="text-xl font-semibold text-zinc-900">
                {order?.salesorderNumber}
              </h1>
            )}
            {isLoading ? (
              <Skeleton className="h-5 w-20 rounded-full" />
            ) : order ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[order.status] ?? "bg-zinc-100 text-zinc-600"}`}
              >
                {order.status}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-32" />
              ) : (
                <span>{order?.customerName}</span>
              )}
            </span>
            {order?.referenceNumber && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span>Ref: {order.referenceNumber}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 text-right text-sm">
          <div className="flex items-center justify-end gap-1.5 text-zinc-500">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">Order Date:</span>
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="font-medium text-zinc-800">{order?.date}</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-zinc-500">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">Shipment Date:</span>
            {isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="font-medium text-zinc-800">
                {order?.shipmentDate ?? "—"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Line Items */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4 text-zinc-400" />
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      SKU
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Item Name
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Unit
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Qty
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Rate
                    </th>
                    <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="hover:bg-zinc-50/50">
                          <td className="px-5 py-3 font-mono text-xs">
                            <Skeleton className="h-4 w-16" />
                          </td>
                          <td className="px-5 py-3">
                            <Skeleton className="h-4 w-40" />
                          </td>
                          <td className="px-5 py-3">
                            <Skeleton className="h-4 w-12" />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Skeleton className="ml-auto h-4 w-8" />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </td>
                        </tr>
                      ))
                    : order?.lineItems.map((item) => (
                        <tr
                          key={item.lineItemId}
                          className="hover:bg-zinc-50/50"
                        >
                          <td className="px-5 py-3 font-mono text-xs text-zinc-500">
                            {item.sku || "—"}
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-zinc-800">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-zinc-400">
                                {item.description}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3 text-zinc-500">
                            {item.unit}
                          </td>
                          <td className="px-5 py-3 text-right text-zinc-700">
                            {item.quantity}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-zinc-700">
                            {order.currencyCode}{" "}
                            {(item.rate ?? 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-medium text-zinc-900">
                            {order.currencyCode}{" "}
                            {(item.total ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">Subtotal</p>
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <p className="font-mono text-sm text-zinc-800">
                    {order?.currencyCode}{" "}
                    {(order?.subtotal ?? 0).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <p className="text-sm font-semibold text-zinc-900">Total</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-28" />
                ) : (
                  <p className="font-mono text-base font-bold text-zinc-900">
                    {order?.currencyCode} {(order?.total ?? 0).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Sales Order #",
                  value: order?.salesorderNumber,
                },
                {
                  label: "Zoho Books ID",
                  value: order?.salesorderId,
                },
                {
                  label: "Reference",
                  value: order?.referenceNumber || "—",
                },
                {
                  label: "Status",
                  value: order?.status,
                  capitalize: true,
                },
                {
                  label: "Shipment Date",
                  value: order?.shipmentDate ?? "—",
                },
              ].map(({ label, value, capitalize }) => (
                <div key={label}>
                  <p className="text-xs text-zinc-500">{label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-4 w-full" />
                  ) : (
                    <p
                      className={`mt-0.5 text-sm text-zinc-800 ${capitalize ? "capitalize" : ""}`}
                    >
                      {value}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-zinc-400" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-16 w-full rounded" />
              ) : (
                <p className="text-sm text-zinc-600">
                  {order?.notes || "No notes on this order."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send to Production Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-blue-600" />
              Make to Production Orders
            </DialogTitle>
            <DialogDescription>
              Each line item below will become a separate production order.
              Adjust quantities and toggle items on/off as needed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Per-line-item table */}
            {order && order.lineItems.length > 0 && (
              <div className="rounded-lg border border-zinc-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 w-8" />
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Sales Qty
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Production Qty
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Product Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Product Category
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 w-24">
                        vs Order
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {order.lineItems.map((item) => {
                      const included = lineIncluded[item.lineItemId] !== false;
                      const qty = lineQtys[item.lineItemId] ?? item.quantity;
                      const diff = qty - item.quantity;
                      return (
                        <tr
                          key={item.lineItemId}
                          className={included ? "" : "opacity-40"}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={(e) =>
                                setLineIncluded((p) => ({
                                  ...p,
                                  [item.lineItemId]: e.target.checked,
                                }))
                              }
                              className="h-3.5 w-3.5 rounded border-zinc-300 accent-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-zinc-800">
                              {item.name ||
                                item.description ||
                                item.sku ||
                                "Untitled item"}
                            </p>
                            {item.sku && item.name && (
                              <p className="font-mono text-xs text-zinc-400">
                                {item.sku}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                disabled={!included || qty <= 1}
                                onClick={() =>
                                  setLineQtys((p) => ({
                                    ...p,
                                    [item.lineItemId]: Math.max(1, qty - 1),
                                  }))
                                }
                                className="rounded border border-zinc-200 p-0.5 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                disabled={!included}
                                value={qty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value);
                                  if (!isNaN(v) && v >= 1)
                                    setLineQtys((p) => ({
                                      ...p,
                                      [item.lineItemId]: v,
                                    }));
                                }}
                                className="h-7 w-16 rounded border border-zinc-200 px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                              />
                              <button
                                type="button"
                                disabled={!included}
                                onClick={() =>
                                  setLineQtys((p) => ({
                                    ...p,
                                    [item.lineItemId]: qty + 1,
                                  }))
                                }
                                className="rounded border border-zinc-200 p-0.5 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={lineProductType[item.lineItemId] || ""}
                              onValueChange={(v) =>
                                v != null &&
                                setLineProductType((p) => ({
                                  ...p,
                                  [item.lineItemId]: v,
                                }))
                              }
                              disabled={!included}
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BRANDED">Branded</SelectItem>
                                <SelectItem value="PLAIN">Plain</SelectItem>
                                <SelectItem value="GENERIC">Generic</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={lineProductCategory[item.lineItemId] || ""}
                              onValueChange={(v) =>
                                v != null &&
                                setLineProductCategory((p) => ({
                                  ...p,
                                  [item.lineItemId]: v,
                                }))
                              }
                              disabled={!included}
                            >
                              <SelectTrigger className="h-8 w-32">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BAGS">Bags</SelectItem>
                                <SelectItem value="BOXES">Boxes</SelectItem>
                                <SelectItem value="CUPS">Cups</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            {diff === 0 ? (
                              <span className="text-zinc-400">—</span>
                            ) : diff > 0 ? (
                              <span className="font-medium text-green-600">
                                +{diff} surplus
                              </span>
                            ) : (
                              <span className="font-medium text-amber-600">
                                {diff} short
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Shared fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Order Type</Label>
                <Input value="Make to Order" disabled readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => v != null && setPriority(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSendToProduction}
              disabled={createMutation.isPending || !order}
            >
              <Factory className="h-4 w-4" />
              {createMutation.isPending
                ? "Creating..."
                : `Create ${order?.lineItems.filter((i) => lineIncluded[i.lineItemId] !== false).length ?? 0} Production Order${(order?.lineItems.filter((i) => lineIncluded[i.lineItemId] !== false).length ?? 0) !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
