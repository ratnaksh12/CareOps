# CareOps — Full System Testing Protocol

Follow these steps exactly to verify every module in the CareOps platform.

## 🚀 Step 0: Ensure Services are Running
Open two terminal windows:
1.  **Backend**: `cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
2.  **Frontend**: `cd frontend && npm run dev`

Access the app at: **http://localhost:3000**

---

## 🔐 Phase 1: Authentication & Onboarding
1.  Go to `http://localhost:3000/register`.
2.  Create a new account (e.g., `tester@careops.com`).
3.  You will be redirected to the **6-Step Onboarding**:
    - **Step 1: Identity**: Enter business name.
    - **Step 2: Communication**: Connect Email/SMS (Click "Simulate" or enter test credentials).
    - **Step 3: Lead Capture**: Setup your first contact form.
    - **Step 4: Availability**: Set your business hours (e.g., Mon-Fri 09:00-17:00).
    - **Step 5: Clinical Intake**: Setup the post-booking form.
    - **Step 6: Inventory**: Add 2-3 items (e.g., Gloves, Syringes) with low-stock thresholds.
4.  Finish onboarding and land on the **Dashboard**.

---

## 🌍 Phase 2: Public Patient Experience
1.  **Lead Capture**:
    - Open `http://localhost:3000/public/lead` (or navigate from landing).
    - Fill out the form as a "Patient".
    - **Verify**: You should see a "Success" message.
2.  **Booking**:
    - Open `http://localhost:3000/public/book`.
    - Select a time slot and fill in details.
    - **Verify**: You should receive a confirmation (simulated in terminal logs).

---

## 📊 Phase 3: Admin Management
1.  **Inbox**: Go to `/inbox`.
    - **Verify**: You should see the message from the "Patient" lead. Try replying.
2.  **Leads (Ledger)**: Go to `/ledger`.
    - **Verify**: The new contact should be listed with a "Lead" status.
3.  **Bookings**: Go to `/bookings`.
    - **Verify**: The appointment should appear on the list and calendar.
4.  **Inventory**: Go to `/inventory`.
    - **Verify**: Stock levels should have automatically deducted if the booking type was linked to items.
5.  **Dashboard/Alerts**: Go to `/dashboard`.
    - **Verify**: You should see alerts for **"New Lead"** and **"New Booking"**.

---

## 👥 Phase 4: Staff & Permissions
1.  Go to `/staff`.
2.  Invite a new "Staff" member.
3.  Logout and Login as the staff member.
4.  **Verify**: Access should be restricted based on the permissions you set (e.g., Staff cannot manage other staff or sensitive settings).

---

## 🤖 Phase 5: Automation (The "Brain")
1.  Wait 24 hours (or check your seeded data logs).
2.  **Verify**: If a message stays unreplied for 24h, an **Alert** appears on the dashboard.
3.  **Verify**: If a form is pending for >2 days, a **Reminder Alert** appears on the dashboard.
