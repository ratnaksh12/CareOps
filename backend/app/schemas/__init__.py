from datetime import datetime
from pydantic import BaseModel, Field


# ======================== Auth Schemas ========================

class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    workspace_id: str | None = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ======================== Workspace Schemas ========================

class WorkspaceCreate(BaseModel):
    name: str
    address: str = ""
    timezone: str = "UTC"
    contact_email: str = ""


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    timezone: str | None = None
    contact_email: str | None = None
    onboarding_step: int | None = None


class WorkspaceOut(BaseModel):
    id: str
    name: str
    address: str
    timezone: str
    contact_email: str
    is_active: bool
    onboarding_step: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Contact Schemas ========================

class ContactCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    source: str = "manual"


class ContactUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class ContactOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Conversation Schemas ========================

class ConversationOut(BaseModel):
    id: str
    workspace_id: str
    contact_id: str
    contact: ContactOut | None = None
    status: str
    last_message_at: datetime | None
    unread_count: int
    tags: list[str] = []

    model_config = {"from_attributes": True}


# ======================== Message Schemas ========================

class MessageCreate(BaseModel):
    content: str
    channel: str = "internal"


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_type: str
    sender_id: str | None
    channel: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Booking Type Schemas ========================

class BookingTypeCreate(BaseModel):
    name: str
    duration_minutes: int = 60
    description: str = ""
    location: str = ""
    intake_form_id: str | None = None


class BookingTypeUpdate(BaseModel):
    name: str | None = None
    duration_minutes: int | None = None
    description: str | None = None
    location: str | None = None
    is_active: bool | None = None
    intake_form_id: str | None = None


class BookingTypeOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    duration_minutes: int
    description: str
    location: str
    is_active: bool
    intake_form_id: str | None = None

    model_config = {"from_attributes": True}


# ======================== Booking Schemas ========================

class BookingCreate(BaseModel):
    booking_type_id: str
    contact_id: str
    staff_id: str | None = None
    start_time: datetime
    end_time: datetime
    notes: str = ""


class BookingUpdate(BaseModel):
    status: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    notes: str | None = None
    staff_id: str | None = None


class BookingOut(BaseModel):
    id: str
    workspace_id: str
    booking_type_id: str
    booking_type: BookingTypeOut | None = None
    contact_id: str
    contact: ContactOut | None = None
    staff_id: str | None
    status: str
    start_time: datetime
    end_time: datetime
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Form Schemas ========================

class FormFieldSchema(BaseModel):
    id: str = ""
    label: str
    type: str = "text"
    required: bool = False
    options: list[str] = []


class FormCreate(BaseModel):
    name: str
    description: str = ""
    fields: list[FormFieldSchema] = []


class FormUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    fields: list[FormFieldSchema] | None = None
    is_active: bool | None = None


class FormOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str
    fields: list[dict] = []
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Form Submission Schemas ========================

class FormSubmissionCreate(BaseModel):
    form_id: str
    contact_id: str
    data: dict = {}


class FormSubmissionUpdate(BaseModel):
    status: str | None = None
    data: dict | None = None
    submitted_at: datetime | None = None


class FormSubmissionOut(BaseModel):
    id: str
    form_id: str
    contact_id: str
    contact: ContactOut | None = None
    status: str
    data: dict = {}
    submitted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Inventory Schemas ========================

class InventoryItemCreate(BaseModel):
    name: str
    quantity: int = 0
    threshold: int = 10
    unit: str = "units"


class InventoryItemUpdate(BaseModel):
    name: str | None = None
    quantity: int | None = None
    threshold: int | None = None
    unit: str | None = None


class InventoryItemOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    quantity: int
    threshold: int
    unit: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Alert Schemas ========================

class AlertOut(BaseModel):
    id: str
    workspace_id: str
    type: str
    severity: str
    title: str
    message: str
    link_to: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Integration Schemas ========================

class IntegrationCreate(BaseModel):
    type: str
    provider: str
    config: dict = {}


class IntegrationOut(BaseModel):
    id: str
    workspace_id: str
    type: str
    provider: str
    is_active: bool
    config: dict = {}
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Automation Schemas ========================

class AutomationEventCreate(BaseModel):
    event_type: str
    action_type: str
    config: dict = {}


class AutomationEventOut(BaseModel):
    id: str
    workspace_id: str
    event_type: str
    action_type: str
    is_active: bool
    config: dict = {}
    last_triggered_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ======================== Dashboard Schemas ========================

class DashboardStats(BaseModel):
    bookings_today: int = 0
    bookings_upcoming: int = 0
    completion_rate: float = 0.0
    no_shows: int = 0
    new_leads: int = 0
    open_conversations: int = 0
    unanswered_messages: int = 0
    forms_pending: int = 0
    forms_overdue: int = 0
    forms_completed: int = 0
    low_stock_items: int = 0
    critical_items: int = 0
    recent_alerts: list[AlertOut] = []
