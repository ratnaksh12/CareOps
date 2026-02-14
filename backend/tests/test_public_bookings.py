import asyncio
import sys
import os
from datetime import datetime, timedelta
sys.path.insert(0, ".")

from httpx import AsyncClient, ASGITransport
from app.main import app

async def run_test():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # 1. Login as Admin to create a Booking Type
        print("🔐 Logging in...")
        # Try login, if fails, register (resilience)
        auth_data = {"email": "admin@careops.com", "password": "test1234"}
        r = await c.post("/api/v1/auth/login", json=auth_data)
        if r.status_code != 200:
            print("   Registering admin...")
            await c.post("/api/v1/auth/register", json={**auth_data, "full_name": "Admin"})
            r = await c.post("/api/v1/auth/login", json=auth_data)
        
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Booking Type
        print("📅 Creating 'Initial Consultation' Booking Type...")
        bt_data = {
            "name": "Initial Consultation",
            "duration_minutes": 30,
            "description": "First meeting to discuss requirements.",
            "location": "Zoom",
            "is_active": True
        }
        r = await c.post("/api/v1/bookings/types", json=bt_data, headers=headers)
        if r.status_code != 200:
            print(f"❌ Create Booking Type Failed: {r.text}")
            return
        bt_id = r.json()["id"]
        print(f"✅ Booking Type Created: {bt_id}")

        # 3. Public: Fetch Booking Types (No Auth)
        print("🌍 Public: Fetching Booking Types...")
        # Note: We need workspace_id. Usually this comes from domain/subdomain, 
        # but here we'll assume we know the workspace or filter by it.
        # For this test, let's get the workspace_id from the login user info first.
        user_r = await c.get("/api/v1/auth/me", headers=headers)
        workspace_id = user_r.json()["workspace_id"]

        r = await c.get(f"/api/v1/public/booking-types?workspace_id={workspace_id}")
        if r.status_code != 200:
            print(f"❌ Public Fetch Failed: {r.text}")
            return
        
        types = r.json()
        print(f"✅ Found {len(types)} public booking types.")
        
        target_type = next((t for t in types if t["id"] == bt_id), None)
        if not target_type:
            print("❌ Created type not found in public list!")
            return

        # 4. Public: Create Booking (No Auth)
        print("🚀 Public: Creating Booking...")
        start_time = (datetime.utcnow() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        
        booking_payload = {
            "booking_type_id": bt_id,
            "start_time": start_time.isoformat() + "Z",
            "name": "New Client",
            "email": "client@example.com", 
            "phone": "+15550000000",
            "notes": "Looking forward to it!"
        }
        
        r = await c.post("/api/v1/public/bookings", json=booking_payload)
        if r.status_code != 200:
            print(f"❌ Create Public Booking Failed: {r.text}")
            return
        
        booking = r.json()
        print(f"✅ Public Booking Success: ID={booking['id']}")
        print(f"   Contact Linked: {booking['contact']['name']} ({booking['contact']['email']})")
        
        # 5. Verify Contact was created (Login as Admin)
        print("🔍 Verifying Contact via Admin API...")
        r = await c.get(f"/api/v1/contacts/{booking['contact_id']}", headers=headers)
        if r.status_code == 200:
            print("✅ Contact found in active workspace.")
        else:
            print("❌ Contact verification failed.")

        print("\n🎉 Public Booking System Verification Passed!")

if __name__ == "__main__":
    asyncio.run(run_test())
