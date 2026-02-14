import asyncio
from app.database import async_session
from app.models import BusinessAvailability, Workspace
from sqlalchemy import select

async def check_availability():
    async with async_session() as db:
        # Get Roonie Surgicals workspace
        res = await db.execute(select(Workspace).where(Workspace.name == "Roonie Surgicals"))
        ws = res.scalar_one_or_none()
        if not ws:
            print("Workspace not found!")
            return

        print(f"Checking Availability for WS: {ws.id}")
        res = await db.execute(select(BusinessAvailability).where(BusinessAvailability.workspace_id == ws.id))
        avail = res.scalars().all()
        
        if not avail:
            print("NO AVAILABILITY CONFIGURED.")
        else:
            for a in avail:
                print(f"Day {a.day_of_week}: {a.start_time} - {a.end_time} (Active: {a.is_active})")

if __name__ == "__main__":
    asyncio.run(check_availability())
