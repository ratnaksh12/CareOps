from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from passlib.context import CryptContext

from app.database import get_db
from app.models import User, StaffRole, new_uuid
from app.api.v1.auth import get_current_user
from app.services.automation import EmailProvider

router = APIRouter(prefix="/staff", tags=["staff"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Schemas ──────────────────────────────────────────────────────
class StaffPermissions(BaseModel):
    can_inbox: bool = True
    can_bookings: bool = True
    can_forms: bool = True
    can_inventory: bool = False


class StaffInvite(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    permissions: StaffPermissions = StaffPermissions()


class StaffOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    can_inbox: bool = True
    can_bookings: bool = True
    can_forms: bool = True
    can_inventory: bool = False

    model_config = {"from_attributes": True}


class PermissionUpdate(BaseModel):
    can_inbox: Optional[bool] = None
    can_bookings: Optional[bool] = None
    can_forms: Optional[bool] = None
    can_inventory: Optional[bool] = None


# ── Endpoints ────────────────────────────────────────────────────
@router.get("", response_model=List[StaffOut])
async def list_staff(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all staff in the current workspace (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can view staff")

    result = await db.execute(
        select(User).where(User.workspace_id == current_user.workspace_id)
    )
    users = result.scalars().all()

    staff_list = []
    for u in users:
        # Fetch permissions
        role_result = await db.execute(
            select(StaffRole).where(
                StaffRole.user_id == u.id,
                StaffRole.workspace_id == current_user.workspace_id,
            )
        )
        role = role_result.scalar_one_or_none()

        staff_list.append(
            StaffOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                can_inbox=role.can_inbox if role else True,
                can_bookings=role.can_bookings if role else True,
                can_forms=role.can_forms if role else True,
                can_inventory=role.can_inventory if role else False,
            )
        )

    return staff_list


@router.post("/invite", response_model=StaffOut)
async def invite_staff(
    data: StaffInvite,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a new staff member to the workspace (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can invite staff")

    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    # Create user
    new_user = User(
        id=new_uuid(),
        email=data.email,
        full_name=data.full_name,
        hashed_password=pwd_context.hash(data.password),
        role="staff",
        workspace_id=current_user.workspace_id,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Create permissions
    staff_role = StaffRole(
        id=new_uuid(),
        user_id=new_user.id,
        workspace_id=current_user.workspace_id,
        can_inbox=data.permissions.can_inbox,
        can_bookings=data.permissions.can_bookings,
        can_forms=data.permissions.can_forms,
        can_inventory=data.permissions.can_inventory,
    )
    db.add(staff_role)

    # Send Invitation Email - BACKGROUND TASK
    background_tasks.add_task(
        send_invite_email, 
        email=new_user.email, 
        name=new_user.full_name, 
        password=data.password
    )

    return StaffOut(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        can_inbox=staff_role.can_inbox,
        can_bookings=staff_role.can_bookings,
        can_forms=staff_role.can_forms,
        can_inventory=staff_role.can_inventory,
    )

def send_invite_email(email: str, name: str, password: str):
    EmailProvider.send_email(
        to_email=email,
        subject="You've been invited to CareOps",
        body=f"Hi {name},\n\nYou have been invited to join the CareOps workspace.\n\nYour temporary password is: {password}\n\nPlease log in and change your password.\n\nBest,\nThe CareOps Team"
    )


@router.patch("/{staff_id}/permissions", response_model=StaffOut)
async def update_permissions(
    staff_id: str,
    data: PermissionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update staff permissions (Admin only)."""
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can update permissions")

    # Find user
    user_result = await db.execute(select(User).where(User.id == staff_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Staff not found")

    # Find or create role
    role_result = await db.execute(
        select(StaffRole).where(
            StaffRole.user_id == staff_id,
            StaffRole.workspace_id == current_user.workspace_id,
        )
    )
    role = role_result.scalar_one_or_none()

    if not role:
        role = StaffRole(
            id=new_uuid(),
            user_id=staff_id,
            workspace_id=current_user.workspace_id,
        )
        db.add(role)

    # Update only provided fields
    if data.can_inbox is not None:
        role.can_inbox = data.can_inbox
    if data.can_bookings is not None:
        role.can_bookings = data.can_bookings
    if data.can_forms is not None:
        role.can_forms = data.can_forms
    if data.can_inventory is not None:
        role.can_inventory = data.can_inventory

    return StaffOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        can_inbox=role.can_inbox,
        can_bookings=role.can_bookings,
        can_forms=role.can_forms,
        can_inventory=role.can_inventory,
    )
