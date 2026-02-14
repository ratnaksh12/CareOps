"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Send,
    Search,
    UserPlus,
    MessageSquare,
    Phone,
    Mail,
    MoreVertical,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Conversation, Message, Contact } from "@/types";

export default function InboxPage() {
    const queryClient = useQueryClient();
    const [selectedConv, setSelectedConv] = useState<string | null>(null);
    const [messageText, setMessageText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [showNewContact, setShowNewContact] = useState(false);
    const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });

    const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
        queryKey: ["conversations"],
        queryFn: () => api.get("/conversations"),
        refetchInterval: 15000, // Poll every 15 seconds
    });

    const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
        queryKey: ["messages", selectedConv],
        queryFn: () => api.get(`/conversations/${selectedConv}/messages`),
        enabled: !!selectedConv,
        refetchInterval: 10000, // Poll every 10 seconds
    });

    const sendMessage = useMutation({
        mutationFn: (data: { content: string }) =>
            api.post(`/conversations/${selectedConv}/messages`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["messages", selectedConv] });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setMessageText("");
        },
    });

    const createContact = useMutation({
        mutationFn: (data: typeof newContact) => api.post("/contacts", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            setShowNewContact(false);
            setNewContact({ name: "", email: "", phone: "" });
            toast.success("Contact created!");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const filteredConvs = conversations.filter((c) =>
        c.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedConversation = conversations.find((c) => c.id === selectedConv);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inbox</h1>
                    <p className="text-zinc-400 mt-1">Unified conversations across all channels</p>
                </div>
                <Dialog open={showNewContact} onOpenChange={setShowNewContact}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700">
                            <UserPlus className="mr-2 h-4 w-4" />
                            New Contact
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="border-zinc-800 bg-zinc-900">
                        <DialogHeader>
                            <DialogTitle className="text-white">Add New Contact</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Name</Label>
                                <Input
                                    value={newContact.name}
                                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                    placeholder="Contact name"
                                    className="border-zinc-700 bg-zinc-800 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Email</Label>
                                <Input
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                    placeholder="email@example.com"
                                    className="border-zinc-700 bg-zinc-800 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Phone</Label>
                                <Input
                                    value={newContact.phone}
                                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                    placeholder="+1 (555) 000-0000"
                                    className="border-zinc-700 bg-zinc-800 text-white"
                                />
                            </div>
                            <Button
                                className="w-full bg-violet-600 hover:bg-violet-700"
                                onClick={() => createContact.mutate(newContact)}
                                disabled={!newContact.name}
                            >
                                Create Contact
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
                {/* Conversations List */}
                <Card className="lg:col-span-4 border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-zinc-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 border-zinc-700 bg-zinc-800 text-white text-sm"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1">
                        {convsLoading ? (
                            <div className="p-3 space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3">
                                        <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-24 bg-zinc-800" />
                                            <Skeleton className="h-3 w-32 bg-zinc-800" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredConvs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                                <MessageSquare className="h-8 w-8 mb-2" />
                                <p className="text-sm">No conversations yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-800/50">
                                {filteredConvs.map((conv) => (
                                    <button
                                        key={conv.id}
                                        onClick={() => setSelectedConv(conv.id)}
                                        className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${selectedConv === conv.id
                                            ? "bg-violet-600/10 border-l-2 border-l-violet-500"
                                            : "hover:bg-zinc-800/50 border-l-2 border-l-transparent"
                                            }`}
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white shrink-0">
                                            {conv.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-zinc-200 truncate">
                                                    {conv.contact?.name || "Unknown"}
                                                </p>
                                                {conv.unread_count > 0 && (
                                                    <Badge className="bg-violet-600 text-white text-[10px] px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                                                        {conv.unread_count}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-zinc-700 text-zinc-500">
                                                    {conv.status}
                                                </Badge>
                                                {conv.contact?.email && (
                                                    <Mail className="h-3 w-3 text-zinc-600" />
                                                )}
                                                {conv.contact?.phone && (
                                                    <Phone className="h-3 w-3 text-zinc-600" />
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </Card>

                {/* Messages */}
                <Card className="lg:col-span-8 border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
                    {!selectedConv ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                            <MessageSquare className="h-12 w-12 mb-3 text-zinc-700" />
                            <p className="text-lg font-medium">Select a conversation</p>
                            <p className="text-sm mt-1">Choose a contact to view the thread</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
                                        {selectedConversation?.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            {selectedConversation?.contact?.name || "Unknown"}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {selectedConversation?.contact?.email || selectedConversation?.contact?.phone || ""}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                                    {selectedConversation?.status}
                                </Badge>
                            </div>

                            {/* Messages List */}
                            <ScrollArea className="flex-1 p-4">
                                {msgsLoading ? (
                                    <div className="space-y-4">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                                                <Skeleton className="h-16 w-60 rounded-2xl bg-zinc-800" />
                                            </div>
                                        ))}
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-20">
                                        <p className="text-sm">No messages yet. Start the conversation!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {messages.map((msg) => {
                                            const isStaff = msg.sender_type === "staff";
                                            return (
                                                <div key={msg.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
                                                    <div
                                                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isStaff
                                                            ? "bg-violet-600 text-white rounded-br-md"
                                                            : "bg-zinc-800 text-zinc-200 rounded-bl-md"
                                                            }`}
                                                    >
                                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                        <p className={`text-[10px] mt-1 ${isStaff ? "text-violet-200" : "text-zinc-500"}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>

                            {/* Compose */}
                            <div className="p-4 border-t border-zinc-800">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (messageText.trim()) {
                                            sendMessage.mutate({ content: messageText });
                                        }
                                    }}
                                    className="flex gap-2"
                                >
                                    <Textarea
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        placeholder="Type a message..."
                                        className="border-zinc-700 bg-zinc-800 text-white resize-none min-h-[42px] max-h-[120px]"
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                if (messageText.trim()) {
                                                    sendMessage.mutate({ content: messageText });
                                                }
                                            }
                                        }}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        className="shrink-0 bg-violet-600 hover:bg-violet-700 h-[42px] w-[42px]"
                                        disabled={!messageText.trim() || sendMessage.isPending}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
