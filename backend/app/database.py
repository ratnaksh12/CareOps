from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool
from app.config import get_settings

settings = get_settings()

engine_kwargs: dict = {"echo": False}
if "sqlite" in settings.DATABASE_URL:
    # SQLite-specific config for local development
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL config for production (Supabase)
    import ssl

    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    # CRITICAL: We MUST explicitly set statement_cache_size to 0 for Supabase Transaction Mode
    # Use the specific key 'statement_cache_size' inside connect_args for asyncpg
    engine_kwargs["connect_args"] = {
        "ssl": ssl_context,
        "statement_cache_size": 0,    # For asyncpg
        "prepared_statement_cache_size": 0 # Redundant but safe
    }
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

# Capture initialization error for debug endpoint
db_init_error = None

try:
    engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
except Exception as e:
    import traceback
    print(f"CRITICAL: Failed to create DB engine with URL: {settings.DATABASE_URL}. Error: {e}")
    traceback.print_exc()
    db_init_error = f"Engine creation failed: {str(e)}"
    # Fallback to local SQLite so app can boot and show debug info
    engine = create_async_engine("sqlite+aiosqlite:///./recovery.db", echo=True)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session = async_session()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
