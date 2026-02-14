import asyncio
from app.database import async_session
from app.models import Workspace
from sqlalchemy import select

async def check_workspace():
    async with async_session() as db:
        result = await db.execute(select(Workspace))
        ws = result.scalars().first()
        if ws:
            print(f"Workspace Found: {ws.id} - {ws.name}")
        else:
            print("NO WORKSPACE FOUND!")

if __name__ == "__main__":
    asyncio.run(check_workspace())
