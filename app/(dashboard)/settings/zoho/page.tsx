"use client";

import { useRequireRole, ROLES } from "@/lib/rbac";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import { toast } from "sonner";

interface ZohoStatus {
  connected: boolean;
  expiresAt?: string;
}

export default function ZohoSettingsPage() {
  useRequireRole([ROLES.ADMINISTRATOR]);
  const [connecting, setConnecting] = useState(false);

  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery<ZohoStatus>({
    queryKey: ["zoho-status"],
    queryFn: async () => {
      const res = await api.get("/zoho/status");
      return res.data;
    },
  });

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await api.get<{ authUrl: string }>("/zoho/oauth");
      window.location.href = res.data.authUrl;
    } catch {
      toast.error("Failed to initiate Zoho OAuth. Check your configuration.");
      setConnecting(false);
    }
  }

  const isExpired =
    status?.connected && status.expiresAt
      ? new Date() >= new Date(status.expiresAt)
      : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Zoho Books</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect your Zoho Books account to sync sales orders.
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-zinc-400" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ) : status?.connected ? (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                {isExpired ? (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-zinc-900">
                  {isExpired ? "Token Expired" : "Connected"}
                </p>
                <p className="text-sm text-zinc-500">
                  {isExpired
                    ? "Your access token has expired. Reconnect to resume syncing."
                    : status.expiresAt
                      ? `Access token valid until ${new Date(status.expiresAt).toLocaleString()}`
                      : "Zoho Books account is connected."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                <AlertCircle className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">Not connected</p>
                <p className="text-sm text-zinc-500">
                  No Zoho Books account is linked. Click Connect to start the
                  OAuth flow.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
            >
              <ExternalLink className="h-4 w-4" />
              {status?.connected ? "Reconnect" : "Connect Zoho Books"}
            </button>

            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Status
            </button>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-zinc-600">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-600">
                1
              </span>
              Click <strong>Connect Zoho Books</strong> to be redirected to the
              Zoho authorization page.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-600">
                2
              </span>
              Log in and grant permission for this app to access your Zoho Books
              data.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-600">
                3
              </span>
              You will be redirected back here and sales orders will become
              available immediately.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
