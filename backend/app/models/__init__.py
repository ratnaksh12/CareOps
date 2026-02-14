import uuid as _uuid
from datetime import datetime
import enum
from typing import List, Optional, Dict, Any
from sqlalchemy import (
    String,
    Boolean,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Enum as SAEnum,
    PrimaryKeyConstraint,
    Column,
    Table,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def new_uuid() -> str:
    return str(_uuid.uuid4())

# ======================== Enums ========================

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"

class ConversationStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    SNOOZED = "snoozed"

class MessageChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    INTERNAL = "internal"

class SenderType(str, enum.Enum):
    STAFF = "staff"
    CONTACT = "contact"
    SYSTEM = "system"

class BookingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"

class FormSubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    OVERDUE = "overdue"

class AlertSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class AlertType(str, enum.Enum):
    BOOKING = "booking"
    INBOX = "inbox"
    FORM = "form"
    INVENTORY = "inventory"

class IntegrationType(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    CALENDAR = "calendar"
    STORAGE = "storage"

class EventType(str, enum.Enum):
    CONTACT_CREATED = "contact_created"
    BOOKING_CREATED = "booking_created"
    FORM_SUBMITTED = "form_submitted"
    INTERNAL = "internal"

# ======================== Models ========================

class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", foreign_keys=[workspace_id])

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="admin")
    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workspace: Mapped[Optional["Workspace"]] = relationship("Workspace", back_populates="users", foreign_keys=[workspace_id])

class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, default="")
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(50), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=1)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    google_calendar_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    users: Mapped[List["User"]] = relationship("User", back_populates="workspace", foreign_keys=[User.workspace_id])
    contacts: Mapped[List["Contact"]] = relationship("Contact", back_populates="workspace", cascade="all, delete-orphan")
    booking_types: Mapped[List["BookingType"]] = relationship("BookingType", back_populates="workspace", cascade="all, delete-orphan")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="workspace", cascade="all, delete-orphan")
    forms: Mapped[List["Form"]] = relationship("Form", back_populates="workspace", cascade="all, delete-orphan")
    inventory_items: Mapped[List["InventoryItem"]] = relationship("InventoryItem", back_populates="workspace", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="workspace", cascade="all, delete-orphan")
    integrations: Mapped[List["Integration"]] = relationship("Integration", back_populates="workspace", cascade="all, delete-orphan")
    automation_events: Mapped[List["AutomationEvent"]] = relationship("AutomationEvent", back_populates="workspace", cascade="all, delete-orphan")

class StaffRole(Base):
    __tablename__ = "staff_roles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    can_inbox: Mapped[bool] = mapped_column(Boolean, default=True)
    can_bookings: Mapped[bool] = mapped_column(Boolean, default=True)
    can_forms: Mapped[bool] = mapped_column(Boolean, default=True)
    can_inventory: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Contact(Base):
    __tablename__ = "contacts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="lead")
    source: Mapped[str] = mapped_column(String(100), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="contacts", foreign_keys=[workspace_id])
    conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="contact", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    contact_id: Mapped[str] = mapped_column(String(36), ForeignKey("contacts.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open")
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    automation_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    contact: Mapped["Contact"] = relationship("Contact", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), nullable=False)
    sender_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sender_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    channel: Mapped[str] = mapped_column(String(20), default="internal")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

class BookingType(Base):
    __tablename__ = "booking_types"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    intake_form_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("forms.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="booking_types")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="booking_type")
    intake_form: Mapped[Optional["Form"]] = relationship("Form", foreign_keys=[intake_form_id])
    required_inventory: Mapped[List["BookingTypeInventoryLink"]] = relationship("BookingTypeInventoryLink", back_populates="booking_type", cascade="all, delete-orphan")

class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    booking_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("booking_types.id"), nullable=False)
    contact_id: Mapped[str] = mapped_column(String(36), ForeignKey("contacts.id"), nullable=False)
    staff_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="bookings")
    booking_type: Mapped["BookingType"] = relationship("BookingType", back_populates="bookings")
    contact: Mapped["Contact"] = relationship("Contact")
    staff: Mapped[Optional["User"]] = relationship("User", foreign_keys=[staff_id])

class Form(Base):
    __tablename__ = "forms"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    fields: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="forms")
    submissions: Mapped[List["FormSubmission"]] = relationship("FormSubmission", back_populates="form", cascade="all, delete-orphan")

class FormSubmission(Base):
    __tablename__ = "form_submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    form_id: Mapped[str] = mapped_column(String(36), ForeignKey("forms.id"), nullable=False)
    contact_id: Mapped[str] = mapped_column(String(36), ForeignKey("contacts.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    form: Mapped["Form"] = relationship("Form", back_populates="submissions")
    contact: Mapped["Contact"] = relationship("Contact")

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    threshold: Mapped[int] = mapped_column(Integer, default=10)
    unit: Mapped[str] = mapped_column(String(50), default="units")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="inventory_items")
    booking_type_links: Mapped[List["BookingTypeInventoryLink"]] = relationship("BookingTypeInventoryLink", back_populates="inventory_item", cascade="all, delete-orphan")

class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="info")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, default="")
    link_to: Mapped[str] = mapped_column(String(255), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="alerts")

class Integration(Base):
    __tablename__ = "integrations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="integrations")

class AutomationEvent(Base):
    __tablename__ = "automation_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="automation_events")

class BookingTypeInventoryLink(Base):
    __tablename__ = "booking_type_inventory_links"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    booking_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("booking_types.id"), nullable=False)
    inventory_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("inventory_items.id"), nullable=False)
    quantity_required: Mapped[int] = mapped_column(Integer, default=1)
    booking_type: Mapped["BookingType"] = relationship("BookingType", back_populates="required_inventory")
    inventory_item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="booking_type_links")

class BusinessAvailability(Base):
    """Business hours / availability slots for each day of week."""
    __tablename__ = "business_availability"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # "09:00"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)    # "17:00"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

