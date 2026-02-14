from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Booking, BookingType, Contact, User, BookingStatus
from app.schemas import (
    BookingCreate, BookingUpdate, BookingOut,
    BookingTypeCreate, BookingTypeUpdate, BookingTypeOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# ============ Booking Types ============

@router.get("/types", response_model=list[BookingTypeOut])
async def list_booking_types(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    result = await db.execute(
        select(BookingType).where(BookingType.workspace_id == user.workspace_id)
    )
    return [BookingTypeOut.model_validate(bt) for bt in result.scalars().all()]


@router.post("/types", response_model=BookingTypeOut)
async def create_booking_type(
    data: BookingTypeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    from app.models import new_uuid
    import logging
    try:
        bt = BookingType(id=new_uuid(), workspace_id=user.workspace_id, **data.model_dump())
        db.add(bt)
        await db.flush()
        await db.refresh(bt)
        return BookingTypeOut.model_validate(bt)
    except Exception as e:
        logging.getLogger("bookings").error(f"Error creating booking type: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.patch("/types/{type_id}", response_model=BookingTypeOut)
async def update_booking_type(
    type_id: str,
    data: BookingTypeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BookingType).where(BookingType.id == type_id, BookingType.workspace_id == user.workspace_id)
    )
    bt = result.scalar_one_or_none()
    if not bt:
        raise HTTPException(status_code=404, detail="Booking type not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(bt, key, val)
    await db.flush()
    await db.refresh(bt)
    return BookingTypeOut.model_validate(bt)


@router.post("/types/{type_id}/inventory")
async def link_inventory_to_booking_type(
    type_id: str,
    data: dict, # {"inventory_item_id": "...", "quantity_required": 1}
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Link an inventory item to a booking type.
    """
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    
    # Verify ownership
    result = await db.execute(
        select(BookingType).where(BookingType.id == type_id, BookingType.workspace_id == user.workspace_id)
    )
    bt = result.scalar_one_or_none()
    if not bt:
         raise HTTPException(status_code=404, detail="Booking type not found")

    from app.models import BookingTypeInventoryLink # localized import to avoid circular if any
    
    link = BookingTypeInventoryLink(
        booking_type_id=type_id,
        inventory_item_id=data["inventory_item_id"],
        quantity_required=data.get("quantity_required", 1)
    )
    db.add(link)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Link already exists or invalid item")
    
    return {"ok": True}


# ============ Bookings ============

@router.get("", response_model=list[BookingOut])
async def list_bookings(
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    query = (
        select(Booking)
        .options(selectinload(Booking.booking_type), selectinload(Booking.contact))
        .where(Booking.workspace_id == user.workspace_id)
    )
    if status:
        query = query.where(Booking.status == BookingStatus(status))
    query = query.order_by(Booking.start_time.desc())
    result = await db.execute(query)
    return [BookingOut.model_validate(b) for b in result.scalars().all()]


@router.post("", response_model=BookingOut)
async def create_booking(
    data: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    from app.models import new_uuid
    booking = Booking(id=new_uuid(), workspace_id=user.workspace_id, **data.model_dump())
    db.add(booking)
    await db.flush()

    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.booking_type), selectinload(Booking.contact))
        .where(Booking.id == booking.id)
    )
    booking = result.scalar_one()

    # Trigger Automation (Emails, Calendar, etc.)
    from app.services.automation import AutomationService
    try:
        await AutomationService.handle_booking_created(booking.id, db)
    except Exception as e:
        import logging
        logging.getLogger("bookings").error(f"Automation failed for booking {booking.id}: {e}")

    return BookingOut.model_validate(booking)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.booking_type), selectinload(Booking.contact))
        .where(Booking.id == booking_id, Booking.workspace_id == user.workspace_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return BookingOut.model_validate(booking)


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: str,
    data: BookingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.workspace_id == user.workspace_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = BookingStatus(update_data["status"])
    for key, val in update_data.items():
        setattr(booking, key, val)
    await db.flush()

    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.booking_type), selectinload(Booking.contact))
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one()
    return BookingOut.model_validate(booking)


@router.delete("/{booking_id}")
async def delete_booking(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.workspace_id == user.workspace_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.delete(booking)
    return {"ok": True}
