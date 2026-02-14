from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.models import BusinessAvailability, User, new_uuid
from app.security import get_current_user

router = APIRouter(prefix="/availability", tags=["Availability"])


class AvailabilitySlot(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str   # "09:00"
    end_time: str      # "17:00"
    is_active: bool = True


class AvailabilityOut(BaseModel):
    id: str
    workspace_id: str
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool

    model_config = {"from_attributes": True}


class BulkAvailabilitySet(BaseModel):
    slots: List[AvailabilitySlot]


DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.get("", response_model=List[AvailabilityOut])
async def get_availability(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all availability slots for the current workspace."""
    if not user.workspace_id:
        raise HTTPException(400, "No workspace")
    result = await db.execute(
        select(BusinessAvailability)
        .where(BusinessAvailability.workspace_id == user.workspace_id)
        .order_by(BusinessAvailability.day_of_week)
    )
    return [AvailabilityOut.model_validate(a) for a in result.scalars().all()]


@router.post("", response_model=List[AvailabilityOut])
async def set_availability(
    data: BulkAvailabilitySet,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set availability for the workspace (replaces all existing slots)."""
    if not user.workspace_id:
        raise HTTPException(400, "No workspace")
    if user.role != "admin":
        raise HTTPException(403, "Only admins can set availability")

    # Delete existing
    await db.execute(
        delete(BusinessAvailability)
        .where(BusinessAvailability.workspace_id == user.workspace_id)
    )

    # Create new slots
    new_slots = []
    for slot in data.slots:
        avail = BusinessAvailability(
            id=new_uuid(),
            workspace_id=user.workspace_id,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            is_active=slot.is_active,
        )
        db.add(avail)
        new_slots.append(avail)

    await db.flush()
    return [AvailabilityOut.model_validate(a) for a in new_slots]


# ── Public Endpoint ──
@router.get("/public/{workspace_id}", response_model=List[AvailabilityOut])
async def get_public_availability(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: Get business availability for booking page."""
    result = await db.execute(
        select(
            BusinessAvailability.id,
            BusinessAvailability.workspace_id,
            BusinessAvailability.day_of_week,
            BusinessAvailability.start_time,
            BusinessAvailability.end_time,
            BusinessAvailability.is_active
        )
        .where(
            BusinessAvailability.workspace_id == workspace_id,
            BusinessAvailability.is_active == True,
        )
        .order_by(BusinessAvailability.day_of_week)
    )
    # Manual construction to avoid DetachedInstanceError
    return [
        AvailabilityOut(
            id=row[0] if isinstance(row, tuple) else row.id,
            workspace_id=row[1] if isinstance(row, tuple) else row.workspace_id,
            day_of_week=row[2] if isinstance(row, tuple) else row.day_of_week,
            start_time=row[3] if isinstance(row, tuple) else row.start_time,
            end_time=row[4] if isinstance(row, tuple) else row.end_time,
            is_active=row[5] if isinstance(row, tuple) else row.is_active,
        ) for row in result.all()
    ]
