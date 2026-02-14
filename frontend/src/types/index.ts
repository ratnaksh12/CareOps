// ============== Core Types ==============

export interface Workspace {
    id: string;
    name: string;
    address: string;
    timezone: string;
    contact_email: string;
    is_active: boolean;
    onboarding_step: number;
    created_at: string;
}

export interface Contact {
    id: string;
    workspace_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    source: string;
    created_at: string;
}

export interface Conversation {
    id: string;
    workspace_id: string;
    contact_id: string;
    contact: Contact;
    status: "open" | "closed" | "snoozed";
    last_message_at: string;
    unread_count: number;
    tags: string[];
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_type: "staff" | "contact" | "system";
    sender_id: string | null;
    channel: "email" | "sms" | "internal";
    content: string;
    created_at: string;
}

export interface BookingType {
    id: string;
    workspace_id: string;
    name: string;
    duration_minutes: number;
    description: string;
    location: string;
    is_active: boolean;
    intake_form_id?: string;
}

export interface Booking {
    id: string;
    workspace_id: string;
    booking_type_id: string;
    booking_type: BookingType;
    contact_id: string;
    contact: Contact;
    staff_id: string | null;
    status: "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled";
    start_time: string;
    end_time: string;
    notes: string;
    created_at: string;
}

export interface Form {
    id: string;
    workspace_id: string;
    name: string;
    description: string;
    fields: FormField[];
    is_active: boolean;
    created_at: string;
}

export interface FormField {
    id: string;
    label: string;
    type: "text" | "textarea" | "email" | "phone" | "select" | "checkbox" | "file";
    required: boolean;
    options?: string[];
}

export interface FormSubmission {
    id: string;
    form_id: string;
    contact_id: string;
    contact: Contact;
    status: "pending" | "completed" | "overdue";
    data: Record<string, unknown>;
    submitted_at: string | null;
    created_at: string;
}

export interface InventoryItem {
    id: string;
    workspace_id: string;
    name: string;
    quantity: number;
    threshold: number;
    unit: string;
    created_at: string;
}

export interface Alert {
    id: string;
    workspace_id: string;
    type: "booking" | "inbox" | "form" | "inventory";
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    link_to: string;
    is_read: boolean;
    created_at: string;
}

export interface Integration {
    id: string;
    workspace_id: string;
    type: "email" | "sms" | "calendar" | "storage";
    provider: string;
    is_active: boolean;
    config: Record<string, unknown>;
}

export interface AutomationEvent {
    id: string;
    workspace_id: string;
    event_type: string;
    action_type: string;
    is_active: boolean;
    config: Record<string, unknown>;
}

// ============== Dashboard Types ==============

export interface DashboardStats {
    bookings_today: number;
    bookings_upcoming: number;
    completion_rate: number;
    no_shows: number;
    new_leads: number;
    open_conversations: number;
    unanswered_messages: number;
    forms_pending: number;
    forms_overdue: number;
    forms_completed: number;
    low_stock_items: number;
    critical_items: number;
    recent_alerts: Alert[];
}

// ============== API Response Types ==============

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: {
        id: string;
        email: string;
        full_name: string;
        role: string;
        workspace_id: string | null;
    };
}
