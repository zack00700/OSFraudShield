from datetime import datetime, timedelta
from typing import Optional
import secrets
import hashlib
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from core.config import settings
from database import get_db
from models import Client, APIKey

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT Tokens ────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(client_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    data = {"sub": client_id, "exp": expire, "type": "refresh"}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")

# ── API Keys ──────────────────────────────────────────────────────────────────

def generate_api_key() -> tuple[str, str]:
    """Génère une clé API et retourne (clé_raw, hash)"""
    raw = "fs_" + secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed

# ── Auth Dependencies ─────────────────────────────────────────────────────────

def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> Client:
    """Vérifie le JWT Bearer token et retourne le client."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Token manquant")

    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Type de token invalide")

    client_id = payload.get("sub")
    client = db.query(Client).filter(Client.id == client_id, Client.is_active == True).first()

    if not client:
        raise HTTPException(status_code=401, detail="Compte introuvable ou désactivé")

    return client

def get_client_by_api_key(
    x_api_key: str,
    db: Session
) -> tuple[Client, APIKey]:
    """Vérifie une clé API et retourne (client, api_key)."""
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    api_key = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
        APIKey.is_active == True
    ).first()

    if not api_key:
        raise HTTPException(status_code=401, detail="Clé API invalide ou révoquée")

    client = db.query(Client).filter(
        Client.id == api_key.client_id,
        Client.is_active == True
    ).first()

    if not client:
        raise HTTPException(status_code=401, detail="Compte associé introuvable")

    # Vérifier quota mensuel
    if client.monthly_calls >= client.monthly_quota:
        raise HTTPException(status_code=402, detail="Quota mensuel atteint. Upgradez votre plan.")

    # Mettre à jour last_used
    from datetime import datetime
    api_key.last_used_at = datetime.utcnow()
    db.commit()

    return client, api_key
