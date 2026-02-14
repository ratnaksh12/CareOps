import asyncio
import imaplib
import email
from email.header import decode_header
import logging
import time
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session
from app.config import get_settings
from app.models import Contact, Conversation, Message, SenderType, MessageChannel

# Configure logging
logger = logging.getLogger("email_poller")
logging.basicConfig(level=logging.INFO)

settings = get_settings()

class EmailPoller:
    def __init__(self):
        self.running = False
        self.imap_server = "imap.gmail.com"
        self.email_user = settings.SMTP_USER
        self.email_pass = settings.SMTP_PASSWORD

    async def start(self):
        """Start the polling loop."""
        self.running = True
        logger.info("📧 Email Poller Started...")
        while self.running:
            try:
                await self.check_email()
            except Exception as e:
                logger.error(f"Error in email polling: {e}")
            
            # Poll every 30 seconds
            await asyncio.sleep(30)

    async def check_email(self):
        """Connect to IMAP and check for unseen emails."""
        if not self.email_user or not self.email_pass:
            logger.warning("Missing Email Credentials. Skipping poll.")
            return

        try:
            # Run blocking IMAP calls in a separate thread
            await asyncio.to_thread(self._fetch_and_process_emails)
        except Exception as e:
            logger.error(f"Failed to check emails: {e}")

    def _fetch_and_process_emails(self):
        """Blocking IMAP logic to be run in a thread."""
        try:
            # Connect to IMAP
            mail = imaplib.IMAP4_SSL(self.imap_server)
            mail.login(self.email_user, self.email_pass)
            mail.select("inbox")

            # Search for unread emails
            status, messages = mail.search(None, "(UNSEEN)")
            if status != "OK":
                return

            email_ids = messages[0].split()
            if not email_ids:
                return

            logger.info(f"Found {len(email_ids)} new emails.")

            for e_id in email_ids:
                try:
                    # Fetch header and body
                    _, msg_data = mail.fetch(e_id, "(RFC822)")
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            
                            # Parse Subject
                            subject, encoding = decode_header(msg["Subject"])[0]
                            if isinstance(subject, bytes):
                                subject = subject.decode(encoding if encoding else "utf-8")
                            
                            # Parse Sender
                            from_hdr = msg.get("From")
                            sender_email = email.utils.parseaddr(from_hdr)[1]
                            
                            # Parse Body
                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    content_type = part.get_content_type()
                                    content_disposition = str(part.get("Content-Disposition"))
                                    if "attachment" not in content_disposition:
                                        if content_type == "text/plain":
                                            body = part.get_payload(decode=True).decode()
                                            break # Prefer plain text
                                        elif content_type == "text/html" and not body:
                                            body = part.get_payload(decode=True).decode()
                            else:
                                body = msg.get_payload(decode=True).decode()

                            # Run async DB insertion from this thread safely? 
                            # No, we must run DB ops in the async loop.
                            # We can use a synchronous DB session here OR pass data back.
                            # Better approach: Gather data here, process DB in async wrapper.
                            # BUT `to_thread` runs a function. 
                            # Let's actually do the DB part inside `start` by breaking this function down 
                            # OR just use a new event loop for DB in thread (messy).
                            # EASIEST: Just return a list of parsed emails from this function.
                            pass
                except Exception as e:
                    logger.error(f"Error processing email {e_id}: {e}")
            
            # We will refactor this to return data, because mixing sync/async DB updates is tricky.
            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"IMAP Connection Error: {e}")

    # REVISED ASYNC APPROACH
    
    async def process_incoming_email(self, sender_email: str, subject: str, body: str):
        """Find contact and create message."""
        # Clean the body (basic)
        # Remove quoted replies which start with "On ... wrote:"
        clean_body = body.split("\r\nOn ")[0].split("\nOn ")[0]
        # Also remove weird artifacts
        clean_body = clean_body.strip()
        
        async with async_session() as db:
            # Find contact by email
            result = await db.execute(select(Contact).where(Contact.email == sender_email))
            contact = result.scalar_one_or_none()
            
            if not contact:
                logger.warning(f"Ignored email from unknown sender: {sender_email}")
                return

            # Find active conversation or create new?
            # Ideally find the most recent open conversation
            # For hackathon: just find ANY conversion or create one.
            result = await db.execute(
                select(Conversation)
                .where(Conversation.contact_id == contact.id)
                .order_by(Conversation.last_message_at.desc())
            )
            conversation = result.scalars().first()
            
            if not conversation:
                # Create conversation
                conversation = Conversation(
                    workspace_id=contact.workspace_id,
                    contact_id=contact.id,
                    status="open",
                    unread_count=0
                )
                db.add(conversation)
                await db.flush()
            
            # Create Message
            new_msg = Message(
                conversation_id=conversation.id,
                sender_type=SenderType.CONTACT,  # It's from the contact
                sender_id=contact.id,
                channel=MessageChannel.EMAIL,
                content=clean_body # or subject + body?
            )
            db.add(new_msg)
            
            # Update Conversation
            conversation.last_message_at = new_msg.created_at
            conversation.unread_count += 1
            conversation.status = "open" # Re-open if closed
            
            # Trigger Automation (keyword scanning, etc.)
            from app.services.automation import AutomationService
            await AutomationService.handle_message_created(new_msg.id, db)
            
            await db.commit()
            logger.info(f"📥 Imported Email from {contact.name}: {clean_body[:30]}...")

    async def run_cycle(self):
        """Single poll cycle."""
        if not self.email_user or not self.email_pass:
            return

        # 1. Fetch raw emails (blocking IO in thread)
        raw_emails = await asyncio.to_thread(self._fetch_raw_emails_sync)
        
        # 2. Process them (Async DB)
        for email_data in raw_emails:
            await self.process_incoming_email(
                email_data['sender'],
                email_data['subject'],
                email_data['body']
            )

    def _fetch_raw_emails_sync(self):
        """Connect to IMAP, fetch UNSEEN, return list of dicts."""
        emails_found = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_server)
            mail.login(self.email_user, self.email_pass)
            mail.select("inbox")

            status, messages = mail.search(None, "(UNSEEN)")
            if status != "OK":
                return []

            email_ids = messages[0].split()
            for e_id in email_ids:
                try:
                    _, msg_data = mail.fetch(e_id, "(RFC822)")
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            
                            # Decode Subject
                            subject, encoding = decode_header(msg["Subject"])[0]
                            if isinstance(subject, bytes):
                                subject = subject.decode(encoding if encoding else "utf-8")
                            
                            # Parse Sender
                            from_hdr = msg.get("From")
                            sender_email = email.utils.parseaddr(from_hdr)[1]
                            
                            # Parse Body
                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    if part.get_content_type() == "text/plain":
                                        try:
                                            body = part.get_payload(decode=True).decode()
                                            break
                                        except: pass
                            else:
                                try:
                                    body = msg.get_payload(decode=True).decode()
                                except: pass
                            
                            if body:
                                emails_found.append({
                                    "sender": sender_email,
                                    "subject": subject,
                                    "body": body
                                })
                except Exception as e:
                    logger.error(f"Error parsing email {e_id}: {e}")
            
            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"IMAP Error: {e}")
        
        return emails_found

# Singleton instance
email_poller = EmailPoller()
