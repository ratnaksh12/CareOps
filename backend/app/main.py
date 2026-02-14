from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import engine, Base

# Import all models so they are registered with Base
from app.models import *  # noqa

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev only)
    print(f"DEBUG: Creating tables. Registered models: {list(Base.metadata.tables.keys())}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("DEBUG: Tables created.")
    
    # Start Email Poller
    from app.services.email_poller import email_poller
    import asyncio
    poller_task = asyncio.create_task(email_poller.start())
    
    yield
    
    # Validation/Shutdown
    email_poller.running = False
    await poller_task


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

# CORS
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
