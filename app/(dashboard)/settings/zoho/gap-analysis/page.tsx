"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Wand2,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { toast } from "sonner";

type MatchType =
  | "exact"
  | "case-insensitive"
  | "partial"
  | "sku"
  | "none";

interface PaperGap {
  paperType: string;
  expectedName: string;
  expectedSku: string | null;
  sourceSheetSize: string;
  costPerSheet: number | null;
  found: boolean;
  matchType: MatchType;
  zohoItemId?: string;
  zohoItemName?: string;
  zohoSku?: string;
  stockOnHand?: number | null;
  availableStock?: number | null;
}

interface ServiceGap {
  stage: string;
  stageLabel: string;
  expectedName: string;
  expectedSku: string;
  found: boolean;
  matchType: MatchType;
  zohoItemId?: string;
  zohoItemName?: string;
  zohoSku?: string;
  stockOnHand?: number | null;
  availableStock?: number | null;
}

interface CompositeRow {
  compositeItemId: string;
  name: string;
  sku: string | null;
  rate: number | null;
  stockOnHand?: number | null;
  availableStock?: number | null;
  actualAvailableStock?: number | null;
}

interface GapAnalysis {
  summary: {
    zohoItemCount: number;
    compositeItemCount: number;
    papersTotal: number;
    papersFound: number;
    papersMissing: number;
    servicesTotal: number;
    servicesFound: number;
    servicesMissing: number;
  };
  papers: PaperGap[];
  services: ServiceGap[];
  compositeItems: CompositeRow[];
}

function MatchBadge({ found, matchType }: { found: boolean; matchType: MatchType }) {
  if (found && matchType === "exact") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Exact match
      </span>
    );
  }
  if (found && matchType === "sku") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> SKU match
      </span>
    );
  }
  if (found && matchType === "case-insensitive") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Name match
      </span>
    );
  }
  if (matchType === "partial") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        <AlertCircle className="h-3 w-3" /> Partial — likely mismatch
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" /> Missing
    </span>
  );
}

export default function ZohoGapAnalysisPage() {
  useRequireRole([ROLES.ADMINISTRATOR]);
  const qc = useQueryClient();
  const [paperFilter, setPaperFilter] = useState("");
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery<GapAnalysis>({
    queryKey: ["zoho-gap-analysis"],
    queryFn: async () => {
      const res = await api.get("/zoho/gap-analysis");
      return res.data;
    },
    staleTime: 60_000,
  });

  const createServicesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/zoho/items/sync-operation-services");
      return res.data;
    },
    onSuccess: (result) => {
      const created = result?.created ?? 0;
      const synced = result?.synced ?? 0;
      toast.success(
        `Sync complete — ${created} created, ${synced} verified in Zoho`,
      );
      qc.invalidateQueries({ queryKey: ["zoho-gap-analysis"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to sync service items";
      toast.error(message);
    },
  });

  const filteredPapers = useMemo(() => {
    if (!data?.papers) return [];
    return data.papers.filter((p) => {
      if (showOnlyMissing && p.found) return false;
      if (paperFilter) {
        const q = paperFilter.toLowerCase();
        return (
          p.expectedName.toLowerCase().includes(q) ||
          p.paperType.toLowerCase().includes(q) ||
          (p.zohoItemName ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.papers, paperFilter, showOnlyMissing]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Zoho Books — Gap Analysis
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Compare the materials and operation services defined in this app
            against what currently exists in your Zoho Books org. Missing items
            will cause assembly creation to fail.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Papers found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">
              {isLoading
                ? "—"
                : `${data?.summary.papersFound}/${data?.summary.papersTotal}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Papers missing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">
              {isLoading ? "—" : data?.summary.papersMissing}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Services missing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">
              {isLoading ? "—" : data?.summary.servicesMissing}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500">
              Zoho items / composites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-zinc-700">
              {isLoading
                ? "—"
                : `${data?.summary.zohoItemCount} / ${data?.summary.compositeItemCount}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Operation Services</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              These are required service items in Zoho. The app can create any
              missing ones automatically.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => createServicesMutation.mutate()}
            disabled={
              createServicesMutation.isPending ||
              isLoading ||
              data?.summary.servicesMissing === 0
            }
          >
            <Wand2 className="mr-2 h-3.5 w-3.5" />
            {createServicesMutation.isPending
              ? "Syncing..."
              : "Create missing services in Zoho"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Stage</th>
                    <th className="py-2 pr-3">Expected name</th>
                    <th className="py-2 pr-3">Expected SKU</th>
                    <th className="py-2 pr-3">Match</th>
                    <th className="py-2 pr-3">Zoho item</th>
                    <th className="py-2 pr-3 text-right">Zoho stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data?.services.map((s) => (
                    <tr key={s.stage}>
                      <td className="py-2 pr-3 font-medium text-zinc-800">
                        {s.stageLabel}
                      </td>
                      <td className="py-2 pr-3 text-zinc-700">{s.expectedName}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-zinc-500">
                        {s.expectedSku}
                      </td>
                      <td className="py-2 pr-3">
                        <MatchBadge found={s.found} matchType={s.matchType} />
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-600">
                        {s.zohoItemName ? (
                          <>
                            <span>{s.zohoItemName}</span>
                            {s.zohoSku && (
                              <span className="ml-2 text-zinc-400 font-mono">
                                {s.zohoSku}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right text-xs text-zinc-600">
                        {s.stockOnHand != null ? s.stockOnHand : <span className="text-zinc-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Papers */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Papers / Materials</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              The app expects each of these to exist as an inventory item in
              Zoho Books (matched by name). Create missing ones manually in
              Zoho with the same name.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={showOnlyMissing}
                onChange={(e) => setShowOnlyMissing(e.target.checked)}
              />
              Show only gaps
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Filter..."
                value={paperFilter}
                onChange={(e) => setPaperFilter(e.target.value)}
                className="h-8 w-44 pl-7 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Paper</th>
                    <th className="py-2 pr-3">Source sheet</th>
                    <th className="py-2 pr-3">Cost/sheet</th>
                    <th className="py-2 pr-3">Match</th>
                    <th className="py-2 pr-3">Zoho item</th>
                    <th className="py-2 pr-3 text-right">Zoho stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredPapers.map((p) => (
                    <tr key={p.paperType}>
                      <td className="py-2 pr-3 font-medium text-zinc-800">
                        {p.expectedName}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {p.sourceSheetSize}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {p.costPerSheet ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <MatchBadge found={p.found} matchType={p.matchType} />
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-600">
                        {p.zohoItemName ? (
                          <>
                            <span>{p.zohoItemName}</span>
                            {p.zohoSku && (
                              <span className="ml-2 text-zinc-400 font-mono">
                                {p.zohoSku}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right text-xs text-zinc-600">
                        {p.stockOnHand != null ? p.stockOnHand : <span className="text-zinc-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && filteredPapers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-zinc-400">
                        No papers match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Composite items (read-only reference) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composite items in Zoho</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">
            These are the composite (assembly) items available in your Zoho org.
            Only composite items can be produced via a production order.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-zinc-200 bg-white text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3 text-right">Rate</th>
                    <th className="py-2 pr-3 text-right">Stock on hand</th>
                    <th className="py-2 pr-3 text-right">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data?.compositeItems.map((c) => (
                    <tr key={c.compositeItemId}>
                      <td className="py-2 pr-3 text-zinc-800">{c.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-zinc-500">
                        {c.sku ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-zinc-600">
                        {c.rate ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-zinc-700">
                        {c.stockOnHand != null ? c.stockOnHand : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-right text-zinc-600">
                        {c.availableStock != null ? c.availableStock : <span className="text-zinc-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && (data?.compositeItems ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-zinc-400">
                        No composite items found in the connected Zoho org.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
