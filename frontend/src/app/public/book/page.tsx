"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfToday, setHours, setMinutes } from "date-fns";
import type { BookingType, Booking } from "@/types";

function BookingContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const typeId = searchParams.get("typeId");

    const [step, setStep] = useState<"date" | "details" | "success">("date");
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: "", email: "", phone: "", notes: "" });

    // Fetch Booking Type
    const { data: bookingType, isLoading, error } = useQuery<BookingType>({
        queryKey: ["public-booking-type", typeId],
        queryFn: () => api.get(`/public/booking-types/${typeId}`),
        enabled: !!typeId,
        retry: false,
    });

    const createBooking = useMutation({
        mutationFn: (data: any) => api.post("/public/bookings", data),
        onSuccess: () => {
            setStep("success");
            toast.success("Booking confirmed!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Mock Time Slots (In a real app, fetch from backend based on availability)
    const timeSlots = [
        "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
        "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"
    ];

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date);
        setSelectedTime(null);
    };

    const handleContinue = () => {
        if (selectedDate && selectedTime) {
            setStep("details");
        }
    };

    const handleSubmit = () => {
        if (!selectedDate || !selectedTime || !typeId) return;

        // Construct ISO DateTime
        const [hours, minutes] = selectedTime.split(":").map(Number);
        const dateTime = setMinutes(setHours(selectedDate, hours), minutes);

        createBooking.mutate({
            booking_type_id: typeId,
            start_time: dateTime.toISOString(),
            ...formData
        });
    };

    if (!typeId) {
        return (
            <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-amber-400 mb-4" />
                    <h2 className="text-xl font-semibold text-white">Invalid Link</h2>
                    <p className="text-zinc-400 mt-2">The booking type ID is missing.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>;
    }

    if (error || !bookingType) {
        return (
            <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                    <h2 className="text-xl font-semibold text-white">Service Not Found</h2>
                    <p className="text-zinc-400 mt-2">This booking link may be invalid or expired.</p>
                </CardContent>
            </Card>
        );
    }

    if (step === "success") {
        return (
            <Card className="border-emerald-500/20 bg-emerald-500/5 animate-in fade-in zoom-in duration-500">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="rounded-full bg-emerald-500/10 p-4 mb-6">
                        <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Booking Confirmed!</h2>
                    <p className="text-zinc-300 mt-2 max-w-md">
                        Your appointment for <span className="font-medium text-white">{bookingType.name}</span> has been scheduled.
                    </p>
                    <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 text-left w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <CalendarIcon className="h-4 w-4 text-violet-400" />
                            <span className="text-zinc-300">{selectedDate && format(selectedDate, "EEEE, MMMM do, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-violet-400" />
                            <span className="text-zinc-300">{selectedTime} ({bookingType.duration_minutes} mins)</span>
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 mt-6">Check your email for confirmation details.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-zinc-800 bg-zinc-900 shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="grid md:grid-cols-[300px_1fr]">
                {/* Left Sidebar: Service Info */}
                <div className="bg-zinc-950 p-6 md:p-8 border-b md:border-b-0 md:border-r border-zinc-800">
                    <div className="sticky top-6">
                        <h1 className="text-2xl font-bold text-white mb-2">{bookingType.name}</h1>
                        <div className="flex items-center gap-2 text-zinc-400 mb-6">
                            <Clock className="h-4 w-4" />
                            <span>{bookingType.duration_minutes} min</span>
                        </div>
                        {bookingType.description && (
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                {bookingType.description}
                            </p>
                        )}
                        {bookingType.location && (
                            <div className="flex items-start gap-2 text-zinc-400 text-sm mt-4">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{bookingType.location}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content: Calendar & Form */}
                <div className="p-6 md:p-8">
                    {step === "date" ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4">Select a Date & Time</h2>
                                <div className="flex flex-col md:flex-row gap-8">
                                    <div className="p-3 border border-zinc-800 rounded-lg bg-zinc-950/50">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={handleDateSelect}
                                            disabled={(date) => date < startOfToday()}
                                            className="bg-transparent"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        {selectedDate ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {timeSlots.map((time) => (
                                                    <Button
                                                        key={time}
                                                        variant={selectedTime === time ? "default" : "outline"}
                                                        className={`w-full ${selectedTime === time ? "bg-violet-600 hover:bg-violet-700 text-white" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
                                                        onClick={() => setSelectedTime(time)}
                                                    >
                                                        {time}
                                                    </Button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-zinc-500 text-sm italic">
                                                Select a date to view available times
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4 border-t border-zinc-800">
                                <Button
                                    onClick={handleContinue}
                                    disabled={!selectedDate || !selectedTime}
                                    className="bg-violet-600 hover:bg-violet-700"
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4">Enter Details</h2>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label className="text-zinc-300">Full Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="bg-zinc-950 border-zinc-700 text-white"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label className="text-zinc-300">Email <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="bg-zinc-950 border-zinc-700 text-white"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-zinc-300">Phone</Label>
                                            <Input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="bg-zinc-950 border-zinc-700 text-white"
                                                placeholder="+1 234 567 8900"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-zinc-300">Additional Notes</Label>
                                        <Textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            className="bg-zinc-950 border-zinc-700 text-white min-h-[100px]"
                                            placeholder="Anything else we should know?"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between pt-4 border-t border-zinc-800">
                                <Button variant="ghost" onClick={() => setStep("date")} className="text-zinc-400 hover:text-white">
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!formData.name || !formData.email || createBooking.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {createBooking.isPending ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming...</>
                                    ) : (
                                        "Confirm Booking"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

export default function PublicBookingPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>}>
            <BookingContent />
        </Suspense>
    );
}
