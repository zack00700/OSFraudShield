from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid
import enum

Base = declarative_base()

def gen_id():
    return str(uuid.uuid4())

class PlanType(str, enum.Enum):
    starter = "starter"
    growth = "growth"
    scale = "scale"
    enterprise = "enterprise"

class Client(Base):
    """Compte client principal."""
    __tablename__ = "clients"

    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    full_name = Column(String, nullable=True)

    # Plan & quotas
    plan = Column(String, default="starter")
    monthly_quota = Column(Integer, default=10000)   # transactions/mois
    monthly_calls = Column(Integer, default=0)        # utilisées ce mois

    # Stripe
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    email_verify_token = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)


class APIKey(Base):
    """Clés API des clients."""
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    key_hash = Column(String, unique=True, nullable=False)
    label = Column(String, default="Ma clé")
    environment = Column(String, default="production")  # production | test
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Transaction(Base):
    """Chaque transaction analysée."""
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    api_key_id = Column(String, nullable=True)

    # Données de la transaction
    transaction_id = Column(String, nullable=False)   # ID côté client
    user_id = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    ip_address = Column(String, nullable=True)
    country = Column(String, nullable=True)
    payment_method = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # Résultat analyse
    fraud_score = Column(Float, nullable=False)
    decision = Column(String, nullable=False)         # allow | review | block
    risk_level = Column(String, nullable=False)       # low | medium | high | critical
    triggered_rules = Column(Text, default="")
    processing_ms = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    """Alertes fraude actives."""
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    transaction_id = Column(String, nullable=False)
    risk_level = Column(String, nullable=False)
    triggered_rules = Column(Text, default="")
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FraudRule(Base):
    """Règles de détection configurables par client."""
    __tablename__ = "fraud_rules"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    rule_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    weight = Column(Float, default=1.0)              # multiplicateur du score
    custom_config = Column(Text, nullable=True)      # JSON config custom
    created_at = Column(DateTime, default=datetime.utcnow)


class RefreshToken(Base):
    """Refresh tokens pour renouveler les JWT."""
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False)
    is_revoked = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
