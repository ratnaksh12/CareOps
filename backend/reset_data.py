import asyncio
from sqlalchemy import text
from app.database import engine

async def reset_data():
    async with engine.begin() as conn:
        print("Starting data reset (Leads, Bookings, Messages)...")
        try:
            # Delete in order of dependency to avoid FK violations
            await conn.execute(text("DELETE FROM messages"))
            await conn.execute(text("DELETE FROM conversations"))
            await conn.execute(text("DELETE FROM form_submissions"))
            await conn.execute(text("DELETE FROM bookings"))
            await conn.execute(text("DELETE FROM alerts"))
            # Finally delete contacts
            await conn.execute(text("DELETE FROM contacts"))
            
            print("✅ Operational data cleared successfully.")
            print("Preserved: Users, Workspaces, Booking Types, Forms, Inventory.")
        except Exception as e:
            print(f"❌ Error resetting data: {e}")

if __name__ == "__main__":
    asyncio.run(reset_data())
