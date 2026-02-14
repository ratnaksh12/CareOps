"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
    Settings,
    Building2,
    Mail,
    Phone,
    Calendar,
    Shield,
    Database,
    CheckCircle2,
    XCircle,
    Clock,
    Save,
    Loader2,
    Link2,
    Unlink,
    MapPin,
} from "lucide-react";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface AvailabilitySlot {
    id?: string;
    workspace_id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

interface CalendarAuthData {
    auth_url: string | null;
    is_connected: boolean;
}

interface BookingType {
    id: string;
    name: string;
    duration_minutes: number;
    description: string;
    location: string;
    is_active: boolean;
    intake_form_id?: string | null;
}

interface FormItem {
    id: string;
    name: string;
    is_active: boolean;
}

interface Workspace {
    id: string;
    name: string;
    address: string;
    timezone: string;
    contact_email: string;
    is_active: boolean;
    onboarding_step: number;
}

export default function SettingsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    const { data: workspace } = useQuery<Workspace>({
        queryKey: ["workspace"],
        queryFn: () => api.get("/workspaces/current"),
        enabled: !!user?.workspace_id,
    });

    // ── Availability ──
    const { data: availability = [] } = useQuery<AvailabilitySlot[]>({
        queryKey: ["availability"],
        queryFn: () => api.get("/availability"),
    });

    const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

    useEffect(() => {
        if (availability.length > 0) {
            setSlots(availability);
        } else {
            // Default: Mon-Fri 9-5
            setSlots(
                DAY_NAMES.map((_, i) => ({
                    day_of_week: i,
                    start_time: "09:00",
                    end_time: "17:00",
                    is_active: i < 5, // Mon-Fri active
                }))
            );
        }
    }, [availability]);

    const saveAvailability = useMutation({
        mutationFn: (slots: AvailabilitySlot[]) =>
            api.post("/availability", { slots }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["availability"] }),
    });

    // ── Google Calendar ──
    const { data: calendarAuth } = useQuery<CalendarAuthData>({
        queryKey: ["gcalendar-auth"],
        queryFn: () => api.get("/gcalendar/auth-url"),
    });

    const disconnectCalendar = useMutation({
        mutationFn: () => api.delete("/gcalendar/disconnect"),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gcalendar-auth"] }),
    });

    // ── Booking Types + Forms ──
    const { data: bookingTypes = [] } = useQuery<BookingType[]>({
        queryKey: ["booking-types"],
        queryFn: () => api.get("/bookings/types"),
    });

    const { data: forms = [] } = useQuery<FormItem[]>({
        queryKey: ["forms"],
        queryFn: () => api.get("/forms"),
    });

    const updateBookingType = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<BookingType> }) =>
            api.patch(`/bookings/types/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["booking-types"] }),
    });

    const integrations = [
        { icon: Database, name: "PostgreSQL (Supabase)", status: "Connected", connected: true },
        { icon: Mail, name: "Email (Resend)", status: "Connected", connected: true },
        { icon: Phone, name: "SMS (Twilio)", status: "Connected", connected: true },
        {
            icon: Calendar,
            name: "Google Calendar",
            status: calendarAuth?.is_connected ? "Connected" : "Not Connected",
            connected: calendarAuth?.is_connected || false,
        },
    ];

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold text-white">Settings</h1>
                <p className="text-zinc-400 mt-1">Manage your workspace, availability, and integrations</p>
            </div>

            {/* Workspace Info */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Building2 className="h-5 w-5 text-violet-400" />
                        Workspace
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Name</p>
                            <p className="text-sm text-white">{workspace?.name || "Not set"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Status</p>
                            <Badge variant="outline" className={workspace?.is_active ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}>
                                {workspace?.is_active ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Address</p>
                            <p className="text-sm text-zinc-300 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-zinc-500" />
                                {workspace?.address || "Not set"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Contact Email</p>
                            <p className="text-sm text-zinc-300">{workspace?.contact_email || "Not set"}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Business Availability */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Clock className="h-5 w-5 text-violet-400" />
                            Business Hours
                        </CardTitle>
                        <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700"
                            disabled={saveAvailability.isPending}
                            onClick={() => saveAvailability.mutate(slots)}
                        >
                            {saveAvailability.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                <Save className="h-4 w-4 mr-1" />
                            )}
                            Save Hours
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/30">
                            <button
                                onClick={() => {
                                    const newSlots = [...slots];
                                    newSlots[idx].is_active = !newSlots[idx].is_active;
                                    setSlots(newSlots);
                                }}
                                className={`w-24 text-left text-sm font-medium px-2 py-1 rounded ${slot.is_active
                                    ? "text-emerald-400"
                                    : "text-zinc-500 line-through"
                                    }`}
                            >
                                {DAY_NAMES[slot.day_of_week]}
                            </button>
                            {slot.is_active ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={slot.start_time}
                                        onChange={(e) => {
                                            const newSlots = [...slots];
                                            newSlots[idx].start_time = e.target.value;
                                            setSlots(newSlots);
                                        }}
                                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    />
                                    <span className="text-zinc-500 text-sm">to</span>
                                    <input
                                        type="time"
                                        value={slot.end_time}
                                        onChange={(e) => {
                                            const newSlots = [...slots];
                                            newSlots[idx].end_time = e.target.value;
                                            setSlots(newSlots);
                                        }}
                                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    />
                                </div>
                            ) : (
                                <span className="text-sm text-zinc-600">Closed</span>
                            )}
                        </div>
                    ))}
                    {saveAvailability.isSuccess && (
                        <p className="text-emerald-400 text-sm flex items-center gap-1 mt-2">
                            <CheckCircle2 className="h-4 w-4" /> Hours saved!
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Account Info */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Shield className="h-5 w-5 text-violet-400" />
                        Account
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Name</p>
                            <p className="text-sm text-white">{user?.full_name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Email</p>
                            <p className="text-sm text-zinc-300">{user?.email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Role</p>
                            <Badge variant="outline" className="border-violet-500/30 text-violet-400">
                                {user?.role === "admin" ? "Admin" : "Staff"}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Post-Booking Intake Forms */}
            {bookingTypes.length > 0 && (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Link2 className="h-5 w-5 text-violet-400" />
                            Post-Booking Intake Forms
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-zinc-400 mb-3">
                            Assign an intake form to each booking type. It will be automatically sent to clients after booking.
                        </p>
                        {bookingTypes.map((bt) => (
                            <div key={bt.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
                                <div>
                                    <p className="text-sm text-white font-medium">{bt.name}</p>
                                    <p className="text-xs text-zinc-500">{bt.duration_minutes} min{bt.location ? ` · ${bt.location}` : ""}</p>
                                </div>
                                <select
                                    value={bt.intake_form_id || ""}
                                    onChange={(e) => {
                                        updateBookingType.mutate({
                                            id: bt.id,
                                            data: { intake_form_id: e.target.value || null } as any,
                                        });
                                    }}
                                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[180px]"
                                >
                                    <option value="">No intake form</option>
                                    {forms.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Integrations */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Settings className="h-5 w-5 text-violet-400" />
                        Integrations
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {integrations.map((int, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <int.icon className={`h-4 w-4 ${int.connected ? "text-emerald-400" : "text-zinc-500"}`} />
                                <span className="text-sm text-zinc-300">{int.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className={int.connected
                                        ? "border-emerald-500/30 text-emerald-400"
                                        : "border-zinc-700 text-zinc-500"
                                    }
                                >
                                    {int.connected ? (
                                        <><CheckCircle2 className="h-3 w-3 mr-1" />{int.status}</>
                                    ) : (
                                        <><XCircle className="h-3 w-3 mr-1" />{int.status}</>
                                    )}
                                </Badge>
                                {int.name === "Google Calendar" && (
                                    calendarAuth?.is_connected ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                            onClick={() => disconnectCalendar.mutate()}
                                        >
                                            <Unlink className="h-3 w-3 mr-1" />
                                            Disconnect
                                        </Button>
                                    ) : calendarAuth?.auth_url ? (
                                        <Button
                                            size="sm"
                                            className="bg-violet-600 hover:bg-violet-700"
                                            onClick={() => window.open(calendarAuth.auth_url!, "_blank")}
                                        >
                                            <Link2 className="h-3 w-3 mr-1" />
                                            Connect
                                        </Button>
                                    ) : null
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
