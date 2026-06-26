"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, ChevronRight } from "lucide-react";
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
import { priorityColors, orderStatusColors } from "@/lib/constants";
import { useAuthStore } from "@/lib/stores/auth-store";

interface ProductOrder {
  id: string;
  sku: string;
  productName: string;
  productType: string;
  productCategory: string;
  quantity: number;
  orderType: string;
  priority: string;
  status: string | null;
  grandTotal: string;
  subtotal: string;
  labourCost: string;
  zohoBooksId: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { materials: number; operations: number };
}

interface ZohoItem {
  itemId?: string;
  name?: string;
  itemName?: string;
  sku?: string;
  rate?: number;
}

interface SalesOrder {
  salesorderId: string;
  salesorderNumber: string;
  customerName?: string;
  status?: string;
  total?: number;
}

interface SalesOrderLineItem {
  lineItemId: string;
  itemId: string;
  name: string;
  sku?: string;
  quantity?: number;
  rate?: number;
}

const ADMIN_ROLES: string[] = [
  ROLES.ADMINISTRATOR,
  ROLES.GENERAL_MANAGER,
  ROLES.PRODUCTION_MANAGER,
  ROLES.HEAD_OF_OPERATIONS,
];

const LIMIT = 20;

export default function ProductionOrdersPage() {
  useRequireRole([
    ROLES.ADMINISTRATOR,
    ROLES.GENERAL_MANAGER,
    ROLES.PRODUCTION_MANAGER,
    ROLES.HEAD_OF_OPERATIONS,
    ROLES.SUPERVISOR,
    ROLES.DESIGN_TEAM,
  ]);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const isAdministrator = !!user && user.role === ROLES.ADMINISTRATOR;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // ─── Create form state ────────────────────────────────────────────────
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ZohoItem | null>(null);
  const [productType, setProductType] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderTypeMode, setOrderTypeMode] = useState<
    "MAKE_TO_STOCK" | "MAKE_TO_ORDER" | ""
  >("");
  const [priority, setPriority] = useState("MEDIUM");
  const [notes, setNotes] = useState("");
  // Sales order sub-state
  const [soSearch, setSoSearch] = useState("");
  const [selectedSalesOrder, setSelectedSalesOrder] =
    useState<SalesOrder | null>(null);
  const [selectedLineItem, setSelectedLineItem] =
    useState<SalesOrderLineItem | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Zoho items query for product/SKU search ──────────────────────────
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedItemSearch(itemSearch), 300);
    return () => clearTimeout(t);
  }, [itemSearch]);

  // Only composite items can be assembled in Zoho Books, so restrict the
  // direct PO picker to composites only (not plain inventory items).
  const { data: zohoItems = [] } = useQuery<ZohoItem[]>({
    queryKey: ["zoho-composite-items", debouncedItemSearch],
    queryFn: async () => {
      const res = await api.get("/zoho/composite-items", {
        params: { page: 1, per_page: 200 },
      });
      const raw = (res.data?.items ?? []) as Array<{
        composite_item_id?: string;
        item_id?: string;
        name?: string;
        sku?: string;
        rate?: number;
      }>;
      const mapped: ZohoItem[] = raw.map((c) => ({
        itemId: String(c.composite_item_id ?? c.item_id ?? ""),
        name: c.name,
        itemName: c.name,
        sku: c.sku,
        rate: c.rate,
      }));
      const q = debouncedItemSearch.trim().toLowerCase();
      if (!q) return mapped;
      return mapped.filter(
        (it) =>
          (it.name ?? "").toLowerCase().includes(q) ||
          (it.sku ?? "").toLowerCase().includes(q),
      );
    },
    enabled: showCreate,
    staleTime: 60_000,
  });

  // ─── Sales orders query ───────────────────────────────────────────────
  const { data: salesOrders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["sales-orders-for-create"],
    queryFn: async () => {
      const res = await api.get("/zoho/sales-orders", {
        params: { page: 1, per_page: 200 },
      });
      return res.data;
    },
    enabled: showCreate && orderTypeMode === "MAKE_TO_ORDER",
    staleTime: 60_000,
  });

  // ─── Sales order detail (line items) ──────────────────────────────────
  const { data: salesOrderDetail } = useQuery<{
    lineItems: SalesOrderLineItem[];
  }>({
    queryKey: ["sales-order-detail", selectedSalesOrder?.salesorderId],
    queryFn: async () => {
      const res = await api.get(
        `/zoho/sales-orders/${selectedSalesOrder!.salesorderId}`,
      );
      return res.data;
    },
    enabled: !!selectedSalesOrder,
    staleTime: 60_000,
  });

  const filteredSalesOrders = salesOrders.filter((so) => {
    const q = soSearch.toLowerCase();
    if (!q) return true;
    return (
      so.salesorderNumber.toLowerCase().includes(q) ||
      (so.customerName ?? "").toLowerCase().includes(q)
    );
  });

  const { data: paginatedData, isLoading } = useQuery<{
    items: ProductOrder[];
    total: number;
    page: number;
    pages: number;
  }>({
    queryKey: ["production-orders", page, debouncedSearch],
    queryFn: () =>
      api
        .get("/production-orders", {
          params: {
            page,
            limit: LIMIT,
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
        })
        .then((r) => {
          const d = r.data;
          if (Array.isArray(d))
            return { items: d, total: d.length, page, pages: 1 };
          return d;
        }),
  });

  function openCreate() {
    setSelectedItem(null);
    setItemSearch("");
    setProductType("");
    setProductCategory("");
    setQuantity("1");
    setOrderTypeMode("");
    setPriority("MEDIUM");
    setNotes("");
    setSoSearch("");
    setSelectedSalesOrder(null);
    setSelectedLineItem(null);
    setShowCreate(true);
  }

  function handleSelectItem(item: ZohoItem) {
    setSelectedItem(item);
    setItemSearch("");
  }

  function handleSelectLineItem(li: SalesOrderLineItem) {
    setSelectedLineItem(li);
    // Auto-fill product info from line item
    setSelectedItem({
      itemId: li.itemId,
      name: li.name,
      sku: li.sku,
      rate: li.rate,
    });
    if (li.quantity) setQuantity(String(li.quantity));
  }

  async function handleCreateOrder() {
    if (!selectedItem?.sku && !selectedItem?.name) {
      toast.error("Select a product");
      return;
    }
    if (!productType || !productCategory) {
      toast.error("Select product type and category");
      return;
    }
    if (!orderTypeMode) {
      toast.error("Select an order type");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setCreating(true);
    try {
      const sku = selectedItem.sku || selectedItem.name || "";
      const productName =
        selectedItem.name || selectedItem.itemName || selectedItem.sku || "";

      // Determine status: non-admin make-to-stock = DRAFT
      const status =
        orderTypeMode === "MAKE_TO_STOCK" && !isAdmin ? "DRAFT" : "PENDING";

      const body: Record<string, unknown> = {
        sku,
        productName,
        productType,
        productCategory,
        quantity: qty,
        orderType:
          orderTypeMode === "MAKE_TO_ORDER" ? "MAKE_TO_ORDER" : "MAKE_TO_STOCK",
        priority,
        notes: notes || undefined,
        status,
      };

      if (orderTypeMode === "MAKE_TO_ORDER" && selectedSalesOrder) {
        body.zohoBooksId = selectedSalesOrder.salesorderId;
      }

      const res = await api.post("/production-orders", body);
      qc.invalidateQueries({ queryKey: ["production-orders"] });

      if (status === "DRAFT") {
        toast.success(
          "Production order created as DRAFT — awaiting admin approval",
        );
      } else {
        toast.success("Production order created");
      }
      setShowCreate(false);
      router.push(`/production-orders/${res.data.id}`);
    } catch {
      toast.error("Failed to create order");
    } finally {
      setCreating(false);
    }
  }

  const orders = paginatedData?.items ?? [];
  const totalPages = paginatedData?.pages ?? 1;

  const hasMore = page < totalPages;

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.post("/production-orders/bulk-delete", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Orders deleted");
      setSelected(new Set());
      setShowBulkDelete(false);
    },
    onError: () => toast.error("Failed to delete orders"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/production-orders/${id}`, { status: "PENDING" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders"] });
      toast.success("Order approved");
    },
    onError: () => toast.error("Failed to approve order"),
  });

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {isAdministrator && selected.size > 0 && (
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
            className="shrink-0 gap-2 bg-teal-500 text-white hover:bg-teal-600"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-3">
                    {isAdministrator && (
                      <input
                        role="checkbox"
                        type="checkbox"
                        className="h-4 w-4"
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelected(new Set(orders.map((o) => o.id)));
                          else setSelected(new Set());
                        }}
                        checked={
                          orders.length > 0 &&
                          selected.size === orders.length
                        }
                      />
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Grand Total (₦)
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Skeleton className="ml-auto h-4 w-10" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-6 py-3">
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </td>
                      <td className="px-6 py-3" />
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-12 text-center text-zinc-400"
                    >
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer transition-colors hover:bg-zinc-50/60"
                      onClick={() =>
                        router.push(`/production-orders/${order.id}`)
                      }
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {isAdministrator && (
                          <input
                            role="checkbox"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selected.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                          />
                        )}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-zinc-500">
                        {order.sku}
                      </td>
                      <td className="px-6 py-3 font-medium text-zinc-900">
                        {order.productName}
                      </td>
                      <td className="px-6 py-3 text-zinc-500">
                        {order.productCategory}
                      </td>
                      <td className="px-6 py-3 text-zinc-500">
                        {order.productType}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {order.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[order.priority] ?? "bg-zinc-100 text-zinc-600"}`}
                        >
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${orderStatusColors[order.status ?? "PENDING"] ?? "bg-zinc-100 text-zinc-600"}`}
                          >
                            {order.status ?? "PENDING"}
                          </span>
                          {order.status === "DRAFT" && isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                approveMutation.mutate(order.id);
                              }}
                              className="rounded bg-teal-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-teal-600"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {parseFloat(order.grandTotal).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end">
                          <ChevronRight className="h-4 w-4 text-zinc-400" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3">
            <p className="text-sm text-zinc-500">
              Page {page} of {totalPages}
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

      {/* Create Order Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) setShowCreate(false);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Production Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Composite Product search */}
            <div className="space-y-1.5">
              <Label>
                Composite Product <span className="text-red-500">*</span>
              </Label>
              <p className="text-[11px] text-zinc-500">
                Only composite (assembly) items in Zoho Books can be produced.
              </p>
              {selectedItem ? (
                <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-800">
                      {selectedItem.name || selectedItem.itemName}
                    </p>
                    {selectedItem.sku && (
                      <p className="text-xs text-zinc-500 font-mono">
                        {selectedItem.sku}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setSelectedItem(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Search composite items by name or SKU..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                  {zohoItems.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white">
                      {zohoItems.map((item, idx) => (
                        <button
                          key={item.itemId || item.sku || idx}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 border-b border-zinc-50 last:border-0"
                          onClick={() => handleSelectItem(item)}
                        >
                          <span className="font-medium">
                            {item.name || item.itemName}
                          </span>
                          {item.sku && (
                            <span className="ml-2 text-xs text-zinc-400 font-mono">
                              {item.sku}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product Type & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Product Type <span className="text-red-500">*</span>
                </Label>
                <Select value={productType} onValueChange={(v) => setProductType(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRANDED">Branded</SelectItem>
                    <SelectItem value="PLAIN">Plain</SelectItem>
                    <SelectItem value="GENERIC">Generic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Product Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={productCategory}
                  onValueChange={(v) => setProductCategory(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAGS">Bags</SelectItem>
                    <SelectItem value="BOXES">Boxes</SelectItem>
                    <SelectItem value="CUPS">Cups</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantity & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? "MEDIUM")}>
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

            {/* Order Type */}
            <div className="space-y-1.5">
              <Label>
                Order Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={orderTypeMode}
                onValueChange={(v) => {
                  setOrderTypeMode(v as "MAKE_TO_STOCK" | "MAKE_TO_ORDER");
                  if (v !== "MAKE_TO_ORDER") {
                    setSelectedSalesOrder(null);
                    setSelectedLineItem(null);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select order type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAKE_TO_STOCK">Make to Stock</SelectItem>
                  <SelectItem value="MAKE_TO_ORDER">Make to Order</SelectItem>
                </SelectContent>
              </Select>
              {orderTypeMode === "MAKE_TO_STOCK" && !isAdmin && (
                <p className="text-xs text-amber-600">
                  This order will be created as a draft and requires admin
                  approval.
                </p>
              )}
            </div>

            {/* Sales Order selection */}
            {orderTypeMode === "MAKE_TO_ORDER" && (
              <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="space-y-1.5">
                  <Label>Sales Order</Label>
                  <Select
                    value={selectedSalesOrder?.salesorderId ?? ""}
                    onValueChange={(v) => {
                      const so = salesOrders.find(
                        (s) => s.salesorderId === v,
                      );
                      setSelectedSalesOrder(so ?? null);
                      setSelectedLineItem(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sales order">
                        {selectedSalesOrder
                          ? `${selectedSalesOrder.salesorderNumber} — ${selectedSalesOrder.customerName ?? ""}`
                          : "Select sales order"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      showSearch
                      searchValue={soSearch}
                      onSearchChange={setSoSearch}
                      searchPlaceholder="Search by order # or customer..."
                    >
                      {filteredSalesOrders.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-zinc-400">
                          No sales orders found
                        </div>
                      ) : (
                        filteredSalesOrders.map((so) => (
                          <SelectItem
                            key={so.salesorderId}
                            value={so.salesorderId}
                          >
                            {so.salesorderNumber} — {so.customerName ?? ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Line item selection */}
                {selectedSalesOrder && salesOrderDetail?.lineItems && (
                  <div className="space-y-1.5">
                    <Label>Line Item to Produce</Label>
                    <Select
                      value={selectedLineItem?.lineItemId ?? ""}
                      onValueChange={(v) => {
                        const li = salesOrderDetail.lineItems.find(
                          (l) => l.lineItemId === v,
                        );
                        if (li) handleSelectLineItem(li);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select line item">
                          {selectedLineItem
                            ? `${selectedLineItem.name}${selectedLineItem.sku ? ` (${selectedLineItem.sku})` : ""} — Qty: ${selectedLineItem.quantity ?? 0}`
                            : "Select line item"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {salesOrderDetail.lineItems.map((li) => (
                          <SelectItem
                            key={li.lineItemId}
                            value={li.lineItemId}
                          >
                            {li.name}
                            {li.sku ? ` (${li.sku})` : ""} — Qty:{" "}
                            {li.quantity ?? 0}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>
                Notes <span className="text-zinc-400">(optional)</span>
              </Label>
              <Input
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={creating}
              className="bg-teal-500 text-white hover:bg-teal-600"
            >
              {creating ? "Creating..." : "Create Order"}
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
            <DialogTitle>Delete selected orders</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-zinc-600">
              Are you sure you want to delete {selected.size} production
              order(s)? This action cannot be undone.
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
