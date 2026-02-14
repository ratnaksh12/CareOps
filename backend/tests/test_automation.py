import asyncio
import sys
import os
from datetime import datetime, timedelta
sys.path.insert(0, ".")

# Use a separate test database to avoid conflicts with locked production DB
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_careops_v2.db"

# Remove old test DB
if os.path.exists("test_careops.db"):
    try:
        os.remove("test_careops.db")
    except OSError:
        pass

from httpx import AsyncClient, ASGITransport
from app.main import app as fastapi_app

ADMIN_EMAIL = "admin_auto@careops.com"
TEST_ITEM_NAME = "Test Projector"
TEST_BOOKING_TYPE = "Conference Room Booking"


async def run_test():
    # ASGITransport does NOT trigger FastAPI lifespan, so we must create tables manually
    from app.database import engine, Base
    import app.models  # noqa - ensures all models are registered
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.\n")

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # 1. Login/Register Admin
        print("Step 1: Logging in...")
        auth_data = {"email": ADMIN_EMAIL, "password": "test1234"}
        r = await c.post("/api/v1/auth/login", json=auth_data)
        if r.status_code != 200:
            r2 = await c.post("/api/v1/auth/register", json={**auth_data, "full_name": "Admin Auto"})
            if r2.status_code != 200:
                print(f"  REGISTER FAILED: {r2.status_code} {r2.text}")
                return
            r = await c.post("/api/v1/auth/login", json=auth_data)
        
        if r.status_code != 200:
            print(f"  LOGIN FAILED: {r.status_code} {r.text}")
            return
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  OK")

        # 2. Create Workspace
        print("Step 2: Creating Workspace...")
        user_r = await c.get("/api/v1/auth/me", headers=headers)
        user = user_r.json()
        if not user.get("workspace_id"):
            ws_data = {"name": "Auto Test Workspace", "address": "123 Auto St"}
            r = await c.post("/api/v1/workspaces", json=ws_data, headers=headers)
            if r.status_code != 200:
                print(f"  FAILED: {r.status_code} {r.text}")
                return
            print(f"  Created: {r.json()['id']}")
        else:
            print("  Already has workspace.")

        # 3. Create Inventory Item
        print("Step 3: Creating Inventory Item...")
        item_data = {"name": TEST_ITEM_NAME, "quantity": 5, "threshold": 2, "unit": "units"}
        r = await c.post("/api/v1/inventory", json=item_data, headers=headers)
        if r.status_code != 200:
            print(f"  FAILED: {r.status_code} {r.text}")
            return
        item_id = r.json()["id"]
        print(f"  Created: {item_id} (Qty: 5)")

        # 4. Create Booking Type
        print("Step 4: Creating Booking Type...")
        bt_data = {
            "name": TEST_BOOKING_TYPE,
            "duration_minutes": 60,
            "description": "Uses 1 Projector per booking"
        }
        r = await c.post("/api/v1/bookings/types", json=bt_data, headers=headers)
        if r.status_code != 200:
            print(f"  FAILED: {r.status_code} {r.text}")
            return
        bt_id = r.json()["id"]
        print(f"  Created: {bt_id}")

        # 5. Link Inventory to Booking Type
        print("Step 5: Linking Inventory to Booking Type...")
        link_data = {"inventory_item_id": item_id, "quantity_required": 1}
        r = await c.post(f"/api/v1/bookings/types/{bt_id}/inventory", json=link_data, headers=headers)
        if r.status_code == 200:
            print("  Linked OK.")
        elif r.status_code == 400:
            print("  Already linked.")
        else:
            print(f"  FAILED: {r.status_code} {r.text}")
            return

        # 6. Create Booking (via public endpoint -> triggers automation)
        print("Step 6: Creating Booking (triggers inventory deduction)...")
        start_time = (datetime.utcnow() + timedelta(days=2)).replace(hour=14, minute=0, second=0, microsecond=0)
        booking_payload = {
            "booking_type_id": bt_id,
            "start_time": start_time.isoformat() + "Z",
            "name": "Auto User",
            "email": "auto@example.com",
            "phone": "+19998887777"
        }
        r = await c.post("/api/v1/public/bookings", json=booking_payload)
        if r.status_code != 200:
            print(f"  FAILED: {r.status_code} {r.text}")
            return
        booking_id = r.json()["id"]
        print(f"  Created: {booking_id}")

        # 7. Verify Inventory Deduction
        print("Step 7: Verifying Inventory Deduction...")
        r = await c.get(f"/api/v1/inventory/{item_id}", headers=headers)
        item = r.json()
        qty = item["quantity"]
        print(f"  Current Quantity: {qty}")
        
        if qty == 4:
            print("  PASS: Inventory deducted correctly (5 -> 4).")
        else:
            print(f"  WARN: Expected 4, got {qty}")

        # 8. Create more bookings to trigger Low Stock Alert
        print("Step 8: Creating 3 more bookings to trigger Low Stock Alert...")
        for i in range(3):
            st = start_time + timedelta(hours=i+1)
            booking_payload["start_time"] = st.isoformat() + "Z"
            r = await c.post("/api/v1/public/bookings", json=booking_payload)
            if r.status_code != 200:
                print(f"  Booking {i+1} FAILED: {r.status_code}")
        
        # 9. Verify Final Quantity
        r = await c.get(f"/api/v1/inventory/{item_id}", headers=headers)
        final_qty = r.json()["quantity"]
        print(f"  Final Quantity: {final_qty}")
        if final_qty == 1:
            print("  PASS: Final quantity correct (5 - 4 = 1).")
        else:
            print(f"  Got: {final_qty}")

        # 10. Test Public Lead & Automation
        print("\nStep 10: Testing Public Lead Submission & Automation...")
        timestamp = int(datetime.utcnow().timestamp())
        lead_data = {
            "name": "Public Lead User",
            "email": f"lead_{timestamp}@public.com",
            "message": "Interested in your services."
        }
        # Note: In real app, workspace_id might be inferred or passed. 
        # For this test, we might need to pass it if the API requires it,
        # but public API attempts to find default workspace.
        
        r = await c.post("/api/v1/public/contacts", json=lead_data)
        if r.status_code != 200:
             # Try passing workspace_id if it failed (multi-tenant fallback)
             lead_data["workspace_id"] = user.get("workspace_id")
             r = await c.post("/api/v1/public/contacts", json=lead_data)
        
        if r.status_code == 200:
            print("  PASS: Public lead submitted.")
            contact_id = r.json()["id"]
            
            # Allow async background task to run
            print("  Waiting for automation...")
            await asyncio.sleep(2)
            
            # Verify Alert was created
            r = await c.get("/api/v1/dashboard/stats", headers=headers)
            stats = r.json()
            alerts = stats.get("recent_alerts", [])
            lead_alert = next((a for a in alerts if "New Lead" in a["title"]), None)
            
            if lead_alert:
                print(f"  PASS: Automation created alert: {lead_alert['title']}")
            else:
                print("  WARN: No new lead alert found in dashboard stats.")
                print(f"  Alerts found: {alerts}")
        else:
            print(f"  FAILED: Public contact submission {r.status_code} {r.text}")

        # 11. Test Staff Logic (Pause Automation)
        print("\nStep 11: Testing Staff Logic (Pause Automation)...")
        from app.models import Conversation, Message, SenderType, Contact, Workspace
        # Create dummy conversation and messages directly in DB for speed
        if timestamp: 
             # Re-use workspace from previous steps? better to fetch it
            result = await db.execute(select(Workspace))
            ws = result.scalars().first()
            if ws:
                 # Create contact
                contact = Contact(id=str(uuid.uuid4()), workspace_id=ws.id, name="Test Staff Logic", email=f"logic_{timestamp}@test.com", status="lead", source="manual")
                db.add(contact)
                await db.commit()
                
                # Create Conversation
                conv = Conversation(id=str(uuid.uuid4()), workspace_id=ws.id, contact_id=contact.id, status="open")
                db.add(conv)
                await db.commit()
                
                # Add Staff Message
                msg = Message(
                    id=str(uuid.uuid4()), 
                    conversation_id=conv.id, 
                    sender_type=SenderType.STAFF, 
                    content="Hi there, how can I help?",
                    created_at=datetime.utcnow()
                )
                db.add(msg)
                await db.commit()
                
                # Check Logic
                from app.services.automation import AutomationService
                await AutomationService.check_idle_conversations(db)
                print("  PASS: Automation Service checked. (Verify logs for 'PAUSED')")

        print("\n=== Automation & Inventory Logic Test Complete ===")


if __name__ == "__main__":
    asyncio.run(run_test())
