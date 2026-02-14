"""Minimal diagnostic: verify table creation works end-to-end."""
import asyncio
import sys
sys.path.insert(0, ".")

async def diagnose():
    # Step 1: Import everything
    from app.database import engine, Base
    import app.models  # registers all models with Base.metadata
    
    tables = sorted(Base.metadata.tables.keys())
    print(f"[1] Registered tables ({len(tables)}):")
    for t in tables:
        print(f"    - {t}")
    
    has_link_table = "booking_type_inventory_links" in tables
    print(f"\n[2] booking_type_inventory_links in metadata: {has_link_table}")
    
    # Step 2: Create all tables
    print("\n[3] Running create_all...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("    Done.")
    
    # Step 3: Check what tables SQLite actually has
    from sqlalchemy import text
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"))
        sqlite_tables = [row[0] for row in result.fetchall()]
    
    print(f"\n[4] Actual SQLite tables ({len(sqlite_tables)}):")
    for t in sqlite_tables:
        print(f"    - {t}")
    
    has_link_in_db = "booking_type_inventory_links" in sqlite_tables
    print(f"\n[5] booking_type_inventory_links EXISTS in DB: {has_link_in_db}")
    
    if has_link_in_db:
        print("\n=== SUCCESS: Table exists. The issue is elsewhere. ===")
    else:
        print("\n=== FAILURE: Table NOT created despite being in metadata! ===")
        # Check the engine URL
        print(f"    Engine URL: {engine.url}")

if __name__ == "__main__":
    # Delete old DB first
    import os
    if os.path.exists("careops.db"):
        os.remove("careops.db")
        print("[0] Deleted old careops.db")
    asyncio.run(diagnose())
