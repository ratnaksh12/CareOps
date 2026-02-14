import asyncio
from sqlalchemy import text
from app.database import engine

async def full_reset():
    async with engine.begin() as conn:
        print("Starting FULL SYSTEM RESET (Deleting Users & Workspaces)...")
        try:
            # Operational Data
            await conn.execute(text("DELETE FROM messages"))
            await conn.execute(text("DELETE FROM conversations"))
            await conn.execute(text("DELETE FROM form_submissions"))
            await conn.execute(text("DELETE FROM bookings"))
            await conn.execute(text("DELETE FROM alerts"))
            await conn.execute(text("DELETE FROM automation_events"))
            
            # Setup Data (Child first)
            await conn.execute(text("DELETE FROM booking_type_inventory_links"))
            await conn.execute(text("DELETE FROM inventory_items"))
            await conn.execute(text("DELETE FROM booking_types"))
            await conn.execute(text("DELETE FROM forms"))
            await conn.execute(text("DELETE FROM contacts"))
            
            # Core Auth Data (Child first)
            await conn.execute(text("DELETE FROM staff_roles"))
            await conn.execute(text("DELETE FROM users"))
            await conn.execute(text("DELETE FROM workspaces"))
            
            print("✅ ALL DATA CLEARED. System is empty.")
            print("You can now register as a new user.")
        except Exception as e:
            print(f"❌ Error resetting data: {e}")

if __name__ == "__main__":
    asyncio.run(full_reset())
