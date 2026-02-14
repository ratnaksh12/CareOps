import asyncio
import sys
import os
sys.path.append(os.getcwd())

from app.database import async_session
from app.models import BusinessAvailability, Workspace, DayOfWeek
from sqlalchemy import select

async def seed_availability():
    async with async_session() as db:
        # Get Roonie Surgicals
        res = await db.execute(select(Workspace).where(Workspace.name == "Roonie Surgicals"))
        ws = res.scalar_one_or_none()
        if not ws:
            print("Workspace not found!")
            return

        print(f"Seeding Availability for {ws.name} ({ws.id})")
        
        # Clear existing
        # await db.execute(delete(BusinessAvailability).where(BusinessAvailability.workspace_id == ws.id))

        days = [
            DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
            DayOfWeek.THURSDAY, DayOfWeek.FRIDAY
        ]

        for day in days:
            # Check if exists
            res = await db.execute(select(BusinessAvailability).where(
                BusinessAvailability.workspace_id == ws.id,
                BusinessAvailability.day_of_week == day
            ))
            if res.scalar_one_or_none():
                continue

            avail = BusinessAvailability(
                workspace_id=ws.id,
                day_of_week=day,
                start_time="09:00",
                end_time="17:00",
                is_active=True
            )
            db.add(avail)
            print(f"Added {day}")

        await db.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_availability())
