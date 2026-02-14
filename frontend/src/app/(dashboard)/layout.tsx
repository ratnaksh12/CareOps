"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import type { AuthResponse } from "@/types";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, isLoading, setAuth, logout, setLoading } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [onboardingChecked, setOnboardingChecked] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("careops_token");
        if (!token) {
            setLoading(false);
            router.push("/login");
            return;
        }

        api
            .get<AuthResponse["user"]>("/auth/me")
            .then(async (user) => {
                setAuth(
                    {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role as "admin" | "staff",
                        workspace_id: user.workspace_id,
                    },
                    token
                );

                // Check onboarding status — redirect if incomplete
                if (user.workspace_id && pathname !== "/onboarding") {
                    try {
                        const ws = await api.get<any>("/workspaces/current");
                        if (ws && ws.onboarding_step < 8 && !ws.is_active) {
                            router.push("/onboarding");
                            return;
                        }
                    } catch {
                        // If no workspace, send to onboarding
                        router.push("/onboarding");
                        return;
                    }
                } else if (!user.workspace_id && pathname !== "/onboarding") {
                    router.push("/onboarding");
                    return;
                }

                setOnboardingChecked(true);
            })
            .catch(() => {
                logout();
                router.push("/login");
            });
    }, []);

    if (isLoading || (!onboardingChecked && pathname !== "/onboarding")) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
                    <p className="text-sm text-zinc-500">Loading CareOps...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-zinc-950">
            <Sidebar />
            <main className="flex-1 lg:pl-64">
                <div className="p-6 lg:p-8">{children}</div>
            </main>
        </div>
    );
}

