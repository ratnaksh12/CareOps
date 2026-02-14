import { create } from "zustand";

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: "admin" | "staff";
    workspace_id: string | null;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: typeof window !== "undefined" ? localStorage.getItem("careops_token") : null,
    isAuthenticated: false,
    isLoading: true,

    setAuth: (user, token) => {
        localStorage.setItem("careops_token", token);
        set({ user, token, isAuthenticated: true, isLoading: false });
    },

    logout: () => {
        localStorage.removeItem("careops_token");
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    },

    setLoading: (loading) => set({ isLoading: loading }),
}));
