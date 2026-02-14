
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import type { DashboardStats } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceAssistantProps {
    stats: DashboardStats;
}

export function VoiceAssistant({ stats }: VoiceAssistantProps) {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            // Initialize Speech Synthesis
            synthRef.current = window.speechSynthesis;

            // Initialize Speech Recognition
            const SpeechRecognition =
                (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = "en-US";

                recognition.onstart = () => {
                    setIsListening(true);
                    toast.info("Listening... Say 'Status Report'");
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript.toLowerCase();
                    console.log("Voice command:", transcript);
                    handleCommand(transcript);
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                    if (event.error === 'not-allowed') {
                        toast.error("Microphone access denied.");
                    } else {
                        toast.error("Could not understand audio.");
                    }
                };

                recognitionRef.current = recognition;
            } else {
                console.warn("Speech Recognition not supported in this browser.");
            }
        }
    }, [stats]);

    const handleCommand = (command: string) => {
        if (
            command.includes("status") ||
            command.includes("report") ||
            command.includes("update") ||
            command.includes("overview") ||
            command.includes("hello")
        ) {
            readStatusReport();
        } else {
            toast.warning(`Unknown command: "${command}". Try "Status Report"`);
        }
    };

    const readStatusReport = () => {
        if (!synthRef.current) return;

        // Cancel any current speech
        synthRef.current.cancel();

        const chunks = [];

        // Intro
        chunks.push("Here is your CareOps status report.");

        // Bookings
        if (stats.bookings_today > 0) {
            chunks.push(`You have ${stats.bookings_today} booking${stats.bookings_today === 1 ? '' : 's'} today.`);
        } else {
            chunks.push("You have no bookings for today.");
        }

        if (stats.bookings_upcoming > 0) {
            chunks.push(`Looking ahead, you have ${stats.bookings_upcoming} upcoming booking${stats.bookings_upcoming === 1 ? '' : 's'} in the next 7 days.`);
        }

        // Completion & issues
        if (stats.no_shows > 0) {
            chunks.push(`Attention needed, there were ${stats.no_shows} no-shows recently.`);
        }

        // Leads/Inbox
        if (stats.new_leads > 0) {
            chunks.push(`You have acquired ${stats.new_leads} new lead${stats.new_leads === 1 ? '' : 's'}.`);
        }

        if (stats.unanswered_messages > 0) {
            chunks.push(`Crucial: You have ${stats.unanswered_messages} unanswered message${stats.unanswered_messages === 1 ? '' : 's'} waiting in your inbox.`);
        } else {
            chunks.push("Your inbox is all caught up.");
        }

        // Forms
        if (stats.forms_overdue > 0) {
            chunks.push(`Warning: There are ${stats.forms_overdue} overdue form submissions.`);
        }
        if (stats.forms_pending > 0) {
            chunks.push(`There are ${stats.forms_pending} forms pending completion.`);
        }

        // Inventory
        if (stats.low_stock_items > 0) {
            chunks.push(`Inventory check: ${stats.low_stock_items} item${stats.low_stock_items === 1 ? '' : 's'} cover low stock.`);
        }
        if (stats.critical_items > 0) {
            chunks.push(`Critical: ${stats.critical_items} item${stats.critical_items === 1 ? '' : 's'} cover out of stock.`);
        }

        // Outro
        chunks.push("That concludes your update. Have a productive day.");

        const text = chunks.join(" ");
        const utterance = new SpeechSynthesisUtterance(text);

        // Optional: Select a better voice
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        synthRef.current.speak(utterance);
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            toast.error("Voice recognition not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            // Stop speaking if currently speaking
            if (isSpeaking) {
                synthRef.current?.cancel();
                setIsSpeaking(false);
            }
            try {
                recognitionRef.current.start();
            } catch (e) {
                // handle case where it might already be started
                console.error(e);
            }
        }
    };

    const stopSpeaking = () => {
        synthRef.current?.cancel();
        setIsSpeaking(false);
    };

    if (!stats) return null;

    return (
        <div className="flex items-center gap-2">
            {isSpeaking ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={stopSpeaking}
                    className="border-violet-500/50 text-violet-400 hover:bg-violet-950/30 animate-pulse"
                >
                    <Volume2 className="h-4 w-4 mr-2" />
                    Speaking... (Click to Stop)
                </Button>
            ) : (
                <Button
                    variant={isListening ? "default" : "outline"}
                    size="sm"
                    onClick={toggleListening}
                    className={cn(
                        "transition-all duration-300",
                        isListening
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-500 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                            : "border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                >
                    {isListening ? (
                        <>
                            <MicOff className="h-4 w-4 mr-2" />
                            Listening...
                        </>
                    ) : (
                        <>
                            <Mic className="h-4 w-4 mr-2" />
                            Voice Assistant
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
