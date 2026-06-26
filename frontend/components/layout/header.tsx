"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Sun, Moon, Check } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MobileSidebar from "./mobile-sidebar";
import { applyTheme, getInitialTheme, setTheme } from "@/lib/theme";
import api from "@/lib/api";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inventory": "Inventory",
  "/production-orders": "Production Orders",
  "/sales-orders": "Sales Orders",
  "/users": "Users",
  "/tasks": "Production Tasks",
  "/customer-care": "Customer Care",
  "/reports": "Reports",
  "/factory-activity": "Factory Activity",
  "/machinery": "Machinery",
  "/vendors": "Vendors",
  "/audit-logs": "Audit Trail",
  "/locations": "Locations",
  "/settings/zoho": "Zoho Settings",
  "/settings/zoho/gap-analysis": "Zoho Gap Analysis",
  "/help": "Help",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [key, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(key + "/")) return title;
  }
  return "TPPC Manufacturing";
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [theme, setThemeState] = useState<"light" | "dark">(() =>
    getInitialTheme(),
  );

  useEffect(() => {
    // ensure the initial theme is applied on mount
    applyTheme(theme);
  }, [theme]);

  // Close notif dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return res.data?.count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery<
    { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; metadata?: string }[]
  >({
    queryKey: ["notifications-list"],
    queryFn: async () => {
      const res = await api.get("/notifications", { params: { limit: 20 } });
      return res.data?.items ?? [];
    },
    enabled: notifOpen,
    refetchInterval: notifOpen ? 15_000 : false,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  function handleNotifClick(n: { id: string; read: boolean; metadata?: string }) {
    if (!n.read) markReadMut.mutate(n.id);
    // Navigate to relevant page if metadata has orderId
    try {
      const meta = n.metadata ? JSON.parse(n.metadata) : null;
      if (meta?.orderId) {
        router.push(`/production-orders/${meta.orderId}`);
        setNotifOpen(false);
      }
    } catch { /* ignore parse error */ }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-6">
      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger aria-label="Open menu">
              <div className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <Menu className="h-4 w-4" />
              </div>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <MobileSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          {getPageTitle(pathname)}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next);
            setThemeState(next);
          }}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <span className="relative inline-flex h-4 w-4">
            <Sun
              className={`absolute left-0 top-0 h-4 w-4 transform transition-all duration-300 ${
                theme === "dark"
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 -translate-y-1 scale-75"
              }`}
            />
            <Moon
              className={`absolute left-0 top-0 h-4 w-4 transform transition-all duration-300 ${
                theme === "dark"
                  ? "opacity-0 translate-y-1 scale-75"
                  : "opacity-100 translate-y-0 scale-100"
              }`}
            />
          </span>
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
                <span className="text-sm font-semibold text-zinc-800">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMut.mutate()}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-zinc-400">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`w-full border-b border-zinc-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-zinc-50 ${
                        !n.read ? "bg-teal-50/40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">
                            {n.title}
                          </p>
                          <p className="text-xs text-zinc-500 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-400">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-[10px] font-semibold text-white">
          {user?.firstName?.[0] ?? ""}
          {user?.lastName?.[0] ?? ""}
        </div>
      </div>
    </header>
  );
}
