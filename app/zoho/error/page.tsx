"use client";

import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const message = params.get("message") ?? "An unknown error occurred.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900">
          Connection Failed
        </h1>
        <p className="mb-2 text-sm text-zinc-500">
          Could not connect your Zoho Books account.
        </p>
        <p className="mb-6 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-600 font-mono">
          {message}
        </p>
        <Link
          href="/settings/zoho"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Zoho Settings
        </Link>
      </div>
    </div>
  );
}

export default function ZohoErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
