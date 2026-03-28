"""
Modèles pour le module anti-scalping et la file d'attente intelligente.
"""
from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, Text
from datetime import datetime
import uuid

def gen_id(): return str(uuid.uuid4())

# Import de Base depuis models.py existant
from models import Base


class ScalpCheck(Base):
    """Log de chaque vérification anti-scalping."""
    __tablename__ = "scalp_checks"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    event_id = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    risk_score = Column(Float, nullable=False)
    decision = Column(String, nullable=False)      # allow | challenge | block
    triggered_rules = Column(Text, default="")
    ip_address = Column(String, nullable=True)
    is_bot = Column(Boolean, default=False)
    is_vpn = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class QueueEntry(Base):
    """File d'attente intelligente pour les ventes de billets."""
    __tablename__ = "queue_entries"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    session_token = Column(String, unique=True, nullable=False)  # token unique
    position = Column(Integer, nullable=False)
    status = Column(String, default="waiting")   # waiting | active | expired | completed
    priority_score = Column(Float, default=1.0)  # score humain (plus haut = priorité)
    ip_address = Column(String, nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)


class EventConfig(Base):
    """Configuration anti-scalping par événement."""
    __tablename__ = "event_configs"

    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, nullable=False, index=True)
    event_id = Column(String, unique=True, nullable=False)
    event_name = Column(String, nullable=True)
    max_tickets_per_user = Column(Integer, default=2)
    max_tickets_per_device = Column(Integer, default=2)
    queue_enabled = Column(Boolean, default=False)
    queue_capacity = Column(Integer, default=1000)  # nb actifs en même temps
    queue_window_minutes = Column(Integer, default=10)  # temps pour acheter
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
