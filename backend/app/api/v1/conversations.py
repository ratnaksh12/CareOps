from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.database import get_db
from app.models import Conversation, Message, Contact, User, SenderType, ConversationStatus
from app.schemas import ConversationOut, MessageCreate, MessageOut
from app.security import get_current_user

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.workspace_id:
        raise HTTPException(status_code=400, detail="No workspace")
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.contact))
        .where(Conversation.workspace_id == user.workspace_id)
        .order_by(Conversation.last_message_at.desc().nullslast())
    )
    return [ConversationOut.model_validate(c) for c in result.scalars().all()]


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.contact))
        .where(Conversation.id == conversation_id, Conversation.workspace_id == user.workspace_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationOut.model_validate(conv)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return [MessageOut.model_validate(m) for m in result.scalars().all()]


@router.post("/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify conversation exists
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == user.workspace_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    message = Message(
        conversation_id=conv.id,
        sender_type=SenderType.STAFF,
        sender_id=user.id,
        channel=data.channel,
        content=data.content,
    )
    db.add(message)

    # Update conversation
    conv.last_message_at = datetime.utcnow()
    conv.automation_paused = True  # Staff reply pauses automation
    conv.unread_count = 0  # Reset unread count on staff reply
    if conv.status == ConversationStatus.CLOSED:
        conv.status = ConversationStatus.OPEN

    await db.flush()
    await db.refresh(message)
    
    # Trigger automation for staff reply (send email)
    from app.services.automation import AutomationService
    # Trigger automation for staff reply (send email)
    from app.services.automation import AutomationService
    # from app.database import async_session
    try:
        # Use the same session (db) since the transaction is still open and we need to see the uncommitted message
        await AutomationService.handle_message_created(message.id, db)
    except Exception as e:
        import logging
        logging.getLogger("conversations").error(f"Automation failed for message {message.id}: {e}")

    return MessageOut.model_validate(message)


@router.patch("/{conversation_id}/status")
async def update_conversation_status(
    conversation_id: str,
    status: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == user.workspace_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.status = ConversationStatus(status)
    await db.flush()
    return {"ok": True, "status": status}
