"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Loader2, CheckCircle2, AlertCircle, Calendar as CalendarIcon, Clock } from "lucide-react";
import type { Form, BookingType } from "@/types";
import { format } from "date-fns";

export default function PublicFormPage() {
    const params = useParams();
    const formId = params.id as string;
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [title, setTitle] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Booking State
    const [wantBooking, setWantBooking] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [selectedBookingType, setSelectedBookingType] = useState<string | null>(null);

    // Fetch form details
    const { data: form, isLoading: isFormLoading, error: formError } = useQuery<Form>({
        queryKey: ["public-form", formId],
        queryFn: () => api.get(`/forms/${formId}/public`),
        retry: false,
    });

    // Fetch Booking Types (only if form is loaded)
    const { data: bookingTypes } = useQuery<BookingType[]>({
        queryKey: ["public-booking-types", form?.workspace_id],
        queryFn: () => api.get(`/public/booking-types?workspace_id=${form?.workspace_id}`),
        enabled: !!form?.workspace_id,
    });

    // Fetch Slots (when date and type selected)
    const { data: slots, isLoading: isSlotsLoading } = useQuery<string[]>({
        queryKey: ["public-slots", form?.workspace_id, selectedDate, selectedBookingType],
        queryFn: () => {
            if (!form?.workspace_id || !selectedDate || !selectedBookingType) return [];
            return api.get(`/public/slots`, {
                workspace_id: form.workspace_id,
                date: format(selectedDate, "yyyy-MM-dd"),
                booking_type_id: selectedBookingType,
            });
        },
        enabled: !!(form?.workspace_id && selectedDate && selectedBookingType),
    });

    const submitMutation = useMutation({
        mutationFn: async (data: any) => {
            // 1. Submit Form
            const submission = await api.post(`/forms/${formId}/submit`, data);

            // 2. Create Booking (if requested)
            if (wantBooking && selectedDate && selectedSlot && selectedBookingType) {
                const startTime = `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlot}:00`;
                await api.post(`/public/bookings`, {
                    booking_type_id: selectedBookingType,
                    start_time: startTime,
                    name: data.name || data.Name || data["Full Name"],
                    email: data.email || data.Email,
                    phone: data.phone || data.Phone,
                    notes: `Booked via Form: ${form?.name}`,
                });
            }
            return submission;
        },
        onSuccess: () => {
            setIsSubmitted(true);
            toast.success("Submitted successfully!");
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to submit");
        },
    });

    const handleInputChange = (fieldLabel: string, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [fieldLabel]: value,
        }));
    };

    if (isFormLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (formError || !form) {
        return (
            <Card className="border-red-500/20 bg-red-500/5 m-4">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                    <h2 className="text-xl font-semibold text-white">Form Not Found</h2>
                    <p className="text-zinc-400 mt-2">
                        This form may be inactive or does not exist.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (isSubmitted) {
        return (
            <Card className="border-emerald-500/20 bg-emerald-500/5 animate-in fade-in zoom-in duration-500 m-4 max-w-2xl mx-auto mt-10">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="rounded-full bg-emerald-500/10 p-4 mb-6">
                        <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Thank You!</h2>
                    <p className="text-zinc-300 mt-2 max-w-md">
                        Your response has been recorded.
                        {wantBooking && " Your appointment has also been scheduled. Check your email for confirmation."}
                    </p>
                    <Button
                        variant="outline"
                        className="mt-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => {
                            setIsSubmitted(false);
                            setFormData({});
                            setWantBooking(false);
                            setSelectedDate(undefined);
                            setSelectedSlot(null);
                        }}
                    >
                        Submit Another Response
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="min-h-screen bg-black py-10 px-4">
            <Card className="border-zinc-800 bg-zinc-900 shadow-2xl max-w-3xl mx-auto">
                <CardHeader className="border-b border-zinc-800 pb-6 text-center">
                    <CardTitle className="text-3xl font-bold text-white tracking-tight">{form.name}</CardTitle>
                    {form.description && (
                        <CardDescription className="text-zinc-400 mt-2 text-base">
                            {form.description}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-8">
                    <form onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(formData); }}>

                        {/* 1. Contact Info Section */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-white border-l-4 border-violet-500 pl-3">
                                Contact Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-800/30 p-6 rounded-lg border border-zinc-800/50">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Full Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        placeholder="John Doe"
                                        className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                        onChange={(e) => handleInputChange("name", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Email Address <span className="text-red-500">*</span></Label>
                                    <Input
                                        required
                                        type="email"
                                        placeholder="john@example.com"
                                        className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                        onChange={(e) => handleInputChange("email", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-zinc-300">Phone Number</Label>
                                    <Input
                                        type="tel"
                                        placeholder="+1 (555) 000-0000"
                                        className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                        onChange={(e) => handleInputChange("phone", e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Custom Fields Section */}
                        {form.fields.length > 0 && (
                            <div className="space-y-6 mt-8">
                                <h3 className="text-lg font-semibold text-white border-l-4 border-violet-500 pl-3">
                                    Additional Information
                                </h3>
                                <div className="space-y-6 bg-zinc-800/30 p-6 rounded-lg border border-zinc-800/50">
                                    {form.fields.map((field) => (
                                        <div key={field.id} className="space-y-2">
                                            <Label className="text-zinc-200 font-medium">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </Label>

                                            {field.type === "textarea" ? (
                                                <Textarea
                                                    required={field.required}
                                                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                    className="min-h-[100px] bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                                    onChange={(e) => handleInputChange(field.label, e.target.value)}
                                                />
                                            ) : field.type === "select" ? (
                                                <Select
                                                    required={field.required}
                                                    onValueChange={(val) => handleInputChange(field.label, val)}
                                                >
                                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white focus:ring-violet-500">
                                                        <SelectValue placeholder="Select an option" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                                                        {field.options?.map((opt) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : field.type === "checkbox" ? (
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={field.id}
                                                        required={field.required}
                                                        onCheckedChange={(checked) => handleInputChange(field.label, checked)}
                                                        className="border-zinc-600 data-[state=checked]:bg-violet-600"
                                                    />
                                                    <label htmlFor={field.id} className="text-sm font-medium text-zinc-300">
                                                        {field.label}
                                                    </label>
                                                </div>
                                            ) : (
                                                <Input
                                                    type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                                                    required={field.required}
                                                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                    className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-violet-500"
                                                    onChange={(e) => handleInputChange(field.label, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Booking Section (Optional) */}
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

                        <div className="pt-8">
                            <Button
                                type="submit"
                                className="w-full bg-violet-600 hover:bg-violet-700 h-14 text-xl font-bold rounded-xl transition-all hover:scale-[1.01] shadow-lg shadow-violet-900/20"
                                disabled={submitMutation.isPending || (wantBooking && (!selectedDate || !selectedSlot || !selectedBookingType))}
                            >
                                {submitMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "Submit & Schedule"
                                )}
                            </Button>
                            <p className="text-center text-xs text-zinc-500 mt-4">
                                By submitting this form, you agree to our Terms of Service and Privacy Policy.
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

