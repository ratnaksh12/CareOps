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
    engine_kwargs["connect_args"] = {
        "ssl": ssl_context,
        "prepared_statement_cache_size": 0  # Disable prepared statements for pgbouncer/pooler compatibility
    }
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

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
