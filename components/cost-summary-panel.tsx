"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { STAGE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Layers, Package } from "lucide-react";

interface StageCost {
  stage: string;
  stageName: string;
  serviceSku: string;
  totalCost: number;
}

interface CostSummaryData {
  orderId: string;
  productName: string;
  sku: string;
  quantity: number;
  materials: {
    items: { name: string; quantity: number; unitPrice: string; totalPrice: string }[];
    total: number;
  };
  operations: {
    stages: StageCost[];
    total: number;
  };
  labour: number;
  grandTotal: number;
  perUnit: number;
  materialVsOps: {
    materialPercent: number;
    operationsPercent: number;
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(n);
}

export function CostSummaryPanel({ orderId }: { orderId: string }) {
  const { data, isLoading } = useQuery<CostSummaryData>({
    queryKey: ["cost-summary", orderId],
    queryFn: async () => {
      const res = await api.get(`/production-orders/${orderId}/cost-summary`);
      return res.data;
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Grand Total" value={fmt(data.grandTotal)} />
          <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Per Unit" value={fmt(data.perUnit)} />
          <KpiCard icon={<Package className="h-4 w-4" />} label="Materials" value={fmt(data.materials.total)} />
          <KpiCard icon={<Layers className="h-4 w-4" />} label="Operations" value={fmt(data.operations.total)} />
        </div>

        {/* Material vs Operations split */}
        <div>
          <p className="text-xs text-zinc-500 mb-1">Material vs Operations Split</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100">
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${data.materialVsOps.materialPercent}%` }}
              title={`Materials: ${data.materialVsOps.materialPercent}%`}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${data.materialVsOps.operationsPercent}%` }}
              title={`Operations: ${data.materialVsOps.operationsPercent}%`}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              Materials {data.materialVsOps.materialPercent}%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              Operations {data.materialVsOps.operationsPercent}%
            </span>
          </div>
        </div>

        {/* Per-stage breakdown */}
        {data.operations.stages.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-2">Stage Breakdown</p>
            <div className="space-y-1">
              {data.operations.stages.map((s) => (
                <div key={s.stage} className="flex justify-between text-sm">
                  <span className="text-zinc-600">
                    {STAGE_LABELS[s.stage] ?? s.stage}
                  </span>
                  <span className="font-medium tabular-nums">
                    {s.totalCost > 0 ? fmt(s.totalCost) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Labour */}
        {data.labour > 0 && (
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-zinc-600">Labour Cost</span>
            <span className="font-medium tabular-nums">{fmt(data.labour)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
