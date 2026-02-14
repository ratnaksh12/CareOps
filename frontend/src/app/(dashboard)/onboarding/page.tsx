"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Building2,
    Mail,
    Phone,
    Calendar,
    FileText,
    Package,
    Users,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Zap,
    Lock,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";

const steps = [
    { icon: Building2, title: "Workspace", desc: "Set up your business" },
    { icon: Mail, title: "Communication", desc: "Email & SMS connected" },
    { icon: Phone, title: "Contact Form", desc: "Lead capture setup" },
    { icon: Calendar, title: "Bookings", desc: "Service configuration" },
    { icon: FileText, title: "Forms", desc: "Intake & agreements" },
    { icon: Package, title: "Inventory", desc: "Resource tracking" },
    { icon: Users, title: "Staff", desc: "Team permissions" },
    { icon: CheckCircle2, title: "Activate", desc: "Go live!" },
];

interface OnboardingStatus {
    current_step: number;
    steps_completed: Record<string, boolean>;
}

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Common timezones
const commonTimezones = [
    "UTC",
    "Asia/Calcutta",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Australia/Sydney",
];

export default function OnboardingPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, setAuth } = useAuthStore();
    const [step, setStep] = useState(0);
    const [workspace, setWorkspace] = useState({
        name: "",
        address: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        contact_email: user?.email || "",
    });
    const [bookingType, setBookingType] = useState({ name: "", duration_minutes: 60, location: "", description: "" });
    const [inventoryItem, setInventoryItem] = useState({ name: "", quantity: 0, threshold: 10, unit: "units" });

    // Load onboarding progress from backend
    const { data: onboardingStatus, isLoading: statusLoading } = useQuery<OnboardingStatus>({
        queryKey: ["onboarding-status"],
        queryFn: () => api.get("/workspaces/onboarding-status"),
    });

    // Sync step from backend on load
    useEffect(() => {
        if (onboardingStatus) {
            // Convert 1-indexed backend step to 0-indexed frontend step
            const backendStep = Math.max(0, onboardingStatus.current_step - 1);
            setStep(Math.min(backendStep, 7));
        }
    }, [onboardingStatus]);

    // Save progress to backend
    const saveProgress = useMutation({
        mutationFn: (nextStep: number) =>
            api.patch("/workspaces/onboarding-step", { step: nextStep }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-status"] }),
    });

    const advanceToStep = (nextStep: number) => {
        setStep(nextStep);
        // Backend uses 1-indexed steps
        saveProgress.mutate(nextStep + 1);
    };

    // Check if a step is unlocked (all previous steps must be complete)
    const isStepUnlocked = (stepIndex: number): boolean => {
        if (stepIndex === 0) return true;
        if (!onboardingStatus) return false;
        // Check all previous steps are marked complete
        for (let i = 1; i <= stepIndex; i++) {
            if (!onboardingStatus.steps_completed[`step_${i}`]) return false;
        }
        return true;
    };

    const createWorkspace = useMutation({
        mutationFn: () => api.post("/workspaces", workspace),
        onSuccess: async () => {
            const me = await api.get<any>("/auth/me");
            if (user) {
                const token = localStorage.getItem("careops_token") || "";
                setAuth({ ...user, workspace_id: me.workspace_id }, token);
            }
            toast.success("Workspace created!");
            advanceToStep(1);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const createBookingType = useMutation({
        mutationFn: () => api.post("/bookings/types", bookingType),
        onSuccess: () => {
            toast.success("Booking type created!");
            advanceToStep(4);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const createInventory = useMutation({
        mutationFn: () => api.post("/inventory", inventoryItem),
        onSuccess: () => {
            toast.success("Inventory item added!");
            advanceToStep(6);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const activateWorkspace = useMutation({
        mutationFn: () => api.post("/workspaces/activate"),
        onSuccess: () => {
            toast.success("🎉 Workspace activated! You're ready to go.");
            queryClient.invalidateQueries();
            router.push("/dashboard");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    if (statusLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
        );
    }

    const renderStepContent = () => {
        switch (step) {
            case 0:
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Business Name *</Label>
                            <Input value={workspace.name} onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })} placeholder="Your Business Name" className="border-zinc-700 bg-zinc-800 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Address *</Label>
                            <Input value={workspace.address} onChange={(e) => setWorkspace({ ...workspace, address: e.target.value })} placeholder="123 Main St, City, State" className="border-zinc-700 bg-zinc-800 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Timezone</Label>
                                <Select
                                    value={workspace.timezone}
                                    onValueChange={(val) => setWorkspace({ ...workspace, timezone: val })}
                                >
                                    <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white max-h-60">
                                        {commonTimezones.map((tz) => (
                                            <SelectItem key={tz} value={tz}>
                                                {tz}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Contact Email</Label>
                                <Input value={workspace.contact_email} onChange={(e) => setWorkspace({ ...workspace, contact_email: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => createWorkspace.mutate()} disabled={!workspace.name || !workspace.address || createWorkspace.isPending}>
                            {createWorkspace.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create Workspace
                        </Button>
                    </div>
                );
            case 1:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Your communication channels are pre-configured:</p>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-400" /><span className="text-sm text-zinc-300">Email (Resend)</span></div>
                                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</span>
                            </div>
                            <p className="text-xs text-zinc-500">Automated welcome emails, booking confirmations, and form reminders.</p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-400" /><span className="text-sm text-zinc-300">SMS (Twilio)</span></div>
                                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</span>
                            </div>
                            <p className="text-xs text-zinc-500">SMS reminders, short updates, and booking notifications.</p>
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => advanceToStep(2)}>
                            Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Your contact form is automatically generated. When someone fills it out:</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Contact record created automatically</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Conversation started in your Inbox</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Welcome email & SMS sent via Resend + Twilio</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Alert appears on Dashboard</div>
                        </div>
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs text-zinc-500">
                            💡 You'll get a shareable public URL after activation: <code className="text-violet-400">/book/your-workspace/contact</code>
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => advanceToStep(3)}>
                            Continue <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Define the services your business offers. This generates your public booking page.</p>
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Service Name *</Label>
                            <Input value={bookingType.name} onChange={(e) => setBookingType({ ...bookingType, name: e.target.value })} placeholder="e.g. Initial Consultation" className="border-zinc-700 bg-zinc-800 text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Duration (min)</Label>
                                <Input type="number" value={bookingType.duration_minutes} onChange={(e) => setBookingType({ ...bookingType, duration_minutes: Number(e.target.value) })} className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Location</Label>
                                <Input value={bookingType.location} onChange={(e) => setBookingType({ ...bookingType, location: e.target.value })} placeholder="Office, Virtual..." className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => createBookingType.mutate()} disabled={!bookingType.name || createBookingType.isPending}>
                            {createBookingType.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create & Continue
                        </Button>
                        <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-300" onClick={() => advanceToStep(4)}>Skip for now</Button>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Set up intake forms, agreements, and documents. These are sent automatically after bookings.</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Forms sent automatically after booking</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Track completion status per client</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Send reminders for pending forms</div>
                        </div>
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs text-zinc-500">
                            💡 You can create and manage forms from the <strong className="text-zinc-300">Forms</strong> page after onboarding.
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => advanceToStep(5)}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                );
            case 5:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Track items and resources used per booking. Get low-stock alerts automatically.</p>
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Item Name *</Label>
                            <Input value={inventoryItem.name} onChange={(e) => setInventoryItem({ ...inventoryItem, name: e.target.value })} placeholder="e.g. Examination Gloves" className="border-zinc-700 bg-zinc-800 text-white" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Quantity</Label>
                                <Input type="number" value={inventoryItem.quantity} onChange={(e) => setInventoryItem({ ...inventoryItem, quantity: Number(e.target.value) })} className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Threshold</Label>
                                <Input type="number" value={inventoryItem.threshold} onChange={(e) => setInventoryItem({ ...inventoryItem, threshold: Number(e.target.value) })} className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Unit</Label>
                                <Input value={inventoryItem.unit} onChange={(e) => setInventoryItem({ ...inventoryItem, unit: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => createInventory.mutate()} disabled={!inventoryItem.name || createInventory.isPending}>
                            {createInventory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Add & Continue
                        </Button>
                        <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-300" onClick={() => advanceToStep(6)}>Skip for now</Button>
                    </div>
                );
            case 6:
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Invite team members and control what they can access.</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Inbox access control</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Booking management</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Form tracking visibility</div>
                            <div className="flex items-center gap-2 text-zinc-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Inventory visibility</div>
                        </div>
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs text-zinc-500">
                            💡 You can invite and manage staff from the <strong className="text-zinc-300">Staff</strong> page after onboarding.
                        </div>
                        <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => advanceToStep(7)}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                );
            case 7:
                return (
                    <div className="space-y-6 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 mx-auto shadow-lg shadow-emerald-600/20">
                            <Zap className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Ready to go live!</h3>
                            <p className="text-sm text-zinc-400 mt-2">Your workspace is fully configured. Once you activate, your public forms and booking links will go live.</p>
                        </div>
                        <div className="text-left space-y-2 text-sm rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                            <p className="text-zinc-300 font-medium mb-2">What happens on activation:</p>
                            <div className="flex items-center gap-2 text-zinc-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Public contact form goes live</div>
                            <div className="flex items-center gap-2 text-zinc-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Booking links work for clients</div>
                            <div className="flex items-center gap-2 text-zinc-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Automation starts running</div>
                            <div className="flex items-center gap-2 text-zinc-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Email & SMS notifications active</div>
                        </div>
                        <Button
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-lg py-6 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20"
                            onClick={() => activateWorkspace.mutate()}
                            disabled={activateWorkspace.isPending}
                        >
                            {activateWorkspace.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            🚀 Activate Workspace
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center">
            <div className="w-full max-w-2xl">
                {/* Step Progress Indicators */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        {steps.map((s, i) => {
                            const Icon = s.icon;
                            const unlocked = isStepUnlocked(i);
                            const isComplete = i < step;
                            const isCurrent = i === step;
                            return (
                                <button
                                    key={i}
                                    onClick={() => unlocked && i <= step && setStep(i)}
                                    disabled={!unlocked}
                                    className="flex flex-col items-center gap-1.5 group"
                                >
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${isComplete ? "bg-emerald-600 text-white" :
                                        isCurrent ? "bg-violet-600 text-white ring-4 ring-violet-600/20" :
                                            unlocked ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" :
                                                "bg-zinc-900 text-zinc-700 cursor-not-allowed"
                                        }`}>
                                        {isComplete ? <CheckCircle2 className="h-5 w-5" /> :
                                            !unlocked ? <Lock className="h-3.5 w-3.5" /> :
                                                <Icon className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-[10px] font-medium ${isComplete ? "text-emerald-400" :
                                        isCurrent ? "text-violet-300" :
                                            unlocked ? "text-zinc-400" : "text-zinc-700"
                                        }`}>{s.title}</span>
                                </button>
                            );
                        })}
                    </div>
                    <Progress value={((step) / (steps.length - 1)) * 100} className="h-1 [&>div]:bg-violet-600" />
                </div>

                {/* Step Card */}
                <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur">
                    <CardContent className="p-8">
                        <div className="mb-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">
                                    Step {step + 1} of {steps.length}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mt-2">{steps[step].title}</h2>
                            <p className="text-zinc-400 mt-1">{steps[step].desc}</p>
                        </div>
                        {renderStepContent()}
                        {step > 0 && step < 7 && (
                            <Button variant="ghost" className="mt-4 text-zinc-500 hover:text-zinc-300" onClick={() => setStep(step - 1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
