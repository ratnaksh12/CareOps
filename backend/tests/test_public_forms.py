import asyncio
import sys
import os
sys.path.insert(0, ".")

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import engine, Base

async def run_test():
    # Note: We assume the server is running and DB exists, or we use the app directly.
    # To be safe, let's use the app directly with ASGITransport like in e2e test.
    # But we won't wipe the DB, just use existing if possible, or create new form.
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        # 1. Login as Admin to create a form
        print("🔐 Logging in...")
        r = await c.post("/api/v1/auth/login", json={"email": "admin@careops.com", "password": "test1234"})
        if r.status_code != 200:
            print(f"❌ Login failed: {r.text}")
            # Try registering if login fails (e.g. if DB was wiped)
            print("   Attempting registration...")
            r = await c.post("/api/v1/auth/register", json={
                "email": "admin@careops.com", "password": "test1234", "full_name": "Admin User"
            })
            if r.status_code != 200:
                 print(f"❌ Register failed: {r.text}")
                 return

        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create a Form
        print("📝 Creating Form...")
        form_data = {
            "name": "Public Challenge Form",
            "description": "Test public submission",
            "fields": [
                {"label": "Full Name", "type": "text", "required": True},
                {"label": "Email", "type": "email", "required": True},
                {"label": "Feedback", "type": "textarea", "required": False}
            ]
        }
        r = await c.post("/api/v1/forms", json=form_data, headers=headers)
        if r.status_code != 200:
            print(f"❌ Create Form failed: {r.text}")
            return
        
        form_id = r.json()["id"]
        print(f"✅ Form Created: {form_id}")

        # 3. Fetch Form publicly (No Auth)
        print("🌍 Fetching Public Form...")
        r = await c.get(f"/api/v1/forms/{form_id}/public")
        if r.status_code == 200:
            print(f"✅ Public Fetch Success: {r.json()['name']}")
        else:
            print(f"❌ Public Fetch Failed: {r.status_code} {r.text}")
            return

        # 4. Submit Form publicly (No Auth)
        print("🚀 Submitting Form...")
        submission_data = {
            "name": "Public User",
            "email": "public@example.com",
            "Feedback": "Great service!"
        }
        r = await c.post(f"/api/v1/forms/{form_id}/submit", json=submission_data)
        if r.status_code == 200:
            sub = r.json()
            print(f"✅ Submission Success: ID={sub['id']}")
            print(f"   Contact: {sub['contact']['name']} ({sub['contact']['email']})")
        else:
            print(f"❌ Submission Failed: {r.status_code} {r.text}")
            return

        print("\n🎉 Public Forms Verification Passed!")

if __name__ == "__main__":
    asyncio.run(run_test())
