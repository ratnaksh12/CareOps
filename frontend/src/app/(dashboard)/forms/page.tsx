"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { Plus, FileText, Trash2, GripVertical, ExternalLink, Link as LinkIcon, ScanFace } from "lucide-react";
import { toast } from "sonner";
import type { Form, FormField, Contact } from "@/types";

export default function FormsPage() {
    const queryClient = useQueryClient();
    const [showNew, setShowNew] = useState(false);

    // Form Builder State
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [fields, setFields] = useState<FormField[]>([]);

    // Fill Form State
    const [fillForm, setFillForm] = useState<Form | null>(null);
    const [selectedContact, setSelectedContact] = useState<string>("");
    const [submissionData, setSubmissionData] = useState<Record<string, any>>({});

    const { data: forms = [], isLoading } = useQuery<Form[]>({
        queryKey: ["forms"],
        queryFn: () => api.get("/forms"),
    });

    const { data: contacts = [] } = useQuery<Contact[]>({
        queryKey: ["contacts"],
        queryFn: () => api.get("/contacts"),
    });

    const createForm = useMutation({
        mutationFn: (data: { name: string; description: string; fields: FormField[] }) =>
            api.post("/forms", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["forms"] });
            setShowNew(false);
            setFormName("");
            setFormDesc("");
            setFields([]);
            toast.success("Form created!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteForm = useMutation({
        mutationFn: (id: string) => api.delete(`/forms/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["forms"] });
            toast.success("Form deleted!");
        },
    });

    const submitForm = useMutation({
        mutationFn: (data: { form_id: string; contact_id: string; data: any }) =>
            api.post("/forms/submissions", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["forms"] });
            setFillForm(null);
            setSubmissionData({});
            setSelectedContact("");
            toast.success("Form submitted successfully!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const addField = () => {
        setFields([
            ...fields,
            { id: crypto.randomUUID(), label: "", type: "text", required: false },
        ]);
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        const updated = [...fields];
        updated[index] = { ...updated[index], ...updates };
        setFields(updated);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const handleFill = (form: Form) => {
        setFillForm(form);
        setSubmissionData({});
    };

    const updateSubmission = (fieldId: string, value: any) => {
        setSubmissionData(prev => ({ ...prev, [fieldId]: value }));
    };

    const copyPublicLink = (formId: string) => {
        const url = `${window.location.origin}/public/forms?id=${formId}`;
        navigator.clipboard.writeText(url);
        toast.success("Public link copied to clipboard");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Forms</h1>
                    <p className="text-zinc-400 mt-1">Build intake forms, agreements, and documents</p>
                </div>
                <Dialog open={showNew} onOpenChange={setShowNew}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700">
                            <Plus className="mr-2 h-4 w-4" /> New Form
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="border-zinc-800 bg-zinc-900 max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-white">Form Builder</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Form Name</Label>
                                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Patient Intake Form" className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Description</Label>
                                <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description..." className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-zinc-300">Fields</Label>
                                    <Button variant="outline" size="sm" onClick={addField} className="border-zinc-700 text-zinc-300">
                                        <Plus className="mr-1 h-3 w-3" /> Add Field
                                    </Button>
                                </div>
                                {fields.length === 0 && (
                                    <p className="text-sm text-zinc-500 text-center py-4">No fields yet. Add some fields to your form.</p>
                                )}
                                {fields.map((field, i) => (
                                    <div key={field.id} className="flex items-start gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                                        <GripVertical className="h-5 w-5 text-zinc-600 mt-2 shrink-0" />
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <Input
                                                value={field.label}
                                                onChange={(e) => updateField(i, { label: e.target.value })}
                                                placeholder="Field label"
                                                className="border-zinc-600 bg-zinc-700 text-white text-sm"
                                            />
                                            <Select value={field.type} onValueChange={(v) => updateField(i, { type: v as FormField["type"] })}>
                                                <SelectTrigger className="border-zinc-600 bg-zinc-700 text-white text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="border-zinc-700 bg-zinc-800">
                                                    {["text", "textarea", "email", "phone", "select", "checkbox", "file"].map((t) => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Switch
                                                checked={field.required}
                                                onCheckedChange={(v) => updateField(i, { required: v })}
                                            />
                                            <span className="text-xs text-zinc-500">Req</span>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeField(i)} className="text-zinc-500 hover:text-red-400 mt-1">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <Button
                                className="w-full bg-violet-600"
                                onClick={() => createForm.mutate({ name: formName, description: formDesc, fields })}
                                disabled={!formName || fields.length === 0}
                            >
                                Create Form
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Fill Form Dialog */}
            <Dialog open={!!fillForm} onOpenChange={(open) => !open && setFillForm(null)}>
                <DialogContent className="border-zinc-800 bg-zinc-900 max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white">Submit: {fillForm?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 mt-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Select Contact</Label>
                            <Select value={selectedContact} onValueChange={setSelectedContact}>
                                <SelectTrigger className="border-zinc-700 bg-zinc-800 text-white">
                                    <SelectValue placeholder="Select a contact..." />
                                </SelectTrigger>
                                <SelectContent className="border-zinc-700 bg-zinc-800">
                                    {contacts.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.email || c.phone || "No contact info"})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4 border-t border-zinc-800 pt-4">
                            {fillForm?.fields.map((field) => (
                                <div key={field.id} className="space-y-2">
                                    <Label className="text-zinc-300">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </Label>
                                    {field.type === "textarea" ? (
                                        <Textarea
                                            className="border-zinc-700 bg-zinc-800 text-white"
                                            onChange={(e) => updateSubmission(field.label, e.target.value)}
                                        />
                                    ) : (
                                        <Input
                                            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                                            className="border-zinc-700 bg-zinc-800 text-white"
                                            onChange={(e) => updateSubmission(field.label, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => submitForm.mutate({
                                form_id: fillForm!.id,
                                contact_id: selectedContact,
                                data: submissionData
                            })}
                            disabled={!selectedContact || Object.keys(submissionData).length === 0}
                        >
                            Submit Form
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="border-zinc-800 bg-zinc-900/50"><CardContent className="p-5"><Skeleton className="h-6 w-36 bg-zinc-800" /><Skeleton className="h-4 w-24 mt-2 bg-zinc-800" /></CardContent></Card>
                    ))}
                </div>
            ) : forms.length === 0 ? (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
                        <FileText className="h-12 w-12 mb-3 text-zinc-700" />
                        <p className="text-lg font-medium">No forms yet</p>
                        <p className="text-sm mt-1">Create a form to start collecting data</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {forms.map((form) => (
                        <Card key={form.id} className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors group">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                                            <FileText className="h-5 w-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{form.name}</p>
                                            <p className="text-xs text-zinc-500 mt-0.5">{form.fields?.length || 0} fields</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteForm.mutate(form.id)}
                                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                {form.description && (
                                    <p className="text-sm text-zinc-400 mt-3 line-clamp-2">{form.description}</p>
                                )}
                                <div className="flex items-center justify-between mt-4">
                                    <Badge variant="outline" className={form.is_active ? "border-emerald-700 text-emerald-400" : "border-zinc-700 text-zinc-500"}>
                                        {form.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                                            onClick={() => copyPublicLink(form.id)}
                                        >
                                            <LinkIcon className="mr-1 h-3 w-3" /> Share
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                            onClick={() => handleFill(form)}
                                        >
                                            <ScanFace className="mr-1 h-3 w-3" /> Fill
                                        </Button>
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
