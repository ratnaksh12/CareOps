"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
    Loader2,
    CheckCircle2,
    MessageSquare,
    Calendar as CalendarIcon,
    Clock,
    Send,
    ArrowRight,
    ArrowLeft,
    Briefcase,
    Phone,
    Mail,
    User,
    MapPin,
} from "lucide-react";
import { format, startOfToday, setHours, setMinutes, addMinutes, isSameDay } from "date-fns";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const WORKSPACE_ID = "ws-default"; // In a real app, this would be dynamic (subdomain/path)

interface BookingType {
    id: string;
    name: string;
    duration_minutes: number;
    description?: string;
    location?: string;
    is_active: boolean;
}

interface AvailabilitySlot {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

type RequestType = "enquiry" | "booking";

export default function UnifiedPublicForm() {
    const [step, setStep] = useState<"type" | "details" | "schedule" | "success">("type");
    const [requestType, setRequestType] = useState<RequestType | null>(null);
    const [selectedService, setSelectedService] = useState<BookingType | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        message: "",
        notes: "",
    });

    // Fetch booking types
    const { data: bookingTypes, isLoading: typesLoading } = useQuery<BookingType[]>({
        queryKey: ["public-booking-types"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/public/booking-types?workspace_id=${WORKSPACE_ID}`);
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch availability
    const { data: availability = [] } = useQuery<AvailabilitySlot[]>({
        queryKey: ["public-availability"],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/availability/public/${WORKSPACE_ID}`);
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Generate time slots based on availability
    const availableTimeSlots = useMemo(() => {
        if (!selectedDate || !selectedService || availability.length === 0) return [];

        const dayOfWeek = selectedDate.getDay(); // 0=Sunday
        // Backend uses 0=Monday, so adjust
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const dayConfig = availability.find(a => a.day_of_week === adjustedDay);
        if (!dayConfig || !dayConfig.is_active) return [];

        const slots: string[] = [];
        const [startHour, startMin] = dayConfig.start_time.split(":").map(Number);
        const [endHour, endMin] = dayConfig.end_time.split(":").map(Number);

        let current = setMinutes(setHours(selectedDate, startHour), startMin);
        const end = setMinutes(setHours(selectedDate, endHour), endMin);

        // Simple slot generation (every 30 mins)
        // In a real app, we'd check against existing bookings here too
        while (current < end) {
            // Check if slot + duration fits
            const slotEnd = addMinutes(current, selectedService.duration_minutes);
            if (slotEnd <= end) {
                slots.push(format(current, "HH:mm"));
            }
            current = addMinutes(current, 30);
        }

        return slots;
    }, [selectedDate, selectedService, availability]);

    // Submit enquiry
    const submitEnquiry = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await fetch(`${API_BASE}/public/contacts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    email: data.email,
                    phone: data.phone || undefined,
                    message: data.message || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Failed to submit enquiry");
            }
            return res.json();
        },
        onSuccess: () => {
            setStep("success");
            toast.success("Enquiry submitted successfully!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Submit booking
    const submitBooking = useMutation({
        mutationFn: async () => {
            if (!selectedDate || !selectedTime || !selectedService) return;
            // time is HH:mm
            const [hours, minutes] = selectedTime.split(":").map(Number);
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            const dateTimeStr = `${dateStr}T${selectedTime}:00`;

            const res = await fetch(`${API_BASE}/public/bookings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    booking_type_id: selectedService.id,
                    start_time: dateTimeStr,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone || undefined,
                    notes: formData.notes || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || "Failed to create booking");
            }
            return res.json();
        },
        onSuccess: () => {
            setStep("success");
            toast.success("Booking confirmed!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleReset = () => {
        setStep("type");
        setRequestType(null);
        setSelectedService(null);
        setSelectedDate(undefined);
        setSelectedTime(null);
        setFormData({ name: "", email: "", phone: "", message: "", notes: "" });
    };

    // Step 1: Choose request type
    if (step === "type") {
        return (
            <Card className="border-zinc-800 bg-zinc-900 shadow-2xl w-full max-w-2xl mx-auto overflow-hidden animate-in fade-in zoom-in duration-300">
                <CardHeader className="border-b border-zinc-800 pb-6 text-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                    <div className="flex justify-center mb-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
                            <Briefcase className="h-7 w-7 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">How can we help?</CardTitle>
                    <CardDescription className="text-zinc-400 mt-1.5 text-base">
                        Choose what you&apos;d like to do — we&apos;ll guide you through the rest.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-4">
                    {/* Enquiry option */}
                    <button
                        onClick={() => { setRequestType("enquiry"); setStep("details"); }}
                        className="w-full p-5 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group text-left"
                    >
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-lg bg-violet-600/10 flex items-center justify-center shrink-0 group-hover:bg-violet-600/20 transition-colors">
                                <MessageSquare className="h-5 w-5 text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors">
                                    Send an Enquiry
                                </h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    Ask a question, request information, or tell us about your needs.
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-zinc-600 ml-auto mt-1 group-hover:text-violet-400 transition-colors" />
                        </div>
                    </button>

                    {/* Booking option */}
                    <button
                        onClick={() => { setRequestType("booking"); setStep("details"); }}
                        className="w-full p-5 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group text-left"
                    >
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 rounded-lg bg-emerald-600/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-600/20 transition-colors">
                                <CalendarIcon className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">
                                    Book a Consultation
                                </h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    Schedule a time with our team — choose a service, date, and time.
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-zinc-600 ml-auto mt-1 group-hover:text-emerald-400 transition-colors" />
                        </div>
                    </button>

                    {/* Available services preview */}
                    {bookingTypes && bookingTypes.length > 0 && (
                        <div className="pt-4 border-t border-zinc-800">
                            <p className="text-xs text-zinc-600 uppercase tracking-wider font-medium mb-3">Available Services</p>
                            <div className="flex flex-wrap gap-2">
                                {bookingTypes.map((bt) => (
                                    <span key={bt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">
                                        <Clock className="h-3 w-3" />
                                        {bt.name} • {bt.duration_minutes}min
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Step 2: Contact details + service selection (for booking)
    if (step === "details") {
        return (
            <Card className="border-zinc-800 bg-zinc-900 shadow-2xl w-full max-w-2xl mx-auto overflow-hidden animate-in fade-in slide-in-from-right-10 duration-300">
                <CardHeader className="border-b border-zinc-800 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${requestType === "enquiry" ? "bg-violet-400/10 text-violet-400" : "bg-emerald-400/10 text-emerald-400"
                            }`}>
                            {requestType === "enquiry" ? "Enquiry" : "Booking"}
                        </span>
                    </div>
                    <CardTitle className="text-xl font-bold text-white">Your Details</CardTitle>
                    <CardDescription className="text-zinc-400">
                        {requestType === "enquiry"
                            ? "Tell us about yourself and your question."
                            : "Enter your details and select a service to book."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-300 flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" /> Full Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="John Doe"
                                className="bg-zinc-950 border-zinc-700 text-white focus-visible:ring-violet-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-300 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" /> Email <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                                className="bg-zinc-950 border-zinc-700 text-white focus-visible:ring-violet-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-zinc-300 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> Phone Number
                        </Label>
                        <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                            className="bg-zinc-950 border-zinc-700 text-white focus-visible:ring-violet-500"
                        />
                    </div>

                    {/* Enquiry-specific: Message field */}
                    {requestType === "enquiry" && (
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Your Message</Label>
                            <Textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                placeholder="How can we help you? Tell us about your needs..."
                                className="min-h-[120px] bg-zinc-950 border-zinc-700 text-white focus-visible:ring-violet-500 resize-none"
                            />
                        </div>
                    )}

                    {/* Booking-specific: Service selection */}
                    {requestType === "booking" && (
                        <div className="space-y-3">
                            <Label className="text-zinc-300">Select a Service <span className="text-red-500">*</span></Label>
                            {typesLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                                </div>
                            ) : bookingTypes && bookingTypes.length > 0 ? (
                                <div className="grid gap-2">
                                    {bookingTypes.map((bt) => (
                                        <button
                                            key={bt.id}
                                            onClick={() => setSelectedService(bt)}
                                            className={`w-full p-4 rounded-lg border text-left transition-all ${selectedService?.id === bt.id
                                                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                                                : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className={`font-medium ${selectedService?.id === bt.id ? "text-emerald-300" : "text-white"}`}>
                                                        {bt.name}
                                                    </p>
                                                    {bt.description && (
                                                        <p className="text-xs text-zinc-500 mt-0.5">{bt.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-400 text-sm shrink-0 ml-4">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {bt.duration_minutes}min
                                                    {bt.location && (
                                                        <>
                                                            <MapPin className="h-3.5 w-3.5 ml-2" />
                                                            {bt.location}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-500 italic py-2">No services available at this time.</p>
                            )}

                            <div className="space-y-2 pt-2">
                                <Label className="text-zinc-300">Additional Notes</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Anything we should know before your appointment?"
                                    className="min-h-[80px] bg-zinc-950 border-zinc-700 text-white focus-visible:ring-violet-500 resize-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between pt-4 border-t border-zinc-800">
                        <Button variant="ghost" onClick={handleReset} className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>

                        {requestType === "enquiry" ? (
                            <Button
                                onClick={() => submitEnquiry.mutate(formData)}
                                disabled={!formData.name || !formData.email || submitEnquiry.isPending}
                                className="bg-violet-600 hover:bg-violet-700"
                            >
                                {submitEnquiry.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Submit Enquiry
                            </Button>
                        ) : (
                            <Button
                                onClick={() => setStep("schedule")}
                                disabled={!formData.name || !formData.email || !selectedService}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Choose Date & Time <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Step 3: Schedule (booking only)
    if (step === "schedule") {
        return (
            <Card className="border-zinc-800 bg-zinc-900 shadow-2xl w-full max-w-4xl mx-auto overflow-hidden animate-in fade-in slide-in-from-right-10 duration-300">
                <div className="grid md:grid-cols-[280px_1fr]">
                    {/* Sidebar: Service summary */}
                    <div className="bg-zinc-950 p-6 border-b md:border-b-0 md:border-r border-zinc-800">
                        <div className="sticky top-6">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 mb-3 inline-block">
                                Booking
                            </span>
                            <h2 className="text-xl font-bold text-white mb-1">{selectedService?.name}</h2>
                            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-4">
                                <Clock className="h-4 w-4" />
                                {selectedService?.duration_minutes} min
                            </div>
                            {selectedService?.description && (
                                <p className="text-zinc-500 text-sm mb-4">{selectedService.description}</p>
                            )}
                            <div className="border-t border-zinc-800 pt-4 mt-4 space-y-2 text-sm text-zinc-400">
                                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {formData.name}</div>
                                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {formData.email}</div>
                                {formData.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {formData.phone}</div>}
                            </div>
                        </div>
                    </div>

                    {/* Right: Calendar + Time */}
                    <div className="p-6 md:p-8">
                        <h3 className="text-lg font-semibold text-white mb-4">Select Date & Time</h3>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="p-3 border border-zinc-800 rounded-lg bg-zinc-950/50">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                                    disabled={(date) => date < startOfToday() || date.getDay() === 0 && !availability.some(a => a.day_of_week === 6 && a.is_active) || date.getDay() !== 0 && !availability.some(a => a.day_of_week === date.getDay() - 1 && a.is_active)}
                                    className="bg-transparent"
                                />
                            </div>
                            <div className="flex-1">
                                {selectedDate ? (
                                    <div className="space-y-2">
                                        <p className="text-sm text-zinc-400 mb-3">
                                            {format(selectedDate, "EEEE, MMMM do")}
                                        </p>
                                        {availableTimeSlots.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {availableTimeSlots.map((time) => (
                                                    <Button
                                                        key={time}
                                                        variant={selectedTime === time ? "default" : "outline"}
                                                        className={`w-full ${selectedTime === time
                                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            : "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                                            }`}
                                                        onClick={() => setSelectedTime(time)}
                                                    >
                                                        {time}
                                                    </Button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-center text-sm text-zinc-500">
                                                No available slots on this day.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-zinc-500 text-sm italic">
                                        Select a date to view available times
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between pt-6 border-t border-zinc-800 mt-6">
                            <Button variant="ghost" onClick={() => setStep("details")} className="text-zinc-400 hover:text-white">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button
                                onClick={() => submitBooking.mutate()}
                                disabled={!selectedDate || !selectedTime || submitBooking.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                {submitBooking.isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming...</>
                                ) : (
                                    "Confirm Booking"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    // Step 4: Success
    return (
        <Card className="border-emerald-500/20 bg-emerald-500/5 animate-in fade-in zoom-in duration-500 w-full max-w-lg mx-auto">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-emerald-500/10 p-4 mb-6">
                    <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                    {requestType === "enquiry" ? "Message Received!" : "Booking Confirmed!"}
                </h2>
                <p className="text-zinc-300 mt-3 max-w-md">
                    {requestType === "enquiry" ? (
                        <>Thanks for reaching out, <span className="font-medium text-white">{formData.name}</span>. We&apos;ll get back to you shortly.</>
                    ) : (
                        <>Your appointment for <span className="font-medium text-white">{selectedService?.name}</span> has been scheduled.</>
                    )}
                </p>

                {requestType === "booking" && selectedDate && selectedTime && (
                    <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 text-left w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <CalendarIcon className="h-4 w-4 text-emerald-400" />
                            <span className="text-zinc-300">{format(selectedDate, "EEEE, MMMM do, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-emerald-400" />
                            <span className="text-zinc-300">{selectedTime} ({selectedService?.duration_minutes} mins)</span>
                        </div>
                    </div>
                )}

                <p className="text-sm text-zinc-500 mt-6">
                    {requestType === "booking"
                        ? "Check your email for confirmation details."
                        : "You'll receive email and SMS confirmation shortly."}
                </p>

                <Button
                    variant="outline"
                    className="mt-6 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    onClick={handleReset}
                >
                    {requestType === "enquiry" ? "Send Another Message" : "Book Another Appointment"}
                </Button>
            </CardContent>
        </Card>
    );
}
