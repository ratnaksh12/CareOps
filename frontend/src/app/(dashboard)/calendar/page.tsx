"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    User,
    Loader2,
} from "lucide-react";

interface Booking {
    id: string;
    booking_type_id: string;
    booking_type: { name: string; location: string } | null;
    contact_id: string;
    contact: { name: string; email: string; phone: string } | null;
    status: string;
    start_time: string;
    end_time: string;
    notes: string;
    created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
    scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    completed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    no_show: "bg-red-500/10 text-red-400 border-red-500/30",
    cancelled: "bg-orange-500/10 text-orange-400 border-orange-500/30",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<"month" | "day">("month");

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const { data: bookings = [], isLoading } = useQuery<Booking[]>({
        queryKey: ["bookings"],
        queryFn: () => api.get("/bookings"),
    });

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Group bookings by date
    const bookingsByDate = useMemo(() => {
        const map: Record<string, Booking[]> = {};
        bookings.forEach((b) => {
            const date = new Date(b.start_time).toDateString();
            if (!map[date]) map[date] = [];
            map[date].push(b);
        });
        return map;
    }, [bookings]);

    // Get bookings for selected date
    const selectedDateBookings = useMemo(() => {
        return bookings
            .filter((b) => new Date(b.start_time).toDateString() === selectedDate.toDateString())
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [bookings, selectedDate]);

    const navigateMonth = (dir: number) => {
        setCurrentDate(new Date(year, month + dir, 1));
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    };

    const isSelected = (day: number) => {
        return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
    };

    const formatTime = (isoStr: string) => {
        const d = new Date(isoStr);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <CalendarDays className="h-8 w-8 text-violet-400" />
                        Calendar
                    </h1>
                    <p className="text-zinc-400 mt-1">View all bookings in calendar format</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className={`border-zinc-700 ${view === "month" ? "bg-violet-600/20 text-violet-400" : "text-zinc-400"}`}
                        onClick={() => setView("month")}
                    >
                        Month
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`border-zinc-700 ${view === "day" ? "bg-violet-600/20 text-violet-400" : "text-zinc-400"}`}
                        onClick={() => setView("day")}
                    >
                        Day
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Grid */}
                <Card className="border-zinc-800 bg-zinc-900/50 lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                                <ChevronLeft className="h-5 w-5 text-zinc-400" />
                            </Button>
                            <CardTitle className="text-white text-xl">
                                {monthNames[month]} {year}
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                                <ChevronRight className="h-5 w-5 text-zinc-400" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {view === "month" ? (
                            <div>
                                {/* Day headers */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {dayNames.map((day) => (
                                        <div key={day} className="text-center text-xs font-medium text-zinc-500 py-2">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                {/* Calendar cells */}
                                <div className="grid grid-cols-7 gap-1">
                                    {/* Empty cells for first day offset */}
                                    {Array.from({ length: firstDay }, (_, i) => (
                                        <div key={`empty-${i}`} className="h-20 rounded-lg bg-zinc-900/30" />
                                    ))}
                                    {/* Day cells */}
                                    {Array.from({ length: daysInMonth }, (_, i) => {
                                        const day = i + 1;
                                        const dateStr = new Date(year, month, day).toDateString();
                                        const dayBookings = bookingsByDate[dateStr] || [];
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    setSelectedDate(new Date(year, month, day));
                                                    setView("day");
                                                }}
                                                className={`h-20 rounded-lg p-1.5 text-left transition-all border ${isSelected(day)
                                                        ? "border-violet-500 bg-violet-500/10"
                                                        : isToday(day)
                                                            ? "border-violet-500/50 bg-zinc-800/50"
                                                            : "border-transparent bg-zinc-800/30 hover:bg-zinc-800/60"
                                                    }`}
                                            >
                                                <span className={`text-xs font-medium ${isToday(day) ? "text-violet-400" : "text-zinc-400"
                                                    }`}>
                                                    {day}
                                                </span>
                                                <div className="mt-0.5 space-y-0.5">
                                                    {dayBookings.slice(0, 2).map((b) => (
                                                        <div
                                                            key={b.id}
                                                            className="text-[10px] truncate rounded px-1 py-0.5 bg-violet-500/15 text-violet-300"
                                                        >
                                                            {formatTime(b.start_time)} {b.contact?.name}
                                                        </div>
                                                    ))}
                                                    {dayBookings.length > 2 && (
                                                        <div className="text-[10px] text-zinc-500">
                                                            +{dayBookings.length - 2} more
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Day View */
                            <div className="space-y-1">
                                <div className="text-center mb-4">
                                    <p className="text-lg font-semibold text-white">
                                        {selectedDate.toLocaleDateString("en-US", {
                                            weekday: "long",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    {HOURS.map((hour) => {
                                        const hourBookings = selectedDateBookings.filter((b) => {
                                            const h = new Date(b.start_time).getHours();
                                            return h === hour;
                                        });
                                        return (
                                            <div key={hour} className="flex gap-3 min-h-[48px]">
                                                <div className="w-16 text-right text-xs text-zinc-500 pt-1 flex-shrink-0">
                                                    {hour <= 12 ? hour : hour - 12}:00 {hour < 12 ? "AM" : "PM"}
                                                </div>
                                                <div className="flex-1 border-l border-zinc-800 pl-3">
                                                    {hourBookings.map((b) => (
                                                        <div
                                                            key={b.id}
                                                            className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 mb-1"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-white">
                                                                    {b.contact?.name}
                                                                </span>
                                                                <Badge variant="outline" className={STATUS_COLORS[b.status] || ""}>
                                                                    {b.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {formatTime(b.start_time)} - {formatTime(b.end_time)}
                                                                </span>
                                                                {b.booking_type?.name && (
                                                                    <span>{b.booking_type.name}</span>
                                                                )}
                                                                {b.booking_type?.location && (
                                                                    <span className="flex items-center gap-1">
                                                                        <MapPin className="h-3 w-3" />
                                                                        {b.booking_type.location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Side panel — Selected Day Details */}
                <div className="space-y-4">
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="text-white text-sm">
                                {selectedDate.toLocaleDateString("en-US", {
                                    weekday: "long",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {selectedDateBookings.length === 0 ? (
                                <p className="text-zinc-500 text-sm py-4 text-center">
                                    No bookings on this day
                                </p>
                            ) : (
                                selectedDateBookings.map((b) => (
                                    <div
                                        key={b.id}
                                        className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3 space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-white flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-zinc-400" />
                                                {b.contact?.name || "Unknown"}
                                            </span>
                                            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[b.status] || ""}`}>
                                                {b.status}
                                            </Badge>
                                        </div>
                                        <div className="space-y-1 text-xs text-zinc-400">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                {formatTime(b.start_time)} - {formatTime(b.end_time)}
                                            </div>
                                            {b.booking_type?.name && (
                                                <div className="flex items-center gap-1.5">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {b.booking_type.name}
                                                </div>
                                            )}
                                            {b.booking_type?.location && (
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3 w-3" />
                                                    {b.booking_type.location}
                                                </div>
                                            )}
                                            {b.notes && (
                                                <p className="text-zinc-500 italic mt-1">
                                                    {b.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Stats */}
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardContent className="p-4 space-y-3">
                            <h3 className="text-sm font-medium text-zinc-300">This Month</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                                    <p className="text-2xl font-bold text-white">
                                        {bookings.filter((b) => {
                                            const d = new Date(b.start_time);
                                            return d.getMonth() === month && d.getFullYear() === year;
                                        }).length}
                                    </p>
                                    <p className="text-xs text-zinc-500">Total</p>
                                </div>
                                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-400">
                                        {bookings.filter((b) => {
                                            const d = new Date(b.start_time);
                                            return (
                                                d.getMonth() === month &&
                                                d.getFullYear() === year &&
                                                b.status === "completed"
                                            );
                                        }).length}
                                    </p>
                                    <p className="text-xs text-zinc-500">Completed</p>
                                </div>
                                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                                    <p className="text-2xl font-bold text-blue-400">
                                        {bookings.filter((b) => {
                                            const d = new Date(b.start_time);
                                            return (
                                                d.getMonth() === month &&
                                                d.getFullYear() === year &&
                                                b.status === "scheduled"
                                            );
                                        }).length}
                                    </p>
                                    <p className="text-xs text-zinc-500">Scheduled</p>
                                </div>
                                <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
                                    <p className="text-2xl font-bold text-red-400">
                                        {bookings.filter((b) => {
                                            const d = new Date(b.start_time);
                                            return (
                                                d.getMonth() === month &&
                                                d.getFullYear() === year &&
                                                b.status === "no_show"
                                            );
                                        }).length}
                                    </p>
                                    <p className="text-xs text-zinc-500">No Shows</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
