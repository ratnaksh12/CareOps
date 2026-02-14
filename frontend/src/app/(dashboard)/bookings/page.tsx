"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Calendar,
    Plus,
    Clock,
    MapPin,
    User,
    CheckCircle2,
    XCircle,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Booking, BookingType, Contact, Form } from "@/types";

const statusColors: Record<string, string> = {
    scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    completed: "bg-green-500/10 text-green-400 border-green-500/30",
    no_show: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusIcons: Record<string, React.ElementType> = {
    scheduled: Clock,
    confirmed: CheckCircle2,
    completed: CheckCircle2,
    no_show: AlertTriangle,
    cancelled: XCircle,
};

export default function BookingsPage() {
    const queryClient = useQueryClient();
    const [showNew, setShowNew] = useState(false);
    const [showNewType, setShowNewType] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [newBooking, setNewBooking] = useState({
        booking_type_id: "",
        contact_id: "",
        start_time: "",
        end_time: "",
        notes: "",
    });
    const [newType, setNewType] = useState({
        name: "",
        duration_minutes: 60,
        description: "",
        location: "",
        intake_form_id: "",
    });

    const { data: bookings = [], isLoading } = useQuery<Booking[]>({
        queryKey: ["bookings"],
        queryFn: () => api.get("/bookings"),
    });

    const { data: bookingTypes = [] } = useQuery<BookingType[]>({
        queryKey: ["booking-types"],
        queryFn: () => api.get("/bookings/types"),
    });

    const { data: contacts = [] } = useQuery<Contact[]>({
        queryKey: ["contacts"],
        queryFn: () => api.get("/contacts"),
    });

    const { data: forms = [] } = useQuery<Form[]>({
        queryKey: ["forms"],
        queryFn: () => api.get("/forms"),
    });

    const createBooking = useMutation({
        mutationFn: (data: typeof newBooking) => api.post("/bookings", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            setShowNew(false);
            setNewBooking({ booking_type_id: "", contact_id: "", start_time: "", end_time: "", notes: "" });
            toast.success("Booking created!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const createType = useMutation({
        mutationFn: (data: typeof newType) => api.post("/bookings/types", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["booking-types"] });
            setShowNewType(false);
            setNewType({ name: "", duration_minutes: 60, description: "", location: "", intake_form_id: "" });
            toast.success("Service type created!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateBooking = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.patch(`/bookings/${id}`, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            toast.success("Status updated!");
        },
    });

    const filtered = statusFilter === "all"
        ? bookings
        : bookings.filter((b) => b.status === statusFilter);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Bookings</h1>
                    <p className="text-zinc-400 mt-1">Manage appointments and service bookings</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={showNewType} onOpenChange={setShowNewType}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                                <Plus className="mr-2 h-4 w-4" /> Service Type
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="border-zinc-800 bg-zinc-900">
                            <DialogHeader>
                                <DialogTitle className="text-white">New Service Type</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Name</Label>
                                    <Input value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} placeholder="e.g. Consultation" className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Duration (minutes)</Label>
                                    <Input type="number" value={newType.duration_minutes} onChange={(e) => setNewType({ ...newType, duration_minutes: Number(e.target.value) })} className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Location</Label>
                                    <Input value={newType.location} onChange={(e) => setNewType({ ...newType, location: e.target.value })} placeholder="Office, Virtual, etc." className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Intake Form (Automated)</Label>
                                    <Select value={newType.intake_form_id} onValueChange={(v) => setNewType({ ...newType, intake_form_id: v })}>
                                        <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white">
                                            <SelectValue placeholder="Select form to send..." />
                                        </SelectTrigger>
                                        <SelectContent className="border-zinc-700 bg-zinc-800">
                                            <SelectItem value="none">None</SelectItem>
                                            {forms.map((f) => (
                                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Description</Label>
                                    <Textarea value={newType.description} onChange={(e) => setNewType({ ...newType, description: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => createType.mutate(newType)} disabled={!newType.name}>Create Type</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showNew} onOpenChange={setShowNew}>
                        <DialogTrigger asChild>
                            <Button className="bg-violet-600 hover:bg-violet-700">
                                <Plus className="mr-2 h-4 w-4" /> New Booking
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="border-zinc-800 bg-zinc-900">
                            <DialogHeader>
                                <DialogTitle className="text-white">Create Booking</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Service Type</Label>
                                    <Select value={newBooking.booking_type_id} onValueChange={(v) => setNewBooking({ ...newBooking, booking_type_id: v })}>
                                        <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white"><SelectValue placeholder="Select service" /></SelectTrigger>
                                        <SelectContent className="border-zinc-700 bg-zinc-800">
                                            {bookingTypes.map((bt) => (<SelectItem key={bt.id} value={bt.id}>{bt.name} ({bt.duration_minutes}min)</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Contact</Label>
                                    <Select value={newBooking.contact_id} onValueChange={(v) => setNewBooking({ ...newBooking, contact_id: v })}>
                                        <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white"><SelectValue placeholder="Select contact" /></SelectTrigger>
                                        <SelectContent className="border-zinc-700 bg-zinc-800">
                                            {contacts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-zinc-300">Start</Label>
                                        <Input type="datetime-local" value={newBooking.start_time} onChange={(e) => setNewBooking({ ...newBooking, start_time: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-zinc-300">End</Label>
                                        <Input type="datetime-local" value={newBooking.end_time} onChange={(e) => setNewBooking({ ...newBooking, end_time: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Notes</Label>
                                    <Textarea value={newBooking.notes} onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <Button className="w-full bg-violet-600" onClick={() => createBooking.mutate(newBooking)} disabled={!newBooking.booking_type_id || !newBooking.contact_id || !newBooking.start_time}>Create Booking</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {["all", "scheduled", "confirmed", "completed", "no_show", "cancelled"].map((s) => (
                    <Button
                        key={s}
                        variant={statusFilter === s ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(s)}
                        className={statusFilter === s ? "bg-violet-600" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"}
                    >
                        {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Button>
                ))}
            </div>

            {/* Bookings List */}
            {isLoading ? (
                <div className="grid gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="border-zinc-800 bg-zinc-900/50">
                            <CardContent className="p-4">
                                <Skeleton className="h-6 w-48 bg-zinc-800" />
                                <Skeleton className="h-4 w-32 mt-2 bg-zinc-800" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
                        <Calendar className="h-12 w-12 mb-3 text-zinc-700" />
                        <p className="text-lg font-medium">No bookings found</p>
                        <p className="text-sm mt-1">Create a service type and start accepting bookings</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {filtered.map((booking) => {
                        const StatusIcon = statusIcons[booking.status] || Clock;
                        return (
                            <Card key={booking.id} className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                                                <Calendar className="h-5 w-5 text-violet-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-white">{booking.booking_type?.name || "Service"}</p>
                                                    <Badge variant="outline" className={statusColors[booking.status]}>
                                                        <StatusIcon className="h-3 w-3 mr-1" />
                                                        {booking.status.replace("_", " ")}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{booking.contact?.name || "Unknown"}</span>
                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(booking.start_time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                                    {booking.booking_type?.location && (
                                                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{booking.booking_type.location}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {booking.status === "scheduled" && (
                                                <Button size="sm" variant="outline" onClick={() => updateBooking.mutate({ id: booking.id, status: "confirmed" })} className="text-xs border-emerald-700 text-emerald-400 hover:bg-emerald-500/10">Confirm</Button>
                                            )}
                                            {(booking.status === "scheduled" || booking.status === "confirmed") && (
                                                <>
                                                    <Button size="sm" variant="outline" onClick={() => updateBooking.mutate({ id: booking.id, status: "completed" })} className="text-xs border-zinc-700 text-zinc-400 hover:bg-zinc-800">Complete</Button>
                                                    <Button size="sm" variant="outline" onClick={() => updateBooking.mutate({ id: booking.id, status: "no_show" })} className="text-xs border-amber-700 text-amber-400 hover:bg-amber-500/10">No Show</Button>
                                                    <Button size="sm" variant="outline" onClick={() => updateBooking.mutate({ id: booking.id, status: "cancelled" })} className="text-xs border-red-700 text-red-400 hover:bg-red-500/10">Cancel</Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
