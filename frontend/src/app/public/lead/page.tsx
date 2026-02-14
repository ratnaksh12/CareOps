"use client";

import { useState, Suspense } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, CheckCircle2, MessageSquare, Send, Clock, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { BookingType } from "@/types";

import { useSearchParams } from "next/navigation";

function LeadContent() {
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get("workspace_id") || searchParams.get("ws");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        message: ""
    });
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Booking State
    const [wantBooking, setWantBooking] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedBookingType, setSelectedBookingType] = useState<string | null>(null);

    // Fetch Booking Types (Always try to fetch, backend defaults if no workspaceId)
    const { data: bookingTypes } = useQuery<BookingType[]>({
        queryKey: ["public-booking-types", workspaceId],
        queryFn: () => api.get(workspaceId
            ? `/public/booking-types?workspace_id=${workspaceId}`
            : `/public/booking-types`),
    });

    // Fetch Slots
    const { data: slots, isLoading: isSlotsLoading } = useQuery<string[]>({
        queryKey: ["public-slots", workspaceId, selectedDate, selectedBookingType],
        queryFn: () => {
            if (!selectedDate || !selectedBookingType) return [];
            const params = new URLSearchParams({
                date: format(selectedDate, "yyyy-MM-dd"),
                booking_type_id: selectedBookingType,
            });
            if (workspaceId) params.append("workspace_id", workspaceId);

            return api.get(`/public/slots?${params.toString()}`);
        },
        enabled: !!(selectedDate && selectedBookingType),
    });

    const submitLead = useMutation({
        mutationFn: async (data: typeof formData) => {
            // 1. Submit Lead
            await api.post("/public/contacts", {
                ...data,
                workspace_id: workspaceId // Optional, backend handles default
            });

            // 2. Create Booking (if requested)
            if (wantBooking && selectedDate && selectedSlot && selectedBookingType) {
                const startTime = `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlot}:00`;
                await api.post(`/public/bookings`, {
                    booking_type_id: selectedBookingType,
                    start_time: startTime,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    notes: `Booked via "Contact Us" Form. Message: ${data.message}`,
                });
            }
        },
        onSuccess: () => {
            setIsSubmitted(true);
            toast.success("Message sent successfully!");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to send message. Please try again.");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitLead.mutate(formData);
    };

    if (isSubmitted) {
        return (
            <Card className="border-emerald-500/20 bg-emerald-500/5 animate-in fade-in zoom-in duration-500 w-full max-w-lg mx-auto mt-10">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="rounded-full bg-emerald-500/10 p-4 mb-6">
                        <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Message Received!</h2>
                    <p className="text-zinc-300 mt-2 max-w-md">
                        Thanks for reaching out, <span className="font-medium text-white">{formData.name}</span>.
                        {wantBooking
                            ? " Your appointment request has been scheduled. Check your email for confirmation."
                            : " We've received your inquiry and will get back to you shortly."
                        }
                    </p>
                    <Button
                        variant="outline"
                        className="mt-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => {
                            setIsSubmitted(false);
                            setFormData({ name: "", email: "", phone: "", address: "", message: "" });
                            setWantBooking(false);
                            setSelectedDate(undefined);
                            setSelectedSlot(null);
                        }}
                    >
                        Send Another Message
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="min-h-screen bg-black py-10 px-4">
            <Card className="border-zinc-800 bg-zinc-900 shadow-2xl w-full max-w-3xl mx-auto">
                <CardHeader className="border-b border-zinc-800 pb-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-xl bg-violet-600/10 flex items-center justify-center">
                            <MessageSquare className="h-6 w-6 text-violet-400" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Contact Us</CardTitle>
                    <CardDescription className="text-zinc-400 mt-1.5 text-base">
                        Have a question? Fill out the form below and our team will respond as soon as possible.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-800/30 p-6 rounded-lg border border-zinc-800/50">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-zinc-300">Full Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="name"
                                    required
                                    placeholder="John Doe"
                                    className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-300">Email Address <span className="text-red-500">*</span></Label>
                                <Input
                                    id="email"
                                    required
                                    type="email"
                                    placeholder="john@example.com"
                                    className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-zinc-300">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address" className="text-zinc-300">Physical Address</Label>
                                <Input
                                    id="address"
                                    placeholder="123 Main St, City, Country"
                                    className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="message" className="text-zinc-300">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="How can we help you?"
                                    className="min-h-[120px] bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500 resize-none"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Booking Section */}
                        <div className="space-y-6 mt-8">
                            <div className="flex items-center space-x-3 bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                                <Checkbox
                                    id="want-booking"
                                    checked={wantBooking}
                                    onCheckedChange={(c) => setWantBooking(!!c)}
                                    className="border-zinc-500 data-[state=checked]:bg-violet-600 h-5 w-5"
                                />
                                <div className="space-y-1">
                                    <label htmlFor="want-booking" className="text-base font-medium text-white cursor-pointer select-none">
                                        I would also like to schedule an appointment
                                    </label>
                                    <p className="text-xs text-zinc-400">
                                        Book a time slot directly with your submission.
                                    </p>
                                </div>
                            </div>

                            {wantBooking && (
                                <div className="bg-zinc-800/30 p-6 rounded-lg border border-zinc-800/50 animate-in slide-in-from-top-4 fade-in duration-300 space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-white">Service Type</Label>
                                        <Select onValueChange={setSelectedBookingType}>
                                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                                <SelectValue placeholder="Select a service..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                                                {bookingTypes?.map((bt) => (
                                                    <SelectItem key={bt.id} value={bt.id}>
                                                        {bt.name} ({bt.duration_minutes} min)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedBookingType && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-white mb-2 block">Select Date</Label>
                                                <div className="border border-zinc-700 rounded-lg p-2 bg-zinc-900/50 inline-block">
                                                    <Calendar
                                                        mode="single"
                                                        selected={selectedDate}
                                                        onSelect={setSelectedDate}
                                                        disabled={(date) => date < new Date()}
                                                        className="rounded-md border-0"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-white mb-2 block">Available Slots</Label>
                                                {selectedDate ? (
                                                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                                                        {isSlotsLoading ? (
                                                            <div className="col-span-2 flex justify-center py-8">
                                                                <Loader2 className="animate-spin text-zinc-500" />
                                                            </div>
                                                        ) : slots && slots.length > 0 ? (
                                                            slots.map((slot) => (
                                                                <Button
                                                                    key={slot}
                                                                    type="button"
                                                                    variant={selectedSlot === slot ? "default" : "outline"}
                                                                    className={`w-full ${selectedSlot === slot ? "bg-violet-600 hover:bg-violet-700 border-transparent" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
                                                                    onClick={() => setSelectedSlot(slot)}
                                                                >
                                                                    <Clock className="w-4 h-4 mr-2" />
                                                                    {slot}
                                                                </Button>
                                                            ))
                                                        ) : (
                                                            <p className="col-span-2 text-zinc-500 text-sm text-center py-8 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
                                                                No slots available for this date.
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-zinc-500 text-sm italic pt-10 text-center">
                                                        Select a date to view available times.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <Button
                                type="submit"
                                className="w-full bg-violet-600 hover:bg-violet-700 h-14 text-xl font-bold rounded-xl transition-all hover:scale-[1.01] shadow-lg shadow-violet-900/20"
                                disabled={submitLead.isPending || (wantBooking && (!selectedDate || !selectedSlot || !selectedBookingType))}
                            >
                                {submitLead.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    wantBooking ? "Send Message & Schedule" : (
                                        <>
                                            Send Message
                                            <Send className="ml-2 h-4 w-4" />
                                        </>
                                    )
                                )}
                            </Button>
                            <p className="text-center text-xs text-zinc-500 mt-4">
                                By submitting this form, you agree to our privacy policy and terms of service.
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function PublicLeadPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>}>
            <LeadContent />
        </Suspense>
    );
}

