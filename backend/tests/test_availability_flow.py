import requests
import sys
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_test():
    print("🔐 Authentication...")
    # Login as Admin (who has a workspace)
    auth_data = {"email": "admin@careops.com", "password": "test1234"}
    
    # Try Login
    r = requests.post(f"{BASE_URL}/auth/login", json=auth_data)
    if r.status_code == 200:
        print("   ✅ Login Successful!")
    else:
        print(f"   ❌ Login Failed: {r.status_code} {r.text}")
        return
        # Login again
        r = requests.post(f"{BASE_URL}/auth/login", json=auth_data)
    
    if r.status_code != 200:
        print(f"❌ Login Failed: {r.text}")
        return

    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get Workspace ID
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    user_data = r.json()
    workspace_id = user_data.get("workspace_id")
    print(f"✅ Logged in. Workspace: {workspace_id}")

    if not workspace_id:
        print("   Creating Workspace...")
        r = requests.post(f"{BASE_URL}/workspaces", json={"name": "Test Workspace"}, headers=headers)
        if r.status_code != 200:
            print(f"❌ Create Workspace Failed: {r.text}")
            return
        workspace_id = r.json()["id"]
        # Refresh token/user might be needed if workspace_id is in token, but here we just need ID for URL
        print(f"✅ Workspace Created: {workspace_id}")

    # 1. Set Availability
    print("🕒 Setting Business Hours (Mon 09:00-17:00)...")
    slots = [
        {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "is_active": True},
        {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "is_active": False}, # Tuesday Closed
    ]
    # Fill rest as closed
    for i in range(2, 7):
        slots.append({"day_of_week": i, "start_time": "09:00", "end_time": "17:00", "is_active": False})

    r = requests.post(f"{BASE_URL}/availability", json={"slots": slots}, headers=headers)
    if r.status_code != 200:
        print(f"❌ Set Availability Failed: {r.text}")
        return
    print("✅ Availability Set.")

    # 2. Check Public Availability
    print("🌍 Checking Public Availability...")
    today_str = datetime.now().strftime("%Y-%m-%d")
    r = requests.get(f"{BASE_URL}/availability/public/{workspace_id}?date={today_str}")
    avail = [] # Initialize avail to an empty list in case of error
    try:
        avail = r.json()
        print(f"✅ Public Availability Fetched: {len(avail)} slots")
    except Exception as e:
        print(f"❌ Public Availability Fetch Failed: {r.status_code} {r.text[:200]}")
        # Proceed anyway to test booking
    
    active_days = [a["day_of_week"] for a in avail]
    if 0 in active_days and 1 not in active_days:
        print("✅ Public Availability looks correct (Mon open, Tue closed).")
    else:
        print(f"⚠️ Public Availability Check Failed/Mismatch: {active_days}")
        # Proceed to booking anyway to verify if core booking works
        pass# If avail was empty due to error, this check will fail, but we proceed as per instruction
        # If the API returns an empty list for a valid reason, this check might also fail.
        # For now, we'll let it print the mismatch and continue.

    # 3. Create Booking Type
    print("📅 Creating Booking Type...")
    # Check if exists first to avoid dupes?
    r = requests.get(f"{BASE_URL}/bookings/types", headers=headers)
    types = r.json()
    bt = next((t for t in types if t["name"] == "Avail Test Service Sync"), None)
    
    if not bt:
        bt_data = {
            "name": "Avail Test Service Sync",
            "duration_minutes": 60,
            "description": "Test Sync",
            "location": "Office",
            "is_active": True
        }
        r = requests.post(f"{BASE_URL}/bookings/types", json=bt_data, headers=headers)
        if r.status_code != 200:
            print(f"❌ Create Booking Type Failed: {r.text}")
            return
        bt = r.json()
    
    bt_id = bt["id"]
    print(f"✅ Booking Type Ready: {bt_id}")

    # 4. Attempt Booking - Valid Time (Next Monday at 10:00)
    print("✅ Attempting Valid Booking (Next Monday 10:00)...")
    today = datetime.utcnow()
    days_until_mon = (0 - today.weekday() + 7) % 7
    if days_until_mon == 0: days_until_mon = 7
    next_mon = today + timedelta(days=days_until_mon)
    valid_time = next_mon.replace(hour=10, minute=0, second=0, microsecond=0)
    
    payload = {
        "booking_type_id": bt_id,
        "start_time": valid_time.isoformat(),
        "name": "Valid User Sync",
        "email": "valid_sync@test.com"
    }
    r = requests.post(f"{BASE_URL}/public/bookings", json=payload)
    if r.status_code == 200:
        print("✅ Booking Succeeded.")
    else:
        print(f"❌ Booking Failed Unexpectedly: {r.text}")
        return

    # 5. Attempt Booking - Invalid Time (Next Monday at 20:00 - outside hours)
    print("⛔ Attempting Booking Outside Hours (Next Monday 20:00)...")
    invalid_time = next_mon.replace(hour=20, minute=0, second=0, microsecond=0)
    payload["start_time"] = invalid_time.isoformat()
    
    r = requests.post(f"{BASE_URL}/public/bookings", json=payload)
    if r.status_code == 400 and "outside business hours" in r.text.lower():
        print("✅ Booking correctly rejected (Outside Hours).")
    else:
        print(f"❌ Failed to reject booking: code={r.status_code} msg={r.text}")

    # 6. Attempt Booking - Closed Day (Next Tuesday)
    print("⛔ Attempting Booking on Closed Day (Next Tuesday)...")
    next_tue = next_mon + timedelta(days=1)
    payload["start_time"] = next_tue.replace(hour=10, minute=0).isoformat()
    
    r = requests.post(f"{BASE_URL}/public/bookings", json=payload)
    if r.status_code == 400 and "closed" in r.text.lower():
        print("✅ Booking correctly rejected (Closed Day).")
    else:
        print(f"❌ Failed to reject booking: code={r.status_code} msg={r.text}")

    print("\n🎉 Availability Flow Verification Complete!")

if __name__ == "__main__":
    run_test()
