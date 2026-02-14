"""Comprehensive end-to-end API test for CareOps."""
import asyncio
import os
import sys
sys.path.insert(0, ".")

# Remove old db
try:
    os.remove("careops.db")
except (FileNotFoundError, PermissionError):
    pass

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import engine, Base

passed = 0
failed = 0

def ok(label):
    global passed
    passed += 1
    print(f"  ✅ {label}")

def fail(label, detail=""):
    global failed
    failed += 1
    print(f"  ❌ {label}: {detail}")

async def run_tests():
    # Explicitly create tables since ASGITransport doesn't trigger lifespan automatically here
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Test DB initialized.")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:

        # ===== AUTH =====
        print("\n🔐 AUTH")
        r = await c.post("/api/v1/auth/register", json={
            "email": "admin@careops.com", "password": "test1234", "full_name": "Admin User"
        })
        if r.status_code == 200:
            ok(f"Register → {r.status_code}")
            token = r.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
        else:
            fail("Register", r.text); return

        r = await c.post("/api/v1/auth/login", json={"email": "admin@careops.com", "password": "test1234"})
        ok(f"Login → {r.status_code}") if r.status_code == 200 else fail("Login", r.text)

        r = await c.get("/api/v1/auth/me", headers=headers)
        ok(f"Me → {r.status_code}") if r.status_code == 200 else fail("Me", r.text)

        # ===== WORKSPACE =====
        print("\n🏢 WORKSPACE")
        r = await c.post("/api/v1/workspaces", json={
            "name": "Test Clinic", "address": "123 Main St", "timezone": "US/Eastern"
        }, headers=headers)
        if r.status_code == 200:
            ok(f"Create workspace → {r.status_code}")
        else:
            fail("Create workspace", r.text); return

        r = await c.get("/api/v1/workspaces/current", headers=headers)
        ok(f"Get current workspace → {r.status_code}") if r.status_code == 200 else fail("Get workspace", r.text)

        # ===== CONTACTS =====
        print("\n👤 CONTACTS")
        r = await c.post("/api/v1/contacts", json={
            "name": "John Doe", "email": "john@example.com", "phone": "+1234567890"
        }, headers=headers)
        if r.status_code == 200:
            ok(f"Create contact → {r.status_code}")
            contact_id = r.json()["id"]
        else:
            fail("Create contact", r.text); return

        r = await c.get("/api/v1/contacts", headers=headers)
        ok(f"List contacts → {r.status_code} ({len(r.json())} found)") if r.status_code == 200 else fail("List contacts", r.text)

        # ===== CONVERSATIONS (auto-created when contact was created) =====
        print("\n💬 CONVERSATIONS")
        r = await c.get("/api/v1/conversations", headers=headers)
        if r.status_code == 200 and len(r.json()) > 0:
            ok(f"List conversations → {r.status_code} ({len(r.json())} found)")
            conv_id = r.json()[0]["id"]
        else:
            fail("List conversations", r.text); return

        r = await c.post(f"/api/v1/conversations/{conv_id}/messages", json={
            "content": "Hello! Welcome to our clinic.", "channel": "internal"
        }, headers=headers)
        ok(f"Send message → {r.status_code}") if r.status_code == 200 else fail("Send message", r.text)

        r = await c.get(f"/api/v1/conversations/{conv_id}/messages", headers=headers)
        if r.status_code == 200:
            ok(f"Get messages → {r.status_code} ({len(r.json())} msgs)")
        else:
            fail("Get messages", r.text)

        # ===== BOOKINGS =====
        print("\n📅 BOOKINGS")
        r = await c.post("/api/v1/bookings/types", json={
            "name": "Consultation", "duration_minutes": 30, "description": "Initial consultation"
        }, headers=headers)
        if r.status_code == 200:
            ok(f"Create booking type → {r.status_code}")
            bt_id = r.json()["id"]
        else:
            fail("Create booking type", r.text); return

        r = await c.post("/api/v1/bookings", json={
            "booking_type_id": bt_id, "contact_id": contact_id,
            "start_time": "2026-02-15T10:00:00", "end_time": "2026-02-15T10:30:00",
            "notes": "First visit"
        }, headers=headers)
        if r.status_code == 200:
            ok(f"Create booking → {r.status_code}")
            booking_id = r.json()["id"]
        else:
            fail("Create booking", r.text); return

        r = await c.get("/api/v1/bookings", headers=headers)
        ok(f"List bookings → {r.status_code} ({len(r.json())} found)") if r.status_code == 200 else fail("List bookings", r.text)

        r = await c.patch(f"/api/v1/bookings/{booking_id}", json={"status": "confirmed"}, headers=headers)
        ok(f"Confirm booking → {r.status_code}") if r.status_code == 200 else fail("Confirm booking", r.text)

        # ===== FORMS =====
        print("\n📋 FORMS")
        r = await c.post("/api/v1/forms", json={
            "name": "Patient Intake", "description": "New patient form",
            "fields": [
                {"label": "Full Name", "type": "text", "required": True},
                {"label": "DOB", "type": "date", "required": True}
            ]
        }, headers=headers)
        if r.status_code == 200:
            ok(f"Create form → {r.status_code}")
        else:
            fail("Create form", r.text); return

        r = await c.get("/api/v1/forms", headers=headers)
        ok(f"List forms → {r.status_code} ({len(r.json())} found)") if r.status_code == 200 else fail("List forms", r.text)

        # ===== INVENTORY =====
        print("\n📦 INVENTORY")
        r = await c.post("/api/v1/inventory", json={
            "name": "Surgical Masks", "quantity": 500, "threshold": 100, "unit": "pieces"
        }, headers=headers)
        if r.status_code == 200:
            ok(f"Create inventory item → {r.status_code}")
            inv_id = r.json()["id"]
        else:
            fail("Create inventory", r.text); return

        r = await c.get("/api/v1/inventory", headers=headers)
        ok(f"List inventory → {r.status_code} ({len(r.json())} found)") if r.status_code == 200 else fail("List inventory", r.text)

        r = await c.patch(f"/api/v1/inventory/{inv_id}", json={"quantity": 50}, headers=headers)
        ok(f"Update stock → {r.status_code}") if r.status_code == 200 else fail("Update stock", r.text)

        # ===== DASHBOARD =====
        print("\n📊 DASHBOARD")
        r = await c.get("/api/v1/dashboard/stats", headers=headers)
        if r.status_code == 200:
            stats = r.json()
            ok(f"Dashboard stats → bookings_upcoming={stats.get('bookings_upcoming',0)}, open_convos={stats.get('open_conversations',0)}")
        else:
            fail("Dashboard stats", r.text)

        # ===== SUMMARY =====
        print(f"\n{'='*50}")
        print(f"  Results: {passed} passed, {failed} failed")
        print(f"{'='*50}")
        if failed == 0:
            print("  🎉 ALL TESTS PASSED!")
        else:
            print("  ⚠️  Some tests failed")

asyncio.run(run_tests())
