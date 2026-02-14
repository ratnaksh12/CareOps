import asyncio
from app.database import async_session
from app.models import Workspace, User, Contact
from sqlalchemy import select

async def audit_data():
    async with async_session() as db:
        with open("audit_log.txt", "w") as f:
            f.write("--- WORKSPACES ---\n")
            ws_res = await db.execute(select(Workspace))
            for w in ws_res.scalars().all():
                f.write(f"WS: {w.id} | Name: {w.name}\n")

            f.write("\n--- USERS ---\n")
            u_res = await db.execute(select(User))
            for u in u_res.scalars().all():
                f.write(f"User: {u.email} | WS_ID: {u.workspace_id}\n")

            f.write("\n--- CONTACTS (Last 5) ---\n")
            c_res = await db.execute(select(Contact).order_by(Contact.created_at.desc()).limit(5))
            for c in c_res.scalars().all():
                f.write(f"Contact: {c.email or c.name} | WS_ID: {c.workspace_id} | Created: {c.created_at}\n")

if __name__ == "__main__":
    asyncio.run(audit_data())
