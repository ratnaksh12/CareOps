import sys
import os
sys.path.insert(0, ".")

from sqlalchemy import inspect
from app.models import BookingTypeInventory, Base
from app.database import engine

def main():
    print("Inspecting BookingTypeInventory...")
    try:
        mapper = inspect(BookingTypeInventory)
        print(f"Mapper found for {mapper.class_.__name__}")
        print(f"Primary Keys: {[c.key for c in mapper.primary_key]}")
        print(f"Columns: {[c.key for c in mapper.columns]}")
    except Exception as e:
        print(f"Inspection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
