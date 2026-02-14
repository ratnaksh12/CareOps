import asyncio
from datetime import datetime
from app.database import async_session
from app.models import Workspace
from sqlalchemy import select

async def fix_ws_order():
    async with async_session() as db:
        # Find Roonie Surgicals
        result = await db.execute(select(Workspace).where(Workspace.name == "Roonie Surgicals"))
        target_ws = result.scalar_one_or_none()
        
        if target_ws:
            print(f"Updating {target_ws.name} ({target_ws.id}) to be the newest.")
            target_ws.created_at = datetime.utcnow()
            await db.commit()
            print("Done.")
        else:
            print("Target workspace not found.")

        # Verify order
        print("\nNew Order:")
        res = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()))
        for w in res.scalars().all():
            print(f"- {w.name} ({w.id})")

if __name__ == "__main__":
    asyncio.run(fix_ws_order())
