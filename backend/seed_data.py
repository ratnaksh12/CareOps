import asyncio
import logging
import sys
import os

# Only configure logging if running as a script
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import async_session, engine, Base
from app.models import User, Workspace, BookingType, InventoryItem, BookingTypeInventoryLink
from app.security import hash_password
from sqlalchemy import select

logger = logging.getLogger("seed")

async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check for Workspace
        workspace = await db.get(Workspace, "ws-default")
        if not workspace:
            logger.info("Creating default workspace...")
            workspace = Workspace(
                id="ws-default",
                name="CareOps Demo Health",
                owner_id="user-admin", 
                is_active=True,
                onboarding_step=8,
                contact_email="admin@careops.com"
            )
            db.add(workspace)
            await db.flush()
        else:
            # Ensure existing workspace has correct onboarding
            workspace.onboarding_step = 8
            workspace.is_active = True
            logger.info("Workspace already exists — updated onboarding_step.")
        
        # Check for User
        user = await db.get(User, "user-admin")
        if not user:
            logger.info("Creating admin user...")
            user = User(
                id="user-admin",
                email="admin@careops.com",
                hashed_password=hash_password("admin123"),
                full_name="Admin User",
                role="admin",
                workspace_id="ws-default"
            )
            db.add(user)
        else:
            logger.info("Admin user already exists.")
        
        # Booking Type
        bt = await db.get(BookingType, "bt-consult")
        if not bt:
            logger.info("Creating booking type...")
            bt = BookingType(
                id="bt-consult",
                workspace_id="ws-default",
                name="Initial Consultation",
                duration_minutes=30,
                description="Free 30-min intro call.",
                is_active=True
            )
            db.add(bt)
        
        # Inventory Items
        gloves = await db.get(InventoryItem, "inv-gloves")
        if not gloves:
            logger.info("Creating inventory items...")
            gloves = InventoryItem(
                id="inv-gloves",
                workspace_id="ws-default",
                name="Examination Gloves",
                quantity=100,
                threshold=20,
                unit="pairs"
            )
            db.add(gloves)
            await db.flush()

        masks = await db.get(InventoryItem, "inv-masks")
        if not masks:
            masks = InventoryItem(
                id="inv-masks",
                workspace_id="ws-default",
                name="Face Masks",
                quantity=50,
                threshold=10,
                unit="pcs"
            )
            db.add(masks)
            await db.flush()

        sanitizer = await db.get(InventoryItem, "inv-sanitizer")
        if not sanitizer:
            sanitizer = InventoryItem(
                id="inv-sanitizer",
                workspace_id="ws-default",
                name="Hand Sanitizer",
                quantity=30,
                threshold=5,
                unit="bottles"
            )
            db.add(sanitizer)
            await db.flush()

        # Link inventory to booking type: consultation uses 2 gloves + 1 mask
        result = await db.execute(
            select(BookingTypeInventoryLink).where(
                BookingTypeInventoryLink.booking_type_id == "bt-consult",
                BookingTypeInventoryLink.inventory_item_id == "inv-gloves"
            )
        )
        if not result.scalars().first():
            logger.info("Linking inventory to booking types...")
            db.add(BookingTypeInventoryLink(
                booking_type_id="bt-consult",
                inventory_item_id="inv-gloves",
                quantity_required=2
            ))
            db.add(BookingTypeInventoryLink(
                booking_type_id="bt-consult",
                inventory_item_id="inv-masks",
                quantity_required=1
            ))

        await db.commit()
        logger.info("Seeding Complete!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed())
