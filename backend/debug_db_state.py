
import asyncio
import os
import sys
from sqlalchemy import select
# Adjust path to find 'app'
sys.path.append(os.getcwd())

from app.database import async_session
from app.models import User, Workspace, BookingType

async def debug_db():
    async with async_session() as db:
        with open("db_debug_output.txt", "w", encoding="utf-8") as f:
            f.write("=== DEBUG START ===\n")
            
            # Users
            f.write("\n--- USERS ---\n")
            result = await db.execute(select(User))
            users = result.scalars().all()
            for u in users:
                f.write(f"User: {u.email} | WorkspaceID: {u.workspace_id}\n")

            # Workspaces
            f.write("\n--- WORKSPACES ---\n")
            result = await db.execute(select(Workspace).order_by(Workspace.created_at.asc()))
            workspaces = result.scalars().all()
            for w in workspaces:
                f.write(f"Workspace: {w.name} | ID: {w.id} | CreatedAt: {w.created_at}\n")

            # Booking Types
            f.write("\n--- BOOKING TYPES ---\n")
            result = await db.execute(select(BookingType))
            bts = result.scalars().all()
            for bt in bts:
                f.write(f"BT: {bt.name} | ID: {bt.id} | WS_ID: {bt.workspace_id} | Active: {bt.is_active}\n")
                
            f.write("\n=== DEBUG END ===\n")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_db())
