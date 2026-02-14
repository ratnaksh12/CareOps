from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from app.database import get_db, async_session
from app.models import Booking, BookingType, Contact, User, BookingStatus, Workspace, BusinessAvailability
from app.schemas import (
    BookingOut, BookingTypeOut,
)

router = APIRouter(prefix="/public", tags=["Public Bookings"])

async def get_default_workspace_id(db: AsyncSession) -> str:
    """Helper to get the default workspace ID (most recently created)"""
    result = await db.execute(select(Workspace.id).order_by(Workspace.created_at.desc()).limit(1))
    ws_id = result.scalar_one_or_none()
    if not ws_id:
        raise HTTPException(status_code=404, detail="No active workspace found")
    return ws_id

@router.get("/booking-types", response_model=list[BookingTypeOut])
async def list_public_booking_types(
    workspace_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch all active booking types.
    If workspace_id is not provided, defaults to the first workspace.
    """
    if not workspace_id:
        workspace_id = await get_default_workspace_id(db)

    result = await db.execute(
        select(BookingType)
        .where(
            BookingType.workspace_id == workspace_id,
            BookingType.is_active == True
        )
    )
    return [BookingTypeOut.model_validate(bt) for bt in result.scalars().all()]


@router.get("/booking-types/{type_id}", response_model=BookingTypeOut)
async def get_public_booking_type(
    type_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch details of a specific booking type.
    """
    result = await db.execute(select(BookingType).where(BookingType.id == type_id))
    bt = result.scalar_one_or_none()
    if not bt or not bt.is_active:
        raise HTTPException(status_code=404, detail="Booking type not found")
    return BookingTypeOut.model_validate(bt)


@router.post("/bookings", response_model=BookingOut)
async def create_public_booking(
    data: dict,  # Raw data to handle nested contact info
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a booking publicly.
    Expects:
    {
        "booking_type_id": "...",
        "start_time": "ISO_STRING",
        "name": "...",
        "email": "...",
        "phone": "...",
        "notes": "..."
    }
    """
    booking_type_id = data.get("booking_type_id")
    start_time_str = data.get("start_time")

    # Validation
    if not booking_type_id or not start_time_str:
        raise HTTPException(status_code=400, detail="Missing required booking fields")

    # Fetch Booking Type to get workspace and duration
    result = await db.execute(select(BookingType).where(BookingType.id == booking_type_id))
    bt = result.scalar_one_or_none()
    if not bt or not bt.is_active:
        raise HTTPException(status_code=404, detail="Booking type not found")

    # Calculate End Time
    start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
    # Make naive for DB storage if needed
    if start_time.tzinfo is not None:
        start_time = start_time.replace(tzinfo=None)
    end_time = start_time + timedelta(minutes=bt.duration_minutes)

    # Validate Business Hours
    day_of_week = start_time.weekday() # 0=Monday
    availability_result = await db.execute(
        select(BusinessAvailability)
        .where(
            BusinessAvailability.workspace_id == bt.workspace_id,
            BusinessAvailability.day_of_week == day_of_week,
            BusinessAvailability.is_active == True
        )
    )
    avail_slot = availability_result.scalar_one_or_none()
    
    if not avail_slot:
        raise HTTPException(status_code=400, detail="Business is closed on this day")

    # Parse HH:MM
    slot_start = datetime.strptime(avail_slot.start_time, "%H:%M").time()
    slot_end = datetime.strptime(avail_slot.end_time, "%H:%M").time()
    
    booking_start_time = start_time.time()
    booking_end_time = end_time.time()
    
    if booking_start_time < slot_start or booking_end_time > slot_end:
         raise HTTPException(status_code=400, detail="Booking time is outside business hours")

    # Handle Contact (Find or Create)
    email = data.get("email")
    phone = data.get("phone")
    name = data.get("name") or "Anonymous"

    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email or Phone required")

    contact = None
    if email or phone:
        query = select(Contact).where(Contact.workspace_id == bt.workspace_id)
        if email:
            contact_result = await db.execute(query.where(Contact.email == email))
            contact = contact_result.scalar_one_or_none()
        if not contact and phone:
            contact_result = await db.execute(query.where(Contact.phone == phone))
            contact = contact_result.scalar_one_or_none()

    if not contact:
        contact = Contact(
            workspace_id=bt.workspace_id,
            name=name,
            email=email,
            phone=phone,
            source="public_booking"
        )
        db.add(contact)
        await db.flush()

    # Create Booking
    booking = Booking(
        workspace_id=bt.workspace_id,
        booking_type_id=bt.id,
        contact_id=contact.id,
        status=BookingStatus.SCHEDULED,
        start_time=start_time,
        end_time=end_time,
        notes=data.get("notes", "")
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)

    # Trigger Automation in Background Task
    background_tasks.add_task(run_booking_automation, booking.id)

    # Return full booking object
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.booking_type), selectinload(Booking.contact))
        .where(Booking.id == booking.id)
    )
    booking = result.scalar_one()
    return BookingOut.model_validate(booking)

# Background Wrapper
async def run_booking_automation(booking_id: str):
    from app.services.automation import AutomationService
    import logging
    try:
        async with async_session() as auto_db:
            await AutomationService.handle_booking_created(booking_id, auto_db)
    except Exception as e:
        logging.getLogger("automation").error(f"Automation failed for booking {booking_id}: {e}")


@router.get("/slots")
async def get_public_slots(
    date: str,  # YYYY-MM-DD
    booking_type_id: str,
    workspace_id: str | None = None,
    timezone: str = "UTC",  # Not used yet, assume workspace TZ
    db: AsyncSession = Depends(get_db),
):
    """
    Get available time slots for a specific date and booking type.
    """
    from datetime import datetime, timedelta, time

    if not workspace_id:
        workspace_id = await get_default_workspace_id(db)

    # 1. Get Booking Type Duration
    bt_result = await db.execute(select(BookingType).where(BookingType.id == booking_type_id))
    bt = bt_result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=404, detail="Booking type not found")

    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    # Weekday: 0=Monday
    day_of_week = target_date.weekday()

    # 2. Get Business Hours for that day
    avail_result = await db.execute(
        select(BusinessAvailability)
        .where(
            BusinessAvailability.workspace_id == workspace_id,
            BusinessAvailability.day_of_week == day_of_week,
            BusinessAvailability.is_active == True
        )
    )
    avail = avail_result.scalar_one_or_none()
    if not avail:
        return []  # Closed

    # Parse bounds
    start_time = datetime.strptime(avail.start_time, "%H:%M").time()
    end_time = datetime.strptime(avail.end_time, "%H:%M").time()
    
    # 3. Get existing bookings for that day
    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)
    
    bookings_result = await db.execute(
        select(Booking)
        .where(
            Booking.workspace_id == workspace_id,
            Booking.start_time >= day_start,
            Booking.start_time <= day_end,
            Booking.status.in_([BookingStatus.SCHEDULED, BookingStatus.CONFIRMED])
        )
    )
    existing_bookings = bookings_result.scalars().all()

    # 4. Generate candidate slots
    slots = []
    current_time = datetime.combine(target_date, start_time)
    closes_at = datetime.combine(target_date, end_time)
    duration = timedelta(minutes=bt.duration_minutes)

    while current_time + duration <= closes_at:
        slot_start = current_time
        slot_end = current_time + duration
        
        # Check collision
        collision = False
        for b in existing_bookings:
            # Overlap logic: (StartA < EndB) and (EndA > StartB)
            if slot_start < b.end_time and slot_end > b.start_time:
                collision = True
                break
        
        if not collision:
            slots.append(slot_start.strftime("%H:%M"))
        
        current_time += timedelta(minutes=30) 

    return slots
