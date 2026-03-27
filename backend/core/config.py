from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App
    APP_NAME: str = "FraudShield API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost/fraudshield"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = None
    FROM_EMAIL: str = "noreply@fraudshield.io"

    # Fraud thresholds
    FRAUD_THRESHOLD_BLOCK: float = 0.80
    FRAUD_THRESHOLD_REVIEW: float = 0.55

    class Config:
        env_file = ".env"

settings = Settings()
