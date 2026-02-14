from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Contact, Conversation, Message, User, SenderType, ConversationStatus
from app.schemas import (
    ContactCreate, ContactUpdate, ContactOut,
    ConversationOut, MessageCreate, MessageOut,
)
from app.security import get_current_user
from typing import Optional

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=list[ContactOut])
async def list_contacts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    result = await db.execute(
        select(Contact).where(Contact.workspace_id == user.workspace_id).order_by(Contact.created_at.desc())
    )
    return [ContactOut.model_validate(c) for c in result.scalars().all()]


@router.post("", response_model=ContactOut)
async def create_contact(
    data: ContactCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    contact = Contact(workspace_id=user.workspace_id, **data.model_dump())
    db.add(contact)
    await db.flush()

    # Auto-create a conversation
    conversation = Conversation(
        workspace_id=user.workspace_id,
        contact_id=contact.id,
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(contact)
    return ContactOut.model_validate(contact)


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.workspace_id == user.workspace_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactOut.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: str,
    data: ContactUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.workspace_id == user.workspace_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(contact, key, val)
    await db.flush()
    await db.refresh(contact)
    return ContactOut.model_validate(contact)


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.workspace_id == user.workspace_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    return {"ok": True}
