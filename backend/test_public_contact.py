import asyncio
import uuid
from app.api.v1.public_contacts import ensure_conversation_and_message, PublicContactCreate, create_public_contact
from app.database import async_session
from app.models import Workspace
from sqlalchemy import select

async def test_create_contact():
    async with async_session() as db:
        # Fetch a valid workspace ID
        result = await db.execute(select(Workspace))
        ws = result.scalars().first()
        if not ws:
            print("FAILED: No workspace found to attach contact to.")
            return
        
        ws_id = ws.id
        print(f"Using Workspace ID: {ws_id}")

        # Mock data
        contact_data = PublicContactCreate(
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            phone="1234567890",
            message="This is a test run message directly from backend script.",
            workspace_id=ws_id
        )
        
        # We need to manually call the function since it's an endpoint
        # But wait, the function expects a db session from Depends(get_db)
        # We passed 'db' directly.
        
        try:
            print("Attempting to create contact...")
            result = await create_public_contact(contact_data, db)
            print(f"Success! Contact ID: {result.id}")
        except Exception as e:
            with open("error_log.txt", "w") as f:
                f.write(f"FAILED: {e}\n")
                import traceback
                traceback.print_exc(file=f)
            print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_create_contact())
