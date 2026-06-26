"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, User } from "@/lib/stores/auth-store";
import axios from "axios";

export default function Home() {
  const router = useRouter();
  const { token, _hasHydrated, setAuth, logout } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      if (!_hasHydrated) return;

      if (token) {
        router.replace("/dashboard");
        return;
      }
      try {
        const { data } = await axios.post<{ access_token: string; user: User }>(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        setAuth(data.access_token, data.user);
        router.replace("/dashboard");
      } catch {
        logout();
        router.replace("/login");
      }
    }

    checkAuth();
  }, [_hasHydrated, token, router, setAuth, logout]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.97_0.004_250)]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-teal-500" />
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
