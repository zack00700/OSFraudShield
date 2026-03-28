from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid, hashlib

from database import get_db
from models import Client, APIKey, RefreshToken
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    generate_api_key, get_current_client
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    company_name: str
    full_name: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class RefreshInput(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    client: dict

# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterInput, db: Session = Depends(get_db)):
    # Vérifier email unique
    existing = db.query(Client).filter(Client.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")

    # Valider mot de passe
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères")
    if len(data.password) > 72:
        raise HTTPException(status_code=400, detail="Le mot de passe ne doit pas dépasser 72 caractères")

    # Créer le client
    client = Client(
        id=str(uuid.uuid4()),
        email=data.email,
        password_hash=hash_password(data.password),
        company_name=data.company_name,
        full_name=data.full_name,
        plan="starter",
        monthly_quota=10000,
        is_active=True,
        is_verified=True,  # En prod → envoyer email de confirmation
    )
    db.add(client)

    # Créer clé API de production automatiquement
    raw_key, key_hash = generate_api_key()
    api_key = APIKey(
        id=str(uuid.uuid4()),
        client_id=client.id,
        key_hash=key_hash,
        label="Clé de production",
        environment="production"
    )
    db.add(api_key)

    # Créer clé API de test
    raw_test, test_hash = generate_api_key()
    api_key_test = APIKey(
        id=str(uuid.uuid4()),
        client_id=client.id,
        key_hash=test_hash,
        label="Clé de test",
        environment="test"
    )
    db.add(api_key_test)

    db.commit()

    # Générer tokens
    access = create_access_token({"sub": client.id})
    refresh = create_refresh_token(client.id)

    # Sauvegarder refresh token
    rt = RefreshToken(
        id=str(uuid.uuid4()),
        client_id=client.id,
        token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
        expires_at=datetime.utcnow().replace(day=datetime.utcnow().day + 30)
    )
    db.add(rt)
    db.commit()

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        client={
            "id": client.id,
            "email": client.email,
            "company_name": client.company_name,
            "full_name": client.full_name,
            "plan": client.plan,
            "monthly_quota": client.monthly_quota,
            "monthly_calls": client.monthly_calls,
            "api_key_production": raw_key,   # Affiché UNE seule fois
            "api_key_test": raw_test,
        }
    )

# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginInput, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == data.email).first()

    if not client or not verify_password(data.password, client.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if not client.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé. Contactez le support.")

    # Mettre à jour last_login
    client.last_login_at = datetime.utcnow()
    db.commit()

    access = create_access_token({"sub": client.id})
    refresh = create_refresh_token(client.id)

    # Sauvegarder refresh token
    rt = RefreshToken(
        id=str(uuid.uuid4()),
        client_id=client.id,
        token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
        expires_at=datetime.utcnow().replace(day=datetime.utcnow().day + 30)
    )
    db.add(rt)
    db.commit()

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        client={
            "id": client.id,
            "email": client.email,
            "company_name": client.company_name,
            "full_name": client.full_name,
            "plan": client.plan,
            "monthly_quota": client.monthly_quota,
            "monthly_calls": client.monthly_calls,
        }
    )

# ── Refresh token ─────────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh_token(data: RefreshInput, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de rafraîchissement invalide")

    token_hash = hashlib.sha256(data.refresh_token.encode()).hexdigest()
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.is_revoked == False
    ).first()

    if not rt:
        raise HTTPException(status_code=401, detail="Token révoqué ou introuvable")

    client_id = payload.get("sub")
    new_access = create_access_token({"sub": client_id})

    return {"access_token": new_access, "token_type": "bearer"}

# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(client: Client = Depends(get_current_client)):
    return {
        "id": client.id,
        "email": client.email,
        "company_name": client.company_name,
        "full_name": client.full_name,
        "plan": client.plan,
        "monthly_quota": client.monthly_quota,
        "monthly_calls": client.monthly_calls,
        "is_verified": client.is_verified,
        "created_at": client.created_at.isoformat(),
    }

# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(data: RefreshInput, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(data.refresh_token.encode()).hexdigest()
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if rt:
        rt.is_revoked = True
        db.commit()
    return {"message": "Déconnecté avec succès"}
