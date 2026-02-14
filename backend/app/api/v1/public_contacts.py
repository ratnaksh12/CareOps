from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, async_session
from app.models import Contact, Event, EventType, Workspace, Conversation, Message, ConversationStatus, SenderType
from app.schemas import ContactCreate, ContactOut
from app.services.automation import AutomationService
from datetime import datetime
import uuid
import logging

logger = logging.getLogger("public_contacts")

# Note: We use a simpler schema for public contact creation since they won't provide all fields
from pydantic import BaseModel, EmailStr, Field

class PublicContactCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    message: str | None = None
    workspace_id: str | None = None  # Optional if we want to support multi-tenant public forms later

router = APIRouter(prefix="/public", tags=["Public Contacts"])

async def ensure_conversation_and_message(
    db: AsyncSession, 
    workspace_id: str, 
    contact_id: str, 
    message_content: str
):
    """
    Helper to ensure an open conversation exists and add the message to it.
    """
    if not message_content:
        return

    # 1. Find open conversation
    result = await db.execute(
        select(Conversation).where(
            Conversation.contact_id == contact_id,
            Conversation.workspace_id == workspace_id,
            Conversation.status == ConversationStatus.OPEN
        )
    )
    conversation = result.scalars().first()

    # 2. Create if not exists
    if not conversation:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            contact_id=contact_id,
            status=ConversationStatus.OPEN,
            created_at=datetime.utcnow(),
            last_message_at=datetime.utcnow()
        )
        db.add(conversation)
        await db.flush() # get ID

    # 3. Add Message
    new_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        sender_type=SenderType.CONTACT,
        content=message_content,
        created_at=datetime.utcnow()
    )
    db.add(new_message)
    
    # 4. Update Conversation stats (unread count, last message)
    conversation.unread_count += 1
    conversation.last_message_at = datetime.utcnow()
    db.add(conversation)

@router.post("/contacts", response_model=ContactOut)
async def create_public_contact(
    contact_data: PublicContactCreate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint for contact/lead creation (No Auth Required).
    Triggers CONTACT_CREATED automation event.
    """
    
    # auto-assign to the first workspace if not provided (single-tenant assumption for now)
    ws_id = contact_data.workspace_id
    if not ws_id:
        # Try to find the most likely workspace (e.g., the one owned by the first admin)
        result = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()))
        workspace = result.scalars().first()
        if not workspace:
            raise HTTPException(status_code=404, detail="No active workspace found to accept leads.")
        ws_id = workspace.id
    
    # Check if contact already exists
    result = await db.execute(select(Contact).where(Contact.email == contact_data.email, Contact.workspace_id == ws_id))
    existing_contact = result.scalars().first()
    
    if existing_contact:
        # Update existing contact if needed, or just log the new inquiry
        if contact_data.message:
            # Create message in conversation
            await ensure_conversation_and_message(db, ws_id, existing_contact.id, contact_data.message)
            
            # Create event
            event = Event(
                id=str(uuid.uuid4()),
                workspace_id=ws_id,
                event_type=EventType.FORM_SUBMITTED,
                resource_id=existing_contact.id,
                data={"message": contact_data.message, "source": "public_lead_form"},
                created_at=datetime.utcnow()
            )
            db.add(event)
            await db.commit()
            
            # Run automation in background
            background_tasks.add_task(run_automation_event, event.id)
            
        return existing_contact

    # Create new contact
    new_contact = Contact(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        name=contact_data.name,
        email=contact_data.email,
        phone=contact_data.phone,
        address=contact_data.address,
        status="lead",
        source="website",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_contact)
    await db.flush() # flush to get ID
    
    # Track the message if provided
    if contact_data.message:
        # Create Conversation & Message
        await ensure_conversation_and_message(db, ws_id, new_contact.id, contact_data.message)

        # Log Event
        event = Event(
            id=str(uuid.uuid4()),
            workspace_id=ws_id,
            event_type=EventType.CONTACT_CREATED,
            resource_id=new_contact.id,
            data={"message": contact_data.message, "source": "public_lead_form"},
            created_at=datetime.utcnow()
        )
        db.add(event)
        
        await db.commit()
        
        # Run automation in background
        background_tasks.add_task(run_automation_contact, new_contact.id)
        
    else:
        await db.commit()

    return new_contact

# Wrapper functions for background tasks to handle their own sessions
async def run_automation_contact(contact_id: str):
    try:
        async with async_session() as auto_db:
            await AutomationService.handle_contact_created(contact_id, auto_db)
            # Trigger inventory scan for new contact message
            result = await auto_db.execute(select(Message).where(Message.sender_type == SenderType.CONTACT).order_by(Message.created_at.desc()).limit(1))
            msg = result.scalars().first()
            if msg:
                await AutomationService.handle_message_created(msg.id, auto_db)
    except Exception as e:
        logger.error(f"Background Automation failed for contact {contact_id}: {e}")

async def run_automation_event(event_id: str):
    try:
        async with async_session() as auto_db:
            await AutomationService.handle_event(event_id, auto_db)
            # Find associated message if needed (simplified for now)
    except Exception as e:
         logger.error(f"Background Automation failed for event {event_id}: {e}")
