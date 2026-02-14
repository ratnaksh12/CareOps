import asyncio
from sqlalchemy import text
from app.database import engine

async def fix_schema():
    async with engine.begin() as conn:
        print("Checking schema...")
        try:
            # Check if column exists
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='booking_types' AND column_name='intake_form_id'"
            ))
            if result.fetchone():
                print("Column 'intake_form_id' already exists.")
            else:
                print("Column 'intake_form_id' missing. Adding it...")
                await conn.execute(text(
                    "ALTER TABLE booking_types ADD COLUMN intake_form_id VARCHAR(36) REFERENCES forms(id)"
                ))
                print("Column added successfully.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_schema())
