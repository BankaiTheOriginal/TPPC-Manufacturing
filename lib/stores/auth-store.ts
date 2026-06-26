import { create } from "zustand";
import { persist } from "zustand/middleware";
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  jobTitle?: string | null;
  department?: string | null;
  phoneNumber?: string | null;
  reportingLine?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user, _hasHydrated: true }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "tppc-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
