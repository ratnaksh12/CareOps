from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models import Workspace, User, BookingType, InventoryItem, Integration
from app.schemas import WorkspaceCreate, WorkspaceUpdate, WorkspaceOut
from app.security import get_current_user

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


@router.post("", response_model=WorkspaceOut)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        workspace = Workspace(
            name=data.name,
            address=data.address,
            timezone=data.timezone,
            contact_email=data.contact_email,
            owner_id=current_user.id, # Use current_user.id directly
            onboarding_step=2,
        )
        db.add(workspace)
        await db.flush()
        
        # Capture values immediately while attached
        ws_id = workspace.id
        ws_created_at = workspace.created_at

        # Assign workspace to user using update statement to avoid DetachedInstanceError
        from sqlalchemy import update
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(workspace_id=ws_id)
        )
        await db.flush()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e

    return WorkspaceOut(
        id=ws_id,
        name=data.name,
        address=data.address,
        timezone=data.timezone,
        contact_email=data.contact_email,
        is_active=False, 
        onboarding_step=2,
        created_at=ws_created_at,
    )


@router.get("/current", response_model=WorkspaceOut)
async def get_current_workspace(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=404, detail="No workspace found")

    result = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return WorkspaceOut.model_validate(workspace)


@router.patch("/current", response_model=WorkspaceOut)
async def update_workspace(
    data: WorkspaceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=404, detail="No workspace found")

    result = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(workspace, key, val)
    await db.flush()
    await db.refresh(workspace)
    return WorkspaceOut.model_validate(workspace)


# ── Onboarding ───────────────────────────────────────────────────

class OnboardingStatus(BaseModel):
    current_step: int
    steps_completed: dict[str, bool]


@router.get("/onboarding-status", response_model=OnboardingStatus)
async def get_onboarding_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current onboarding step and which steps have been completed."""
    if not user.workspace_id:
        return OnboardingStatus(
            current_step=1,
            steps_completed={f"step_{i}": False for i in range(1, 9)},
        )

    result = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        return OnboardingStatus(
            current_step=1,
            steps_completed={f"step_{i}": False for i in range(1, 9)},
        )

    # Check real data for each step
    has_booking_type = (await db.execute(
        select(func.count()).select_from(BookingType)
        .where(BookingType.workspace_id == user.workspace_id)
    )).scalar() > 0

    has_inventory = (await db.execute(
        select(func.count()).select_from(InventoryItem)
        .where(InventoryItem.workspace_id == user.workspace_id)
    )).scalar() > 0

    steps_completed = {
        "step_1": workspace.onboarding_step >= 2,   # Workspace created
        "step_2": workspace.onboarding_step >= 3,   # Communication configured
        "step_3": workspace.onboarding_step >= 4,   # Contact form (auto)
        "step_4": workspace.onboarding_step >= 5 or has_booking_type,  # Bookings
        "step_5": workspace.onboarding_step >= 6,   # Forms (info)
        "step_6": workspace.onboarding_step >= 7 or has_inventory,  # Inventory
        "step_7": workspace.onboarding_step >= 8,   # Staff (info)
        "step_8": workspace.is_active,               # Activated
    }

    return OnboardingStatus(
        current_step=workspace.onboarding_step,
        steps_completed=steps_completed,
    )


class OnboardingStepUpdate(BaseModel):
    step: int


@router.patch("/onboarding-step", response_model=WorkspaceOut)
async def update_onboarding_step(
    data: OnboardingStepUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save onboarding progress. Only allows moving forward."""
    if not user.workspace_id:
        raise HTTPException(status_code=404, detail="No workspace found")

    result = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Only allow moving forward (never backward)
    if data.step > workspace.onboarding_step:
        workspace.onboarding_step = data.step

    await db.flush()
    await db.refresh(workspace)
    return WorkspaceOut.model_validate(workspace)


@router.post("/activate", response_model=WorkspaceOut)
async def activate_workspace(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=404, detail="No workspace found")

    result = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace.is_active = True
    workspace.onboarding_step = 8
    await db.flush()
    await db.refresh(workspace)
    return WorkspaceOut.model_validate(workspace)
