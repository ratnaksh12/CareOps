"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Package, AlertTriangle, Edit, Trash2, Minus } from "lucide-react";
import { toast } from "sonner";
import type { InventoryItem } from "@/types";

export default function InventoryPage() {
    const queryClient = useQueryClient();
    const [showNew, setShowNew] = useState(false);
    const [newItem, setNewItem] = useState({ name: "", quantity: 0, threshold: 10, unit: "units" });
    const [editItem, setEditItem] = useState<InventoryItem | null>(null);

    const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
        queryKey: ["inventory"],
        queryFn: () => api.get("/inventory"),
    });

    const createItem = useMutation({
        mutationFn: (data: typeof newItem) => api.post("/inventory", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory"] });
            setShowNew(false);
            setNewItem({ name: "", quantity: 0, threshold: 10, unit: "units" });
            toast.success("Item added!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateItem = useMutation({
        mutationFn: ({ id, ...data }: { id: string; quantity?: number; threshold?: number; name?: string; unit?: string }) =>
            api.patch(`/inventory/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory"] });
            setEditItem(null);
            toast.success("Item updated!");
        },
    });

    const deleteItem = useMutation({
        mutationFn: (id: string) => api.delete(`/inventory/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory"] });
            toast.success("Item deleted!");
        },
    });

    const deductStock = useMutation({
        mutationFn: (id: string) => api.post(`/inventory/${id}/deduct?quantity=1`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["inventory"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const lowStock = items.filter((i) => i.quantity <= i.threshold && i.quantity > 0);
    const critical = items.filter((i) => i.quantity === 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory</h1>
                    <p className="text-zinc-400 mt-1">Track resources, supplies, and equipment</p>
                </div>
                <Dialog open={showNew} onOpenChange={setShowNew}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="border-zinc-800 bg-zinc-900">
                        <DialogHeader>
                            <DialogTitle className="text-white">Add Inventory Item</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Name</Label>
                                <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Latex Gloves" className="border-zinc-700 bg-zinc-800 text-white" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Quantity</Label>
                                    <Input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Threshold</Label>
                                    <Input type="number" value={newItem.threshold} onChange={(e) => setNewItem({ ...newItem, threshold: Number(e.target.value) })} className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Unit</Label>
                                    <Input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="border-zinc-700 bg-zinc-800 text-white" />
                                </div>
                            </div>
                            <Button className="w-full bg-violet-600" onClick={() => createItem.mutate(newItem)} disabled={!newItem.name}>Add Item</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Alerts Summary */}
            {(lowStock.length > 0 || critical.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lowStock.length > 0 && (
                        <Card className="border-amber-500/20 bg-amber-500/5">
                            <CardContent className="flex items-center gap-3 p-4">
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                                <div>
                                    <p className="text-sm font-medium text-amber-400">{lowStock.length} Low Stock Items</p>
                                    <p className="text-xs text-zinc-500">Below threshold, reorder recommended</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {critical.length > 0 && (
                        <Card className="border-red-500/20 bg-red-500/5">
                            <CardContent className="flex items-center gap-3 p-4">
                                <AlertTriangle className="h-5 w-5 text-red-400" />
                                <div>
                                    <p className="text-sm font-medium text-red-400">{critical.length} Critical Items</p>
                                    <p className="text-xs text-zinc-500">Out of stock — immediate action needed</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Inventory Table */}
            {isLoading ? (
                <Card className="border-zinc-800 bg-zinc-900/50"><CardContent className="p-4"><Skeleton className="h-64 w-full bg-zinc-800" /></CardContent></Card>
            ) : items.length === 0 ? (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
                        <Package className="h-12 w-12 mb-3 text-zinc-700" />
                        <p className="text-lg font-medium">No inventory items</p>
                        <p className="text-sm mt-1">Add items to start tracking your resources</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Item</TableHead>
                                <TableHead className="text-zinc-400">Stock Level</TableHead>
                                <TableHead className="text-zinc-400 text-center">Qty</TableHead>
                                <TableHead className="text-zinc-400 text-center">Threshold</TableHead>
                                <TableHead className="text-zinc-400">Status</TableHead>
                                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item) => {
                                const pct = item.threshold > 0 ? Math.min((item.quantity / (item.threshold * 2)) * 100, 100) : 100;
                                const status = item.quantity === 0 ? "critical" : item.quantity <= item.threshold ? "low" : "ok";
                                return (
                                    <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/30">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                                                    <Package className="h-4 w-4 text-zinc-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{item.name}</p>
                                                    <p className="text-xs text-zinc-500">{item.unit}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-40">
                                            <Progress value={pct} className={`h-2 ${status === "critical" ? "[&>div]:bg-red-500" : status === "low" ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`} />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-white font-mono font-semibold">{item.quantity}</span>
                                        </TableCell>
                                        <TableCell className="text-center text-zinc-500">{item.threshold}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                status === "critical" ? "border-red-500/30 text-red-400" :
                                                    status === "low" ? "border-amber-500/30 text-amber-400" :
                                                        "border-emerald-500/30 text-emerald-400"
                                            }>
                                                {status === "critical" ? "Out of Stock" : status === "low" ? "Low Stock" : "In Stock"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-amber-400" onClick={() => deductStock.mutate(item.id)} disabled={item.quantity === 0}>
                                                    <Minus className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => deleteItem.mutate(item.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
