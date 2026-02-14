from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    User, Booking, BookingStatus, Contact, Conversation, ConversationStatus,
    Form, FormSubmission, FormSubmissionStatus, InventoryItem, Alert,
)
from app.schemas import DashboardStats, AlertOut
from app.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")

    wid = user.workspace_id
    
    # Run background checks for alerts (Lazy evaluation)
    # Run background checks for alerts (Lazy evaluation)
    # from app.services.automation import AutomationService
    # try:
    #     await AutomationService.check_and_create_alerts(db, wid)
    # except Exception as e:
    #     import logging
    #     logging.getLogger("dashboard").error(f"Failed to run alert checks: {e}")

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    week_ahead = today + timedelta(days=7)
    last_7_days = today - timedelta(days=7)

    # Bookings today
    result = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.workspace_id == wid,
            Booking.start_time >= today,
            Booking.start_time < tomorrow,
        )
    )
    bookings_today = result.scalar() or 0

    # Upcoming bookings (next 7 days)
    result = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.workspace_id == wid,
            Booking.start_time >= tomorrow,
            Booking.start_time < week_ahead,
        )
    )
    bookings_upcoming = result.scalar() or 0

    # Completion rate (last 7 days)
    result = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.workspace_id == wid,
            Booking.start_time >= last_7_days,
        )
    )
    total_recent = result.scalar() or 0

    result = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.workspace_id == wid,
            Booking.status == BookingStatus.COMPLETED,
            Booking.start_time >= last_7_days,
        )
    )
    completed_recent = result.scalar() or 0
    completion_rate = (completed_recent / total_recent * 100) if total_recent > 0 else 0

    # No shows
    result = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.workspace_id == wid,
            Booking.status == BookingStatus.NO_SHOW,
            Booking.start_time >= last_7_days,
        )
    )
    no_shows = result.scalar() or 0

    # New leads (contacts in last 7 days)
    result = await db.execute(
        select(func.count()).select_from(Contact).where(
            Contact.workspace_id == wid,
            Contact.created_at >= last_7_days,
        )
    )
    new_leads = result.scalar() or 0

    # Open conversations
    result = await db.execute(
        select(func.count()).select_from(Conversation).where(
            Conversation.workspace_id == wid,
            Conversation.status == ConversationStatus.OPEN,
        )
    )
    open_conversations = result.scalar() or 0

    # Unanswered (open conversations with unread > 0)
    result = await db.execute(
        select(func.count()).select_from(Conversation).where(
            Conversation.workspace_id == wid,
            Conversation.status == ConversationStatus.OPEN,
            Conversation.unread_count > 0,
        )
    )
    unanswered_messages = result.scalar() or 0

    # Forms
    result = await db.execute(
        select(func.count()).select_from(FormSubmission)
        .join(Form)
        .where(
            Form.workspace_id == wid,
            FormSubmission.status == FormSubmissionStatus.PENDING,
        )
    )
    forms_pending = result.scalar() or 0

    result = await db.execute(
        select(func.count()).select_from(FormSubmission)
        .join(Form)
        .where(
            Form.workspace_id == wid,
            FormSubmission.status == FormSubmissionStatus.OVERDUE,
        )
    )
    forms_overdue = result.scalar() or 0

    result = await db.execute(
        select(func.count()).select_from(FormSubmission)
        .join(Form)
        .where(
            Form.workspace_id == wid,
            FormSubmission.status == FormSubmissionStatus.COMPLETED,
        )
    )
    forms_completed = result.scalar() or 0

    # Inventory
    result = await db.execute(
        select(func.count()).select_from(InventoryItem).where(
            InventoryItem.workspace_id == wid,
            InventoryItem.quantity <= InventoryItem.threshold,
            InventoryItem.quantity > 0,
        )
    )
    low_stock_items = result.scalar() or 0

    result = await db.execute(
        select(func.count()).select_from(InventoryItem).where(
            InventoryItem.workspace_id == wid,
            InventoryItem.quantity == 0,
        )
    )
    critical_items = result.scalar() or 0

    # Recent alerts
    result = await db.execute(
        select(Alert)
        .where(Alert.workspace_id == wid)
        .order_by(Alert.created_at.desc())
        .limit(10)
    )
    recent_alerts = [AlertOut.model_validate(a) for a in result.scalars().all()]

    return DashboardStats(
        bookings_today=bookings_today,
        bookings_upcoming=bookings_upcoming,
        completion_rate=round(completion_rate, 1),
        no_shows=no_shows,
        new_leads=new_leads,
        open_conversations=open_conversations,
        unanswered_messages=unanswered_messages,
        forms_pending=forms_pending,
        forms_overdue=forms_overdue,
        forms_completed=forms_completed,
        low_stock_items=low_stock_items,
        critical_items=critical_items,
        recent_alerts=recent_alerts,
    )
