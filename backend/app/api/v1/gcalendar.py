"""
Google Calendar OAuth API endpoints.
Handles the OAuth flow for connecting Google Calendar to a workspace.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models import User, Workspace
from app.security import get_current_user
from app.services.google_calendar import GoogleCalendarService
from app.config import get_settings

router = APIRouter(prefix="/gcalendar", tags=["Google Calendar"])

settings = get_settings()


class CalendarAuthURL(BaseModel):
    auth_url: Optional[str] = None
    is_connected: bool = False


class CalendarCallback(BaseModel):
    code: str


class CalendarStatus(BaseModel):
    is_connected: bool
    message: str


@router.get("/auth-url", response_model=CalendarAuthURL)
async def get_google_auth_url(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the Google OAuth2 authorization URL for Calendar connection."""
    if user.role != "admin":
        raise HTTPException(403, "Only admins can connect Google Calendar")

    # Check if already connected
    result = await db.execute(
        select(Workspace).where(Workspace.id == user.workspace_id)
    )
    ws = result.scalar_one_or_none()
    if ws and ws.google_calendar_token:
        return CalendarAuthURL(is_connected=True)

    redirect_uri = f"{settings.FRONTEND_URL}/settings/google-callback"
    auth_url = GoogleCalendarService.get_auth_url(redirect_uri)
    
    return CalendarAuthURL(auth_url=auth_url, is_connected=False)


@router.post("/callback", response_model=CalendarStatus)
async def handle_google_callback(
    data: CalendarCallback,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exchange authorization code for tokens and save to workspace."""
    if user.role != "admin":
        raise HTTPException(403, "Only admins can connect Google Calendar")

    redirect_uri = f"{settings.FRONTEND_URL}/settings/google-callback"
    token_json = GoogleCalendarService.exchange_code(data.code, redirect_uri)

    if not token_json:
        raise HTTPException(400, "Failed to exchange code for tokens")

    # Save token to workspace
    result = await db.execute(
        select(Workspace).where(Workspace.id == user.workspace_id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, "Workspace not found")

    ws.google_calendar_token = token_json
    await db.commit()

    return CalendarStatus(is_connected=True, message="Google Calendar connected successfully!")


@router.delete("/disconnect", response_model=CalendarStatus)
async def disconnect_google_calendar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Google Calendar from the workspace."""
    if user.role != "admin":
        raise HTTPException(403, "Only admins can disconnect Google Calendar")

    result = await db.execute(
        select(Workspace).where(Workspace.id == user.workspace_id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(404, "Workspace not found")

    ws.google_calendar_token = None
    await db.commit()

    return CalendarStatus(is_connected=False, message="Google Calendar disconnected.")
