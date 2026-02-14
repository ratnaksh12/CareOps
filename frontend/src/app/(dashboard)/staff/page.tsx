"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    UserPlus,
    Shield,
    Inbox,
    Calendar,
    FileText,
    Package,
    Check,
    X,
    Loader2,
} from "lucide-react";

interface StaffMember {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    can_inbox: boolean;
    can_bookings: boolean;
    can_forms: boolean;
    can_inventory: boolean;
}

export default function StaffPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        email: "",
        full_name: "",
        password: "",
    });

    const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
        queryKey: ["staff"],
        queryFn: () => api.get("/staff"),
        enabled: user?.role === "admin",
    });

    const inviteMutation = useMutation({
        mutationFn: (data: typeof inviteForm) =>
            api.post("/staff/invite", {
                ...data,
                permissions: {
                    can_inbox: true,
                    can_bookings: true,
                    can_forms: true,
                    can_inventory: false,
                },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            setShowInvite(false);
            setInviteForm({ email: "", full_name: "", password: "" });
        },
    });

    const togglePermission = useMutation({
        mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
            api.patch(`/staff/${id}/permissions`, { [field]: value }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
    });

    if (user?.role !== "admin") {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-zinc-500">Staff management is only available for admins.</p>
            </div>
        );
    }

    const permissions = [
        { key: "can_inbox", label: "Inbox", icon: Inbox },
        { key: "can_bookings", label: "Bookings", icon: Calendar },
        { key: "can_forms", label: "Forms", icon: FileText },
        { key: "can_inventory", label: "Inventory", icon: Package },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Staff & Permissions</h1>
                    <p className="text-zinc-400 mt-1">
                        Manage team members and their access levels
                    </p>
                </div>
                <Button
                    onClick={() => setShowInvite(!showInvite)}
                    className="bg-violet-600 hover:bg-violet-700"
                >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Staff
                </Button>
            </div>

            {/* Invite Form */}
            {showInvite && (
                <Card className="border-violet-500/30 bg-violet-950/20">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-violet-400" />
                            Invite New Staff Member
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                inviteMutation.mutate(inviteForm);
                            }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={inviteForm.full_name}
                                onChange={(e) =>
                                    setInviteForm({ ...inviteForm, full_name: e.target.value })
                                }
                                required
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={inviteForm.email}
                                onChange={(e) =>
                                    setInviteForm({ ...inviteForm, email: e.target.value })
                                }
                                required
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={inviteForm.password}
                                    onChange={(e) =>
                                        setInviteForm({ ...inviteForm, password: e.target.value })
                                    }
                                    required
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                                <Button
                                    type="submit"
                                    disabled={inviteMutation.isPending}
                                    className="bg-violet-600 hover:bg-violet-700"
                                >
                                    {inviteMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Add"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Staff List */}
            {isLoading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
            ) : staff.length === 0 ? (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Users className="h-12 w-12 text-zinc-600 mb-4" />
                        <p className="text-zinc-400">No staff members yet. Invite your first team member!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {staff.map((member) => (
                        <Card key={member.id} className="border-zinc-800 bg-zinc-900/50">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-bold text-white">
                                            {member.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">
                                                {member.full_name}
                                            </p>
                                            <p className="text-zinc-500 text-sm">{member.email}</p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                member.role === "admin"
                                                    ? "border-violet-500/30 text-violet-400"
                                                    : "border-emerald-500/30 text-emerald-400"
                                            }
                                        >
                                            {member.role === "admin" ? (
                                                <><Shield className="h-3 w-3 mr-1" /> Admin</>
                                            ) : (
                                                "Staff"
                                            )}
                                        </Badge>
                                    </div>

                                    {/* Permission toggles */}
                                    <div className="flex items-center gap-2">
                                        {permissions.map((perm) => {
                                            const isEnabled =
                                                member[perm.key as keyof StaffMember] as boolean;
                                            return (
                                                <button
                                                    key={perm.key}
                                                    onClick={() =>
                                                        member.role !== "admin" &&
                                                        togglePermission.mutate({
                                                            id: member.id,
                                                            field: perm.key,
                                                            value: !isEnabled,
                                                        })
                                                    }
                                                    disabled={member.role === "admin"}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isEnabled
                                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                            : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50"
                                                        } ${member.role === "admin"
                                                            ? "opacity-50 cursor-not-allowed"
                                                            : "hover:opacity-80 cursor-pointer"
                                                        }`}
                                                    title={`${perm.label}: ${isEnabled ? "Enabled" : "Disabled"}`}
                                                >
                                                    <perm.icon className="h-3 w-3" />
                                                    {perm.label}
                                                    {isEnabled ? (
                                                        <Check className="h-3 w-3" />
                                                    ) : (
                                                        <X className="h-3 w-3" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
