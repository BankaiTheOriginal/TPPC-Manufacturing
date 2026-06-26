"use client";

import { useRouter, usePathname } from "next/navigation";
import { Factory, LogOut } from "lucide-react";
import { navItems } from "./sidebar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { canAccess } from "@/lib/rbac";
import { roleLabels } from "@/lib/user-role-display";

export default function MobileSidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const visibleNavItems = navItems.filter((item) =>
    canAccess(user?.role ?? "", item.href),
  );

  function handleNavigate(href: string) {
    router.push(href);
    onNavigate?.();
  }

  function handleLogout() {
    logout();
    router.replace("/login");
    onNavigate?.();
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0f172a]">
      <div className="flex items-center gap-3 border-b border-slate-700/50 px-5 py-[18px]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-500">
          <Factory className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">
            TPPC
          </p>
          <p className="truncate text-[11px] text-slate-400">Manufacturing</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <button
                  onClick={() => handleNavigate(item.href)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-slate-700/60 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active
                        ? "text-teal-400"
                        : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  {item.label}
                  {active && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-700/50 px-3 py-3">
        <div className="mb-1 px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-200">
            {user ? `${user.firstName} ${user.lastName}` : "—"}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {roleLabels[user?.role ?? ""] ?? user?.role?.replace(/_/g, " ") ?? ""}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition-all hover:bg-slate-800 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}
