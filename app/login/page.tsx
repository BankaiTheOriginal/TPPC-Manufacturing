"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuthStore, User } from "@/lib/stores/auth-store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      const res = await api.post<{ access_token: string; user: User }>(
        "/auth/login",
        data,
      );
      setAuth(res.data.access_token, res.data.user);
      router.replace("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: brand ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 lg:flex lg:w-[52%]">
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #9ca3af 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Ambient glows */}
        <div className="absolute -bottom-48 -left-48 h-140 w-140 rounded-full bg-teal-500/20 blur-[110px]" />
        <div className="absolute right-8 top-16 h-55 w-55 rounded-full bg-teal-400/10 blur-[80px]" />

        {/* Wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 shadow-lg shadow-teal-500/40">
            <span className="text-sm font-extrabold tracking-tight text-white">
              T
            </span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            TPPC Manufacturing
          </span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400">
            Production Management System
          </p>
          <h2 className="text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white">
            Manufacturing
            <br />
            Excellence,
            <br />
            <span className="text-teal-400">Delivered.</span>
          </h2>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-zinc-400">
            Streamlining every stage of production — from order intake to final
            delivery. Real-time visibility across your entire manufacturing
            floor.
          </p>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-zinc-600">
          © {new Date().getFullYear()} Excellium Business Ltd. All rights
          reserved.
        </p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-16">
        {/* Mobile wordmark */}
        <div className="mb-10 flex flex-col items-center gap-2.5 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500 shadow-lg shadow-teal-400/30">
            <span className="text-xl font-extrabold text-white">T</span>
          </div>
          <span className="text-base font-semibold text-zinc-800">
            TPPC Manufacturing
          </span>
        </div>

        <div className="w-full max-w-90">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Email address
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-md border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                placeholder="you@tppc.com"
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                type="password"
                {...register("password")}
                className="w-full rounded-md border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-xs text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-teal-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/25 transition hover:bg-teal-600 active:scale-[0.99] disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-zinc-400">
            © {new Date().getFullYear()} Excellium Business Ltd.
          </p>
        </div>
      </div>
    </div>
  );
}
