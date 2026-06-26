"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ZohoSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900">
          Zoho Books Connected
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Your Zoho Books account has been successfully connected. Sales orders
          will now sync automatically.
        </p>
        <Link
          href="/settings/zoho"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-600"
        >
          Go to Zoho Settings
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
