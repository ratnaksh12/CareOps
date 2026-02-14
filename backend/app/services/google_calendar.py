"""
Google Calendar Integration Service.

Provides OAuth2 flow and event creation/sync for Google Calendar.
Uses google-api-python-client + google-auth-oauthlib.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("google_calendar")


class GoogleCalendarService:
    """Handles Google Calendar OAuth and event management."""

    SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

    @staticmethod
    def get_auth_url(redirect_uri: str) -> Optional[str]:
        """Generate Google OAuth2 authorization URL."""
        try:
            from app.config import get_settings
            settings = get_settings()

            if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
                logger.info("[SIMULATED] Google Calendar auth URL requested — no credentials configured")
                return None

            from google_auth_oauthlib.flow import Flow

            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=GoogleCalendarService.SCOPES,
            )
            flow.redirect_uri = redirect_uri
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent",
            )
            return auth_url
        except Exception as e:
            logger.error(f"Failed to generate Google auth URL: {e}")
            return None

    @staticmethod
    def exchange_code(code: str, redirect_uri: str) -> Optional[str]:
        """Exchange authorization code for tokens. Returns JSON token string."""
        try:
            from app.config import get_settings
            settings = get_settings()

            if not settings.GOOGLE_CLIENT_ID:
                return None

            from google_auth_oauthlib.flow import Flow
            import json

            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                scopes=GoogleCalendarService.SCOPES,
            )
            flow.redirect_uri = redirect_uri
            flow.fetch_token(code=code)
            creds = flow.credentials
            token_data = {
                "token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "scopes": list(creds.scopes or []),
            }
            return json.dumps(token_data)
        except Exception as e:
            logger.error(f"Failed to exchange Google code: {e}")
            return None

    @staticmethod
    def create_event(
        token_json: str,
        summary: str,
        description: str,
        location: str,
        start_time: datetime,
        end_time: datetime,
        attendee_email: str = "",
    ) -> Optional[str]:
        """Create a Google Calendar event. Returns event ID or None."""
        try:
            import json
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            token_data = json.loads(token_json)
            creds = Credentials(
                token=token_data["token"],
                refresh_token=token_data.get("refresh_token"),
                token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=token_data.get("client_id"),
                client_secret=token_data.get("client_secret"),
            )

            service = build("calendar", "v3", credentials=creds)

            event_body = {
                "summary": summary,
                "description": description,
                "location": location,
                "start": {
                    "dateTime": start_time.isoformat(),
                    "timeZone": "UTC",
                },
                "end": {
                    "dateTime": end_time.isoformat(),
                    "timeZone": "UTC",
                },
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "email", "minutes": 60},
                        {"method": "popup", "minutes": 30},
                    ],
                },
            }

            if attendee_email:
                event_body["attendees"] = [{"email": attendee_email}]

            event = service.events().insert(
                calendarId="primary",
                body=event_body,
                sendUpdates="all",
            ).execute()

            event_id = event.get("id")
            logger.info(f"Google Calendar event created: {event_id}")
            return event_id

        except Exception as e:
            logger.error(f"Failed to create Google Calendar event: {e}")
            # Fallback: log the event
            logger.info(
                f"[SIMULATED] Calendar Event: {summary} | "
                f"{start_time} - {end_time} | "
                f"Location: {location} | Attendee: {attendee_email}"
            )
            return None

    @staticmethod
    def simulate_event(
        summary: str,
        start_time: datetime,
        end_time: datetime,
        location: str = "",
        attendee_email: str = "",
    ):
        """Log a simulated calendar event when Google Calendar is not configured."""
        logger.info(
            f"[SIMULATED] 📅 Calendar Event Created:\n"
            f"   Title: {summary}\n"
            f"   When: {start_time.strftime('%b %d, %Y %I:%M %p')} - {end_time.strftime('%I:%M %p')}\n"
            f"   Where: {location or 'Not specified'}\n"
            f"   Attendee: {attendee_email or 'None'}"
        )
