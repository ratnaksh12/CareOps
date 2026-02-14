"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Inbox,
    Calendar,
    CalendarDays,
    FileText,
    Package,
    Settings,
    LogOut,
    Menu,
    X,
    Zap,
    Users,
    Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/bookings", label: "Bookings", icon: Calendar },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/forms", label: "Forms", icon: FileText },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/staff", label: "Staff", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();
    const [collapsed, setCollapsed] = useState(false);

    // Fetch onboarding status to disable navigation if not active
    const { data: onboardingStatus } = useQuery({
        queryKey: ["onboarding-status"],
        queryFn: () => api.get<any>("/workspaces/onboarding-status"),
        enabled: !!user?.workspace_id,
    });

    const isActivated = onboardingStatus?.steps_completed?.step_8 === true;

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity",
                    collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
                onClick={() => setCollapsed(true)}
            />

            {/* Mobile toggle */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 lg:hidden"
                onClick={() => setCollapsed(!collapsed)}
            >
                {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </Button>

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen w-64 border-r border-zinc-800 bg-zinc-950 transition-transform duration-300 lg:translate-x-0",
                    collapsed ? "-translate-x-full" : "translate-x-0"
                )}
            >
                <div className="flex h-full flex-col">
                    {/* Logo */}
                    <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                            <Zap className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">
                                CareOps
                            </h1>
                            <p className="text-[11px] text-zinc-500 font-medium">
                                Operations Platform
                            </p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-1 px-3 py-4">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                            const isDisabled = !isActivated && item.href !== "/onboarding";

                            if (isDisabled) {
                                return (
                                    <div
                                        key={item.href}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 cursor-not-allowed opacity-50"
                                        title="Complete onboarding to access"
                                    >
                                        <item.icon className="h-[18px] w-[18px] text-zinc-700" />
                                        {item.label}
                                        <Lock className="ml-auto h-3 w-3 text-zinc-700" />
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setCollapsed(true)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                        isActive
                                            ? "bg-violet-600/10 text-violet-400 shadow-sm"
                                            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-[18px] w-[18px]",
                                            isActive ? "text-violet-400" : "text-zinc-500"
                                        )}
                                    />
                                    {item.label}
                                    {isActive && (
                                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User section */}
                    <div className="border-t border-zinc-800 p-4">
                        <div className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xs font-bold text-white">
                                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-200 truncate">
                                    {user?.full_name || "User"}
                                </p>
                                <p className="text-[11px] text-zinc-500 truncate">
                                    {user?.role === "admin" ? "Admin" : "Staff"}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-red-400"
                                onClick={logout}
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
