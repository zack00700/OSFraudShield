from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from models import Client, Transaction, Alert
from core.security import get_client_by_api_key, get_current_client
from fraud_engine import FraudEngine

router = APIRouter(prefix="/v1", tags=["Fraud Analysis"])
engine = FraudEngine()

# ── Schemas ───────────────────────────────────────────────────────────────────

class TransactionInput(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    currency: str = "USD"
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    country: Optional[str] = None
    payment_method: str = "card"
    card_last4: Optional[str] = None
    email: Optional[str] = None
    metadata: Optional[dict] = {}

class TransactionResponse(BaseModel):
    transaction_id: str
    fraud_score: float
    decision: str
    risk_level: str
    triggered_rules: list[str]
    recommendation: str
    processing_time_ms: float
    timestamp: str

# ── Analyze ───────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=TransactionResponse)
async def analyze_transaction(
    payload: TransactionInput,
    x_api_key: str = Header(...),
    db: Session = Depends(get_db)
):
    """
    Analyse une transaction en temps réel.
    Authentification par clé API (header x-api-key).
    """
    start = datetime.utcnow()

    # Auth par clé API
    client, api_key = get_client_by_api_key(x_api_key, db)

    # Analyser avec le moteur fraude
    result = engine.analyze(payload.dict())

    processing_ms = (datetime.utcnow() - start).microseconds / 1000

    # Incrémenter compteur mensuel
    client.monthly_calls += 1

    # Sauvegarder la transaction
    tx = Transaction(
        id=str(uuid.uuid4()),
        client_id=client.id,
        api_key_id=api_key.id,
        transaction_id=payload.transaction_id,
        user_id=payload.user_id,
        amount=payload.amount,
        currency=payload.currency,
        ip_address=payload.ip_address,
        country=payload.country,
        payment_method=payload.payment_method,
        email=payload.email,
        fraud_score=result["fraud_score"],
        decision=result["decision"],
        risk_level=result["risk_level"],
        triggered_rules=",".join(result["triggered_rules"]),
        processing_ms=processing_ms
    )
    db.add(tx)

    # Créer une alerte si suspect
    if result["decision"] in ("review", "block"):
        alert = Alert(
            id=str(uuid.uuid4()),
            client_id=client.id,
            transaction_id=payload.transaction_id,
            risk_level=result["risk_level"],
            triggered_rules=",".join(result["triggered_rules"]),
        )
        db.add(alert)

    db.commit()

    return TransactionResponse(
        transaction_id=payload.transaction_id,
        fraud_score=result["fraud_score"],
        decision=result["decision"],
        risk_level=result["risk_level"],
        triggered_rules=result["triggered_rules"],
        recommendation=result["recommendation"],
        processing_time_ms=processing_ms,
        timestamp=datetime.utcnow().isoformat()
    )

# ── Stats (dashboard) ─────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    """Stats du compte — accessible via JWT (dashboard)."""
    txs = db.query(Transaction).filter(Transaction.client_id == client.id).all()
    total = len(txs)
    blocked = sum(1 for t in txs if t.decision == "block")
    reviewed = sum(1 for t in txs if t.decision == "review")
    allowed = sum(1 for t in txs if t.decision == "allow")
    total_amount = sum(t.amount for t in txs if t.decision == "block")
    avg_score = sum(t.fraud_score for t in txs) / total if total else 0

    # Transactions des 7 derniers jours par jour
    from datetime import timedelta
    from collections import defaultdict
    last7 = datetime.utcnow() - timedelta(days=7)
    daily = defaultdict(lambda: {"allow": 0, "review": 0, "block": 0})
    for t in txs:
        if t.created_at >= last7:
            day = t.created_at.strftime("%a")
            daily[day][t.decision] += 1

    return {
        "total": total,
        "blocked": blocked,
        "reviewed": reviewed,
        "allowed": allowed,
        "block_rate": round(blocked / total * 100, 2) if total else 0,
        "avg_fraud_score": round(avg_score, 4),
        "amount_protected": round(total_amount, 2),
        "monthly_calls": client.monthly_calls,
        "monthly_quota": client.monthly_quota,
        "daily_chart": dict(daily),
    }

# ── Transactions list ─────────────────────────────────────────────────────────

@router.get("/transactions")
async def get_transactions(
    limit: int = 50,
    decision: Optional[str] = None,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.client_id == client.id)
    if decision:
        query = query.filter(Transaction.decision == decision)
    txs = query.order_by(Transaction.created_at.desc()).limit(limit).all()

    return {"transactions": [
        {
            "id": t.id,
            "transaction_id": t.transaction_id,
            "user_id": t.user_id,
            "amount": t.amount,
            "currency": t.currency,
            "country": t.country,
            "fraud_score": t.fraud_score,
            "decision": t.decision,
            "risk_level": t.risk_level,
            "triggered_rules": t.triggered_rules.split(",") if t.triggered_rules else [],
            "created_at": t.created_at.isoformat(),
        }
        for t in txs
    ]}

# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts(
    limit: int = 50,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    alerts = db.query(Alert)\
        .filter(Alert.client_id == client.id, Alert.is_resolved == False)\
        .order_by(Alert.created_at.desc()).limit(limit).all()

    return {"alerts": [
        {
            "id": a.id,
            "transaction_id": a.transaction_id,
            "risk_level": a.risk_level,
            "triggered_rules": a.triggered_rules.split(",") if a.triggered_rules else [],
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]}

@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(
        Alert.id == alert_id,
        Alert.client_id == client.id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    alert.is_resolved = True
    alert.resolved_by = client.email
    alert.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Alerte résolue"}
