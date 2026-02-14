from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import field_validator
import json
from typing import Any


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CareOps API"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./careops.db"

    # Auth
    SECRET_KEY: str = "careops-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
        "http://0.0.0.0:3000",
        "https://ratnaksh12.github.io",
        "https://ratnaksh12.github.io/CareOps"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        origins = []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    origins = parsed
                else:
                    origins = [str(parsed)]
            except (json.JSONDecodeError, TypeError):
                origins = [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = v
        
        # Force production and local origins
        # Important: CORS origins MUST NOT have subpaths like /CareOps
        required = [
            "https://ratnaksh12.github.io",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://0.0.0.0:3000"
        ]
        for r in required:
            if r not in origins:
                origins.append(r)
        
        # Clean origins (remove trailing slashes)
        return list(set(orig.rstrip("/") for orig in origins if orig))

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "onboarding@resend.dev"

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Google Calendar
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
