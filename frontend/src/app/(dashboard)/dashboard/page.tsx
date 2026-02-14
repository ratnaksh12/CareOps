"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
    Calendar,
    Users,
    MessageSquare,
    FileText,
    Package,
    AlertTriangle,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import type { DashboardStats } from "@/types";
import { VoiceAssistant } from "@/components/dashboard/voice-assistant";

function StatCard({
    title,
    value,
    icon: Icon,
    description,
    trend,
    href,
    color = "violet",
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    trend?: string;
    href?: string;
    color?: string;
}) {
    const iconColors: Record<string, string> = {
        violet: "text-violet-400 bg-violet-400/10",
        blue: "text-blue-400 bg-blue-400/10",
        emerald: "text-emerald-400 bg-emerald-400/10",
        amber: "text-amber-400 bg-amber-400/10",
        rose: "text-rose-400 bg-rose-400/10",
        cyan: "text-cyan-400 bg-cyan-400/10",
    };

    const content = (
        <Card className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all duration-200 h-full group">
            <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-zinc-400">{title}</p>
                        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
                    </div>
                    <div className={`rounded-xl p-2.5 transition-colors ${iconColors[color]}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
                {(description || trend) && (
                    <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between text-xs">
                        {description && <span className="text-zinc-500">{description}</span>}
                        {trend && (
                            <div className="flex items-center gap-1 text-emerald-400">
                                <TrendingUp className="h-3 w-3" />
                                {trend}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link href={href} className="block h-full cursor-pointer">{content}</Link>;
    }
    return <div className="h-full">{content}</div>;
}

export default function DashboardPage() {
    const { data: stats, isLoading } = useQuery<DashboardStats>({
        queryKey: ["dashboard-stats"],
        queryFn: () => api.get("/dashboard/stats"),
        refetchInterval: 5000,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-zinc-400 mt-1">Welcome back — here&apos;s your operations overview</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="border-zinc-800 bg-zinc-900/50">
                            <CardContent className="p-5">
                                <Skeleton className="h-4 w-20 bg-zinc-800" />
                                <Skeleton className="h-8 w-16 mt-2 bg-zinc-800" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    const s = stats || {
        bookings_today: 0,
        bookings_upcoming: 0,
        completion_rate: 0,
        no_shows: 0,
        new_leads: 0,
        open_conversations: 0,
        unanswered_messages: 0,
        forms_pending: 0,
        forms_overdue: 0,
        forms_completed: 0,
        low_stock_items: 0,
        critical_items: 0,
        recent_alerts: [],
    };

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-zinc-400 mt-1">
                        Overview for {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <VoiceAssistant stats={s} />
                    <Button
                        variant="outline"
                        className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all font-medium"
                        onClick={() => {
                            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
                            const url = `${window.location.origin}${basePath}/public/lead`;
                            navigator.clipboard.writeText(url);
                            alert("Lead Form Link Copied!");
                        }}
                    >
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Lead Form
                    </Button>
                </div>
            </div>

            {/* Key Metrics Grid - Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard
                    title="Today's Bookings"
                    value={s.bookings_today}
                    icon={Calendar}
                    color="violet"
                    href="/bookings"
                    description="Scheduled for today"
                />
                <StatCard
                    title="Upcoming"
                    value={s.bookings_upcoming}
                    icon={Clock}
                    color="blue"
                    href="/bookings"
                    description="Next 7 days"
                />
                <StatCard
                    title="New Leads"
                    value={s.new_leads}
                    icon={Users}
                    color="cyan"
                    description="Last 7 days"
                />
                <StatCard
                    title="Action Items"
                    value={s.unanswered_messages + s.forms_overdue}
                    icon={AlertTriangle}
                    color={s.unanswered_messages + s.forms_overdue > 0 ? "rose" : "emerald"}
                    href="/inbox"
                    description="Unanswered & Overdue"
                />
            </div>

            {/* Main Content Split */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column: Operations (2/3 width) */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Activity Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-blue-500" />
                                    Inbox Health
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-2xl font-bold text-white">{s.open_conversations}</span>
                                        <p className="text-xs text-zinc-500">Open</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className={`text-2xl font-bold ${s.unanswered_messages > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                            {s.unanswered_messages}
                                        </span>
                                        <p className="text-xs text-zinc-500">Unanswered</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-2xl font-bold text-white">{s.completion_rate}%</span>
                                        <p className="text-xs text-zinc-500">Completion</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-2xl font-bold text-zinc-200">{s.no_shows}</span>
                                        <p className="text-xs text-zinc-500">No-Shows</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Alerts Panel */}
                    <Card className="border-zinc-800 bg-zinc-900/50 h-full">
                        <CardHeader className="border-b border-zinc-800/50 pb-4">
                            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Recent Activity & Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {s.recent_alerts.length > 0 ? (
                                <div className="divide-y divide-zinc-800/50">
                                    {s.recent_alerts.slice(0, 5).map((alert) => (
                                        <Link
                                            key={alert.id}
                                            href={alert.link_to || "#"}
                                            className="flex items-start gap-4 px-6 py-4 hover:bg-zinc-800/50 transition-colors group"
                                        >
                                            <div className={`mt-1 h-2 w-2 rounded-full ${alert.severity === 'critical' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                                                    {alert.title}
                                                </p>
                                                <p className="text-xs text-zinc-500 mt-0.5 truncate">{alert.message}</p>
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-zinc-500 text-sm">
                                    No recent alerts.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Status Trackers (Forms & Inventory) */}
                <div className="space-y-6">

                    {/* Forms */}
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                Forms Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <Clock className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300">Pending</span>
                                </div>
                                <span className="text-lg font-bold text-white">{s.forms_pending}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300">Overdue</span>
                                </div>
                                <span className="text-lg font-bold text-white">{s.forms_overdue}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300">Completed</span>
                                </div>
                                <span className="text-lg font-bold text-white">{s.forms_completed}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inventory */}
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <Package className="h-4 w-4 text-amber-500" />
                                Inventory Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300">Low Stock</span>
                                </div>
                                <span className="text-lg font-bold text-white">{s.low_stock_items}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                                        <XCircle className="h-4 w-4 text-rose-500" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-300">Critical</span>
                                </div>
                                <span className="text-lg font-bold text-white">{s.critical_items}</span>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
