from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import uuid, secrets

from database import get_db
from models import Client
from scalp_models import ScalpCheck, QueueEntry, EventConfig
from scalp_engine import AntiScalpEngine
from core.security import get_client_by_api_key, get_current_client

router = APIRouter(prefix="/v1/scalp", tags=["Anti-Scalping"])
engine = AntiScalpEngine()

# ── Schemas ───────────────────────────────────────────────────────────────────

class ScalpCheckInput(BaseModel):
    user_id: str
    event_id: str
    quantity: int = 1

    # Données navigateur (envoyées depuis le front du client)
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    card_fingerprint: Optional[str] = None      # hash de la CB, jamais le numéro
    screen_resolution: Optional[str] = None
    time_on_page_seconds: Optional[float] = 30.0
    mouse_movement_score: Optional[float] = 1.0  # 0=bot, 1=humain
    webdriver: Optional[bool] = False
    headers: Optional[Dict[str, str]] = {}

class QueueJoinInput(BaseModel):
    user_id: str
    event_id: str
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None

class EventConfigInput(BaseModel):
    event_id: str
    event_name: Optional[str] = None
    max_tickets_per_user: int = 2
    max_tickets_per_device: int = 2
    queue_enabled: bool = False
    queue_capacity: int = 1000
    queue_window_minutes: int = 10

# ── Check anti-scalping ───────────────────────────────────────────────────────

@router.post("/check")
async def scalp_check(
    data: ScalpCheckInput,
    x_api_key: str = Header(...),
    db: Session = Depends(get_db)
):
    """
    Vérifie si un achat de billet est légitime.
    À appeler AVANT de permettre l'achat.

    Retourne : allow | challenge | block
    """
    client, api_key = get_client_by_api_key(x_api_key, db)

    # Récupérer la config de l'event si elle existe
    event_config = db.query(EventConfig).filter(
        EventConfig.client_id == client.id,
        EventConfig.event_id == data.event_id
    ).first()

    payload = data.dict()
    if event_config:
        payload["max_tickets_per_user"] = event_config.max_tickets_per_user
        payload["max_tickets_per_device"] = event_config.max_tickets_per_device

    result = engine.analyze(payload)

    # Sauvegarder le log
    db.add(ScalpCheck(
        id=str(uuid.uuid4()),
        client_id=client.id,
        user_id=data.user_id,
        event_id=data.event_id,
        quantity=data.quantity,
        risk_score=result["risk_score"],
        decision=result["decision"],
        triggered_rules=",".join(result["triggered_rules"]),
        ip_address=data.ip_address,
        is_bot=result["is_bot"],
        is_vpn=result["is_vpn"],
    ))
    db.commit()

    return {
        "user_id": data.user_id,
        "event_id": data.event_id,
        "risk_score": result["risk_score"],
        "decision": result["decision"],
        "triggered_rules": result["triggered_rules"],
        "recommendation": result["recommendation"],
        "tickets_this_event": result["user_tickets_this_event"],
        "is_bot": result["is_bot"],
        "is_vpn": result["is_vpn"],
    }

# ── File d'attente ────────────────────────────────────────────────────────────

@router.post("/queue/join")
async def queue_join(
    data: QueueJoinInput,
    x_api_key: str = Header(...),
    db: Session = Depends(get_db)
):
    """
    Ajoute un utilisateur à la file d'attente pour un événement.
    Retourne sa position et un token de session.
    """
    client, api_key = get_client_by_api_key(x_api_key, db)

    # Vérifier si déjà dans la file
    existing = db.query(QueueEntry).filter(
        QueueEntry.client_id == client.id,
        QueueEntry.event_id == data.event_id,
        QueueEntry.user_id == data.user_id,
        QueueEntry.status == "waiting"
    ).first()

    if existing:
        # Retourner sa position actuelle
        position = db.query(QueueEntry).filter(
            QueueEntry.client_id == client.id,
            QueueEntry.event_id == data.event_id,
            QueueEntry.status == "waiting",
            QueueEntry.joined_at < existing.joined_at
        ).count() + 1

        return {
            "session_token": existing.session_token,
            "position": position,
            "status": "waiting",
            "message": f"Vous êtes déjà en file — position {position}"
        }

    # Calculer position
    position = db.query(QueueEntry).filter(
        QueueEntry.client_id == client.id,
        QueueEntry.event_id == data.event_id,
        QueueEntry.status.in_(["waiting", "active"])
    ).count() + 1

    # Score de priorité — pénalise les IPs suspectes
    priority = 1.0
    if engine._is_datacenter_ip(data.ip_address or ""):
        priority = 0.1   # VPN → relégué en fin de file

    session_token = secrets.token_urlsafe(32)

    entry = QueueEntry(
        id=str(uuid.uuid4()),
        client_id=client.id,
        event_id=data.event_id,
        user_id=data.user_id,
        session_token=session_token,
        position=position,
        priority_score=priority,
        ip_address=data.ip_address,
    )
    db.add(entry)
    db.commit()

    estimated_wait = max(0, (position - 1) * 2)  # ~2 min par personne devant

    return {
        "session_token": session_token,
        "position": position,
        "status": "waiting",
        "estimated_wait_minutes": estimated_wait,
        "message": f"Vous êtes en position {position} — attente estimée : {estimated_wait} minutes"
    }

@router.get("/queue/status/{session_token}")
async def queue_status(
    session_token: str,
    x_api_key: str = Header(...),
    db: Session = Depends(get_db)
):
    """Vérifie la position actuelle dans la file."""
    client, api_key = get_client_by_api_key(x_api_key, db)

    entry = db.query(QueueEntry).filter(
        QueueEntry.session_token == session_token,
        QueueEntry.client_id == client.id
    ).first()

    if not entry:
        raise HTTPException(status_code=404, detail="Session introuvable")

    if entry.status == "expired":
        return {"status": "expired", "message": "Votre session a expiré — rejoignez la file"}

    if entry.status == "active":
        time_left = 0
        if entry.expires_at:
            time_left = max(0, int((entry.expires_at - datetime.utcnow()).total_seconds() / 60))
        return {
            "status": "active",
            "message": "C'est votre tour ! Vous pouvez acheter.",
            "minutes_to_purchase": time_left
        }

    # Recalculer position actuelle
    position = db.query(QueueEntry).filter(
        QueueEntry.client_id == client.id,
        QueueEntry.event_id == entry.event_id,
        QueueEntry.status == "waiting",
        QueueEntry.joined_at < entry.joined_at
    ).count() + 1

    estimated_wait = max(0, (position - 1) * 2)

    return {
        "status": "waiting",
        "position": position,
        "estimated_wait_minutes": estimated_wait,
        "message": f"Position {position} — {estimated_wait} minutes environ"
    }

# ── Configuration événement ───────────────────────────────────────────────────

@router.post("/events/config")
async def configure_event(
    data: EventConfigInput,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    """Configure les règles anti-scalping pour un événement spécifique."""
    existing = db.query(EventConfig).filter(
        EventConfig.client_id == client.id,
        EventConfig.event_id == data.event_id
    ).first()

    if existing:
        existing.event_name = data.event_name
        existing.max_tickets_per_user = data.max_tickets_per_user
        existing.max_tickets_per_device = data.max_tickets_per_device
        existing.queue_enabled = data.queue_enabled
        existing.queue_capacity = data.queue_capacity
        existing.queue_window_minutes = data.queue_window_minutes
    else:
        db.add(EventConfig(
            id=str(uuid.uuid4()),
            client_id=client.id,
            **data.dict()
        ))
    db.commit()

    return {
        "event_id": data.event_id,
        "message": "Configuration enregistrée",
        "config": data.dict()
    }

@router.get("/events")
async def list_events(
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    """Liste tous les événements configurés."""
    events = db.query(EventConfig).filter(
        EventConfig.client_id == client.id
    ).all()
    return {"events": [
        {
            "event_id": e.event_id,
            "event_name": e.event_name,
            "max_tickets_per_user": e.max_tickets_per_user,
            "queue_enabled": e.queue_enabled,
            "created_at": e.created_at.isoformat()
        }
        for e in events
    ]}

# ── Stats anti-scalping ───────────────────────────────────────────────────────

@router.get("/stats")
async def scalp_stats(
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    """Statistiques des tentatives de scalping."""
    checks = db.query(ScalpCheck).filter(
        ScalpCheck.client_id == client.id
    ).all()

    total = len(checks)
    blocked = sum(1 for c in checks if c.decision == "block")
    challenged = sum(1 for c in checks if c.decision == "challenge")
    allowed = sum(1 for c in checks if c.decision == "allow")
    bots = sum(1 for c in checks if c.is_bot)
    vpns = sum(1 for c in checks if c.is_vpn)

    return {
        "total_checks": total,
        "blocked": blocked,
        "challenged": challenged,
        "allowed": allowed,
        "bots_detected": bots,
        "vpns_detected": vpns,
        "block_rate": round(blocked / total * 100, 1) if total else 0,
    }
