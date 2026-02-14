from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("automation")


class EmailProvider:
    """Real email integration using Resend API with graceful fallback."""

    @staticmethod
    def send_email(to_email: str, subject: str, body: str) -> bool:
        from app.config import get_settings
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        settings = get_settings()

        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.info(f"[SIMULATED] EMAIL to {to_email} | Subject: {subject}")
            logger.info(f"   Body: {body}")
            return True

        try:
            msg = MIMEMultipart()
            msg['From'] = f"CareOps <{settings.SMTP_FROM}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

            logger.info(f"EMAIL SENT via Gmail to {to_email} | Subject: {subject}")
            return True
        except Exception as e:
            logger.error(f"EMAIL FAILED (Gmail) to {to_email}: {e}")
            logger.info(f"[FALLBACK] EMAIL to {to_email} | Subject: {subject}")
            return False


class SMSProvider:
    """Real SMS integration using Twilio with graceful fallback."""

    @staticmethod
    def send_sms(to_phone: str, message: str) -> bool:
        from app.config import get_settings
        settings = get_settings()

        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.info(f"[SIMULATED] SMS to {to_phone} | Message: {message}")
            return True

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            sms = client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=to_phone,
            )
            logger.info(f"SMS SENT to {to_phone} | SID: {sms.sid}")
            return True
        except Exception as e:
            logger.error(f"SMS FAILED to {to_phone}: {e}")
            logger.info(f"[FALLBACK] SMS to {to_phone} | Message: {message}")
            return False


class AutomationService:
    
    @staticmethod
    async def handle_contact_created(contact_id: str, db: AsyncSession):
        from app.models import Contact, Alert, AlertType, AlertSeverity
        
        logger.info(f"Processing CONTACT_CREATED for {contact_id}")
        
        result = await db.execute(select(Contact).where(Contact.id == contact_id))
        contact = result.scalar_one_or_none()
        
        if not contact:
            logger.error(f"Contact {contact_id} not found")
            return

        if contact.status == "replied":
            logger.info("Automation PAUSED: Staff has already replied.")
            return

        # Send Welcome Email
        if contact.email:
            EmailProvider.send_email(
                to_email=contact.email,
                subject="Welcome to CareOps!",
                body=f"Hi {contact.name},\n\nThanks for reaching out! We've received your message and a team member will get back to you shortly.\n\nBest,\nThe CareOps Team"
            )

        # Send Welcome SMS
        if contact.phone:
            SMSProvider.send_sms(
                to_phone=contact.phone,
                message=f"Hi {contact.name}! Thanks for reaching out to CareOps. We'll get back to you shortly."
            )

        # Create Internal Alert
        alert = Alert(
            workspace_id=contact.workspace_id,
            type=AlertType.INBOX,
            severity=AlertSeverity.INFO,
            title=f"New Lead: {contact.name}",
            message=f"New inquiry from {contact.name} ({contact.email})",
            link_to="/inbox"
        )
        db.add(alert)
        await db.commit()

    @staticmethod
    async def handle_message_created(message_id: str, db: AsyncSession):
        from app.models import Message, Conversation, Contact, SenderType
        from sqlalchemy.orm import selectinload
        
        logger.info(f"Processing MESSAGE_CREATED for {message_id}")
        
        result = await db.execute(
            select(Message)
            .options(selectinload(Message.conversation))
            .where(Message.id == message_id)
        )
        message = result.scalar_one_or_none()
        if not message:
            return

        result = await db.execute(select(Conversation).where(Conversation.id == message.conversation_id))
        conversation = result.scalar_one_or_none()
        if not conversation:
            return

        result = await db.execute(select(Contact).where(Contact.id == conversation.contact_id))
        contact = result.scalar_one_or_none()
        if not contact:
            return

        # 1. If Staff replied, send Email to Customer AND Check for Inventory in previous message
        if message.sender_type == SenderType.STAFF or message.sender_type == "staff":
            # --- EMAIL NOTIFICATION ---
            if contact.email:
                subject = "New message from CareOps"
                if conversation.workspace_id:
                    from app.models import Workspace
                    ws_res = await db.execute(select(Workspace).where(Workspace.id == conversation.workspace_id))
                    ws = ws_res.scalar_one_or_none()
                    if ws:
                        subject = f"New message from {ws.name}"
                
                logger.info(f"Attempting to send email to {contact.email} | Subject: {subject}")
                success = EmailProvider.send_email(
                    to_email=contact.email,
                    subject=subject,
                    body=f"Hi {contact.name},\n\nOur team has replied to your inquiry:\n\n\"{message.content}\"\n\nYou can reply to this email to continue the conversation.\n\nBest,\nThe Team"
                )
                if success:
                    logger.info(f"✅ Email sent successfully to {contact.email}")
                else:
                    logger.error(f"❌ Failed to send email to {contact.email}")

            # --- INVENTORY DEDUCTION (Scan previous message) ---
            # User request: "when replied to the user it will deducted"
            # Logic: Fetch the last message from the Contact
            prev_msg_result = await db.execute(
                select(Message)
                .where(
                    Message.conversation_id == conversation.id,
                    Message.created_at < message.created_at,
                    (Message.sender_type == SenderType.CONTACT) | (Message.sender_type == "contact")
                )
                .order_by(desc(Message.created_at))
                .limit(1)
            )
            prev_msg = prev_msg_result.scalar_one_or_none()
            
            if prev_msg:
                logger.info(f"Scanning PREVIOUS message ({prev_msg.id}) for inventory deduction...")
                await AutomationService.scan_message_for_inventory(prev_msg, db)
            else:
                logger.info("No previous contact message found to scan for inventory.")

        # 2. If Contact sent a message, scan for Inventory Keywords (Auto-deduct immediate? Maybe optional)
        elif message.sender_type == SenderType.CONTACT or message.sender_type == "contact":
             # We can keep this or disable it if the user strictly wants "on reply". 
             # The user said "and when replied to the user it will deducted".
             # This implies we should NOT deduct immediately, but wait for reply.
             # So I will COMMENT OUT the immediate scan here to strictly follow the "on reply" req.
             logger.info("Skipping immediate inventory scan (waiting for staff reply).")
             # await AutomationService.scan_message_for_inventory(message, db)

    @staticmethod
    async def scan_message_for_inventory(message, db: AsyncSession):
        from app.models import InventoryItem, Alert, AlertType, AlertSeverity
        import re

        # Simple keyword matching: find numbers followed by item names
        content = message.content.lower()
        
        # Get all inventory items for this workspace
        ws_id = message.conversation.workspace_id
        result = await db.execute(select(InventoryItem).where(InventoryItem.workspace_id == ws_id))
        items = result.scalars().all()
        
        logger.info(f"Scanning message for {len(items)} items in workspace {ws_id}")

        for item in items:
            keyword = item.name.lower()
            keywords = [keyword]
            if keyword.endswith('s'): keywords.append(keyword[:-1])
            elif not keyword.endswith('s'): keywords.append(keyword + 's')

            matched = False
            for kw in keywords:
                # Regex to find: [number] [optional words] [keyword]
                pattern = rf"(\d+)\s+.*?\b{re.escape(kw)}\b"
                match = re.search(pattern, content)
                if match:
                    qty = int(match.group(1))
                    logger.info(f"MATCH FOUND: '{kw}' with quantity {qty} in message content")
                    
                    # Deduct stock
                    old_qty = item.quantity
                    item.quantity = max(0, item.quantity - qty)
                    db.add(item)
                    
                    logger.info(f"AUTO-DEDUCT: Found '{kw}' in message. Deducting {qty} from {item.name}. New Qty: {item.quantity}")
                    
                    # Check for low-stock alert
                    if item.quantity <= item.threshold and old_qty > item.threshold:
                        alert = Alert(
                            workspace_id=item.workspace_id,
                            type=AlertType.INVENTORY,
                            severity=AlertSeverity.WARNING,
                            title=f"Low Stock: {item.name}",
                            message=f"Auto-deducted from inquiry. {item.name} is now low ({item.quantity} remaining).",
                            link_to="/inventory"
                        )
                        db.add(alert)
                    
                    matched = True
                    break
            
            if matched:
                await db.commit()

    @staticmethod
    async def handle_booking_created(booking_id: str, db: AsyncSession):
        from app.models import (
            Booking, BookingType, User, Contact, Workspace,
            InventoryItem, BookingTypeInventoryLink, 
            Alert, AlertType, AlertSeverity,
            Form, FormSubmission, FormSubmissionStatus,
        )
        from app.services.google_calendar import GoogleCalendarService

        logger.info(f"Processing BOOKING_CREATED for {booking_id}")
        
        # 1. Fetch Booking + related data
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            logger.error("Booking not found")
            return

        # Fetch booking type (with intake form info)
        bt_result = await db.execute(
            select(BookingType).where(BookingType.id == booking.booking_type_id)
        )
        booking_type = bt_result.scalar_one_or_none()

        # Fetch workspace
        ws_result = await db.execute(
            select(Workspace).where(Workspace.id == booking.workspace_id)
        )
        workspace = ws_result.scalar_one_or_none()

        # 2. Deduct Inventory
        inventory_links = await db.execute(
            select(BookingTypeInventoryLink)
            .where(BookingTypeInventoryLink.booking_type_id == booking.booking_type_id)
        )
        links = inventory_links.scalars().all()

        for link in links:
            item_result = await db.execute(select(InventoryItem).where(InventoryItem.id == link.inventory_item_id))
            item = item_result.scalar_one()
            
            new_qty = item.quantity - link.quantity_required
            item.quantity = max(0, new_qty)
            
            if new_qty <= item.threshold:
                alert = Alert(
                    workspace_id=booking.workspace_id,
                    type=AlertType.INVENTORY,
                    severity=AlertSeverity.WARNING,
                    title=f"Low Stock: {item.name}",
                    message=f"Inventory for {item.name} is low ({new_qty} remaining).",
                    link_to="/inventory"
                )
                db.add(alert)
                logger.warning(f"LOW STOCK ALERT: {item.name}")
            
            db.add(item)

        # 3. Fetch Contact
        contact_result = await db.execute(select(Contact).where(Contact.id == booking.contact_id))
        contact = contact_result.scalar_one()

        # Format time safely
        try:
            time_str = booking.start_time.strftime('%b %d at %I:%M %p')
        except Exception:
            time_str = str(booking.start_time)

        location = ""
        if booking_type:
            location = booking_type.location or ""
        if not location and workspace:
            location = workspace.address or ""

        # 4. Send Confirmation Email
        if contact.email:
            email_body = (
                f"Hi {contact.name},\n\n"
                f"Your booking for {booking_type.name if booking_type else 'your appointment'} "
                f"on {time_str} has been confirmed.\n\n"
            )
            if location:
                email_body += f"📍 Location: {location}\n\n"
            email_body += "Please arrive 5 minutes early.\n\nBest,\nThe CareOps Team"
            
            EmailProvider.send_email(
                to_email=contact.email,
                subject="Booking Confirmation",
                body=email_body
            )
        
        # 5. Send Confirmation SMS
        if contact.phone:
            sms_msg = f"Hi {contact.name}! Your booking for {time_str} is confirmed."
            if location:
                sms_msg += f" Location: {location}"
            SMSProvider.send_sms(to_phone=contact.phone, message=sms_msg)

        # 6. Create Booking Alert
        alert = Alert(
            workspace_id=booking.workspace_id,
            type=AlertType.BOOKING,
            severity=AlertSeverity.INFO,
            title=f"New Booking: {contact.name}",
            message=f"{contact.name} booked {booking_type.name if booking_type else 'an appointment'} for {time_str}",
            link_to="/bookings"
        )
        db.add(alert)

        # 7. Send Post-Booking Intake Form (if configured)
        if booking_type and booking_type.intake_form_id:
            logger.info(f"Sending post-booking intake form {booking_type.intake_form_id}")
            
            # Create a pending form submission
            from app.config import get_settings
            settings = get_settings()
            
            submission = FormSubmission(
                form_id=booking_type.intake_form_id,
                contact_id=contact.id,
                status=FormSubmissionStatus.PENDING,
                data={},
            )
            db.add(submission)
            await db.flush()

            form_link = f"{settings.FRONTEND_URL}/public/form/{booking_type.intake_form_id}"
            
            if contact.email:
                EmailProvider.send_email(
                    to_email=contact.email,
                    subject="Please complete your intake form",
                    body=(
                        f"Hi {contact.name},\n\n"
                        f"Thank you for booking with us! To make your visit smoother, "
                        f"please complete this intake form before your appointment:\n\n"
                        f"📋 {form_link}\n\n"
                        f"This helps us prepare for your visit.\n\n"
                        f"Best,\nThe CareOps Team"
                    )
                )

            if contact.phone:
                SMSProvider.send_sms(
                    to_phone=contact.phone,
                    message=f"Hi {contact.name}! Please complete your intake form before your visit: {form_link}"
                )

        # 8. Create Google Calendar Event
        if workspace and workspace.google_calendar_token:
            GoogleCalendarService.create_event(
                token_json=workspace.google_calendar_token,
                summary=f"Booking: {contact.name} - {booking_type.name if booking_type else 'Appointment'}",
                description=f"Client: {contact.name}\nEmail: {contact.email or 'N/A'}\nPhone: {contact.phone or 'N/A'}\nNotes: {booking.notes or 'None'}",
                location=location,
                start_time=booking.start_time,
                end_time=booking.end_time,
                attendee_email=contact.email or "",
            )
        else:
            # Simulate calendar event
            from app.services.google_calendar import GoogleCalendarService
            GoogleCalendarService.simulate_event(
                summary=f"Booking: {contact.name} - {booking_type.name if booking_type else 'Appointment'}",
                start_time=booking.start_time,
                end_time=booking.end_time,
                location=location,
                attendee_email=contact.email or "",
            )

        await db.commit()
    
    @staticmethod
    async def handle_event(event_id: str, db: AsyncSession):
        """Main entry point for generic automation events."""
        from app.models import Event, EventType
        
        result = await db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        
        if not event:
            return

        logger.info(f"Handling Event: {event.event_type}")

        if event.event_type == EventType.CONTACT_CREATED:
            await AutomationService.handle_contact_created(event.resource_id, db)
        
        elif event.event_type == EventType.BOOKING_CREATED:
            await AutomationService.handle_booking_created(event.resource_id, db)
        
        logger.info(f"Event {event_id} processed.")

    @staticmethod
    async def send_booking_reminder(booking_id: str, db: AsyncSession):
        """Send a pre-booking reminder (called by scheduler)."""
        from app.models import Booking, BookingType, Contact, Workspace
        
        result = await db.execute(select(Booking).where(Booking.id == booking_id))
        booking = result.scalar_one_or_none()
        if not booking:
            return

        contact_result = await db.execute(select(Contact).where(Contact.id == booking.contact_id))
        contact = contact_result.scalar_one_or_none()
        if not contact:
            return

        bt_result = await db.execute(select(BookingType).where(BookingType.id == booking.booking_type_id))
        booking_type = bt_result.scalar_one_or_none()

        ws_result = await db.execute(select(Workspace).where(Workspace.id == booking.workspace_id))
        workspace = ws_result.scalar_one_or_none()

        try:
            time_str = booking.start_time.strftime('%b %d at %I:%M %p')
        except Exception:
            time_str = str(booking.start_time)

        location = ""
        if booking_type and booking_type.location:
            location = booking_type.location
        elif workspace and workspace.address:
            location = workspace.address

        if contact.email:
            body = (
                f"Hi {contact.name},\n\n"
                f"This is a reminder about your upcoming appointment "
                f"for {booking_type.name if booking_type else 'your booking'} "
                f"on {time_str}.\n\n"
            )
            if location:
                body += f"📍 Location: {location}\n\n"
            body += "Please arrive 5 minutes early.\n\nBest,\nThe CareOps Team"
            
            EmailProvider.send_email(
                to_email=contact.email,
                subject="Appointment Reminder",
                body=body,
            )

        if contact.phone:
            sms = f"Reminder: Your appointment is on {time_str}."
            if location:
                sms += f" Location: {location}"
            SMSProvider.send_sms(to_phone=contact.phone, message=sms)

        logger.info(f"Reminder sent for booking {booking_id}")

    @staticmethod
    async def send_pending_form_reminder(submission_id: str, db: AsyncSession):
        """Send reminder for a pending form submission."""
        from app.models import FormSubmission, Form, Contact

        result = await db.execute(
            select(FormSubmission).where(FormSubmission.id == submission_id)
        )
        sub = result.scalar_one_or_none()
        if not sub or sub.status != "pending":
            return

        contact_result = await db.execute(select(Contact).where(Contact.id == sub.contact_id))
        contact = contact_result.scalar_one_or_none()
        if not contact:
            return

        form_result = await db.execute(select(Form).where(Form.id == sub.form_id))
        form = form_result.scalar_one_or_none()
        if not form:
            return

        from app.config import get_settings
        settings = get_settings()
        form_link = f"{settings.FRONTEND_URL}/public/form/{form.id}"

        if contact.email:
            EmailProvider.send_email(
                to_email=contact.email,
                subject=f"Reminder: Please complete your {form.name}",
                body=(
                    f"Hi {contact.name},\n\n"
                    f"We noticed you haven't completed your {form.name} yet. "
                    f"Please fill it out at your earliest convenience:\n\n"
                    f"📋 {form_link}\n\n"
                    f"Best,\nThe CareOps Team"
                )
            )

        if contact.phone:
            SMSProvider.send_sms(
                to_phone=contact.phone,
                message=f"Reminder: Please complete your {form.name}: {form_link}"
            )

        logger.info(f"Form reminder sent for submission {submission_id}")

    @staticmethod
    async def check_idle_conversations(db: AsyncSession):
        """Scheduled Task Stub: Check for conversations that need follow-up."""
        from app.models import Conversation, Message, SenderType
        
        result = await db.execute(
            select(Conversation).where(Conversation.status == "open")
        )
        conversations = result.scalars().all()
        
        for conv in conversations:
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(desc(Message.created_at))
                .limit(1)
            )
            last_msg = msg_result.scalar_one_or_none()
            
            if not last_msg:
                continue
                
            if last_msg.sender_type == SenderType.STAFF:
                logger.info(f"Automation PAUSED for Conversation {conv.id}: Staff replied.")
                continue
            
            logger.info(f"run_automation: Send follow-up for Conversation {conv.id} (Last msg from Contact)")

    @staticmethod
    async def check_and_create_alerts(db: AsyncSession, workspace_id: str):
        """
        Scans for overdue forms (> 2 days) and missed messages (> 24 hours)
        and creates standard Alerts.
        Called when Dashboard loads.
        """
        from app.models import (
            FormSubmission, FormSubmissionStatus, Alert, AlertType, AlertSeverity,
            Conversation, Message, SenderType, Contact, Form
        )
        from datetime import datetime, timedelta

        now = datetime.utcnow()
        
        # --- 1. Overdue Forms (Pending > 2 days) ---
        overdue_threshold = now - timedelta(days=2)
        
        stmt = (
            select(FormSubmission)
            .join(Form)
            .where(
                Form.workspace_id == workspace_id,
                FormSubmission.status == FormSubmissionStatus.PENDING,
                FormSubmission.created_at < overdue_threshold
            )
        )
        result = await db.execute(stmt)
        overdue_subs = result.scalars().all()
        
        for sub in overdue_subs:
            # Check if alert exists
            link = f"/forms"  # General link or specific? Let's use specific to dedupe
            # We can put ID in the message or use a hidden field if we had one.
            # Let's rely on checking if we created an alert for this Contact + Form recently?
            # Or simpler: Check if there is an UNREAD alert for this.
            
            # Fetch contact
            c_res = await db.execute(select(Contact).where(Contact.id == sub.contact_id))
            contact = c_res.scalar_one_or_none()
            if not contact: continue
            
            f_res = await db.execute(select(Form).where(Form.id == sub.form_id))
            form = f_res.scalar_one_or_none()
            if not form: continue

            title = f"Overdue Form: {contact.name}"
            # Check for existing alert with specific title
            exists = await db.execute(
                select(Alert).where(
                    Alert.workspace_id == workspace_id,
                    Alert.title == title,
                    Alert.is_read == False,
                    Alert.type == AlertType.FORM
                )
            )
            if exists.scalar_one_or_none():
                continue

            # Create Alert
            alert = Alert(
                workspace_id=workspace_id,
                type=AlertType.FORM,
                severity=AlertSeverity.WARNING,
                title=title,
                message=f"{contact.name} has not submitted '{form.name}' (Sent > 2 days ago).",
                link_to="/forms"
            )
            db.add(alert)
            # Update submission status to OVERDUE if not already
            if sub.status != FormSubmissionStatus.OVERDUE:
                sub.status = FormSubmissionStatus.OVERDUE
                db.add(sub)


        # --- 2. Missed Messages (Unreplied > 24 hours) ---
        missed_threshold = now - timedelta(hours=24)
        
        stmt = (
            select(Conversation)
            .where(
                Conversation.workspace_id == workspace_id,
                Conversation.status == "open",
                Conversation.last_message_at < missed_threshold
            )
        )
        result = await db.execute(stmt)
        conversations = result.scalars().all()

        for conv in conversations:
            # Check last message sender
            m_res = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(desc(Message.created_at))
                .limit(1)
            )
            last_msg = m_res.scalar_one_or_none()
            
            if not last_msg or last_msg.sender_type == SenderType.STAFF:
                continue

            # It's a missed message from a contact
            c_res = await db.execute(select(Contact).where(Contact.id == conv.contact_id))
            contact = c_res.scalar_one_or_none()
            if not contact: continue

            title = f"Missed Message: {contact.name}"
            exists = await db.execute(
                select(Alert).where(
                    Alert.workspace_id == workspace_id,
                    Alert.title == title,
                    Alert.is_read == False,
                    Alert.type == AlertType.INBOX
                )
            )
            if exists.scalar_one_or_none():
                continue

            alert = Alert(
                workspace_id=workspace_id,
                type=AlertType.INBOX,
                severity=AlertSeverity.WARNING,
                title=title,
                message=f"Last message from {contact.name} was > 24h ago.",
                link_to=f"/inbox?conversation_id={conv.id}"
            )
            db.add(alert)

        await db.commit()
