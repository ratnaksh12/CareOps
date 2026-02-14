from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import engine, Base

# Import all models so they are registered with Base
from app.models import *  # noqa

import logging
import traceback
import sys

logger = logging.getLogger("app")

try:
    settings = get_settings()
except Exception as e:
    print("CRITICAL: Failed to load settings!")
    traceback.print_exc()
    sys.exit(1)




@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev only)
    try:
        print(f"DEBUG: Attempting to connect to database. URL: {settings.DATABASE_URL.split('@')[-1]}") # Log only host part
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("DEBUG: Tables created/verified successfully.")
        
        # Run Seed Data
        try:
            # Import inside function to avoid circular imports during startup
            from seed_data import seed
            await seed()
            print("DEBUG: Seed data checked/applied.")
        except Exception as seed_err:
            print(f"WARNING: Seed logic failed: {seed_err}")
            traceback.print_exc()

    except Exception as e:
        print("WARNING: Could not connect to database or create tables.")
        print(f"Error detail: {e}")
        traceback.print_exc()
    
    # Start Email Poller
    try:
        from app.services.email_poller import email_poller
        import asyncio
        poller_task = asyncio.create_task(email_poller.start())
    except Exception as e:
        print(f"ERROR: Failed to start email poller: {e}")
        poller_task = None
    
    yield
    
    # Validation/Shutdown
    if poller_task:
        email_poller.running = False
        await poller_task


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"GLOBAL ERROR: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )

# CORS
print(f"DEBUG: Setting up CORS with origins: {settings.CORS_ORIGINS}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
from app.api.v1.auth import router as auth_router
from app.api.v1.workspaces import router as workspaces_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.forms import router as forms_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.public_bookings import router as public_bookings_router
from app.api.v1.public_contacts import router as public_contacts_router
from app.api.v1.staff import router as staff_router
from app.api.v1.availability import router as availability_router
from app.api.v1.gcalendar import router as gcalendar_router

app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(workspaces_router, prefix=settings.API_V1_PREFIX)
app.include_router(contacts_router, prefix=settings.API_V1_PREFIX)
app.include_router(conversations_router, prefix=settings.API_V1_PREFIX)
app.include_router(bookings_router, prefix=settings.API_V1_PREFIX)
app.include_router(forms_router, prefix=settings.API_V1_PREFIX)
app.include_router(inventory_router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_V1_PREFIX)
app.include_router(public_bookings_router, prefix=settings.API_V1_PREFIX)
app.include_router(public_contacts_router, prefix=settings.API_V1_PREFIX)
app.include_router(staff_router, prefix=settings.API_V1_PREFIX)
app.include_router(availability_router, prefix=settings.API_V1_PREFIX)
app.include_router(gcalendar_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}

@app.get("/debug-db")
async def debug_db():
    import socket
    import traceback
    from sqlalchemy import text
    
    debug_info = {}
    host = settings.DATABASE_URL.split("@")[-1].split(":")[0]
    
    try:
        debug_info["dns_resolution"] = socket.getaddrinfo(host, None)
    except Exception as e:
        debug_info["dns_error"] = str(e)

    try:
        print("DEBUG: Testing DB connection...")
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return {
                "status": "connected", 
                "result": result.scalar(), 
                "db_url_host": host,
                "debug_info": debug_info
            }
    except Exception as e:
        return {
            "status": "error", 
            "error": str(e),
            "traceback": traceback.format_exc(),
            "debug_info": debug_info
        }
