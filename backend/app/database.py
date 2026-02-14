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
    import socket
    from urllib.parse import urlparse, urlunparse

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
    
    # FORCE IPv4 Resolution (Render/Supabase Fix)
    db_url = settings.DATABASE_URL
    try:
        parsed = urlparse(db_url)
        hostname = parsed.hostname
        if hostname and "supabase" in hostname:
            # Resolve to IPv4 (AF_INET)
            # getaddrinfo returns list of (family, type, proto, canonname, sockaddr)
            # sockaddr is (address, port) for AF_INET
            ipv4 = socket.getaddrinfo(hostname, None, socket.AF_INET)[0][4][0]
            print(f"DEBUG: Force-resolved {hostname} to IPv4: {ipv4}")
            
            # Reconstruct URL with IP
            new_netloc = parsed.netloc.replace(hostname, f"[{ipv4}]" if ":" in ipv4 else ipv4) # Handle potential IPv6 string just in case, though we asked for v4
            # A simpler string replace might be risky if user/pass has hostname, but unlikely for postgres URLs.
            # Let's reconstruct explicitly for safety
            port = parsed.port
            username = parsed.username
            password = parsed.password
            
            netloc_str = ""
            if username:
                netloc_str += f"{username}"
                if password:
                    netloc_str += f":{password}"
                netloc_str += "@"
            
            netloc_str += f"{ipv4}"
            if port:
                netloc_str += f":{port}"
                
            db_url = urlunparse((
                parsed.scheme,
                netloc_str,
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
    except Exception as e:
        print(f"WARNING: Failed to force IPv4 resolution: {e}")

engine = create_async_engine(db_url, **engine_kwargs)

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
