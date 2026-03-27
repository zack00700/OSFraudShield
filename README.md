# 🛡️ OS FraudShield — Stack complète

API de détection de fraude en temps réel avec dashboard connecté.
**Backend** FastAPI (Python) + **Frontend** Next.js (React/TypeScript)

---

## 🏗️ Architecture réelle

```
┌──────────────────────────────────────────────────────┐
│  Next.js (port 3000)                                 │
│  /login  /register  /dashboard                       │
│  /dashboard/transactions  /alerts  /apikeys          │
└─────────────────────┬────────────────────────────────┘
                      │ fetch() avec JWT ou x-api-key
┌─────────────────────▼────────────────────────────────┐
│  FastAPI (port 8000)                                 │
│  /auth/*   /v1/analyze   /v1/stats                   │
│  /v1/transactions   /v1/alerts   /v1/apikeys         │
└──────────┬───────────────────────┬───────────────────┘
           │                       │
    ┌──────▼──────┐         ┌──────▼──────┐
    │ PostgreSQL  │         │    Redis    │
    │ (port 5432) │         │ (port 6379) │
    └─────────────┘         └─────────────┘
```

---

## 📁 Structure

```
fraudshield-full/
├── docker-compose.yml
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── fraud_engine.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py        ← register, login, refresh, logout, me
│   │   ├── analyze.py     ← /v1/analyze, stats, transactions, alerts
│   │   └── apikeys.py     ← CRUD clés API
│   └── core/
│       ├── config.py      ← Settings depuis .env
│       └── security.py    ← JWT, hash, auth dependencies
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── .env.local.example
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx               ← Redirect auto
        │   ├── (auth)/login/page.tsx
        │   ├── (auth)/register/page.tsx
        │   └── dashboard/
        │       ├── page.tsx           ← Stats réelles
        │       ├── transactions/page.tsx
        │       ├── alerts/page.tsx
        │       └── apikeys/page.tsx
        └── lib/
            ├── api.ts                 ← Client HTTP + refresh auto
            └── auth-context.tsx       ← Context global useAuth
```

---

## ⚙️ Prérequis

| Outil | Version | Lien |
|---|---|---|
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| Docker + Compose | 24+ | https://docker.com |

---

## 🚀 Lancement rapide (Docker)

```bash
unzip OS-FraudShield-full.zip
cd fraudshield-full

# Configurer les variables
cp backend/.env.example backend/.env

# Générer une clé secrète et la coller dans SECRET_KEY=
python -c "import secrets; print(secrets.token_hex(32))"
nano backend/.env

# Lancer tout (DB + Redis + Backend + Frontend)
docker compose up --build

# Backend  → http://localhost:8000/docs
# Frontend → http://localhost:3000
```

---

## 🛠️ Lancement manuel (développement)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Mac/Linux
venv\Scripts\activate         # Windows

pip install -r requirements.txt
cp .env.example .env          # Configurer les variables

# Démarrer DB + Redis
docker compose up db redis -d

# Initialiser les tables
python -c "from database import init_db; init_db()"

# Lancer l'API
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local

# .env.local contient :
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

---

## 🔄 Flux complet

### Inscription
```
POST /auth/register
→ Crée compte en base
→ Génère 2 clés API (production + test)
→ Retourne JWT + clés en clair (affichées une seule fois)
```

### Login
```
POST /auth/login { email, password }
→ Vérifie password hash bcrypt
→ Retourne access_token (24h) + refresh_token (30j)
→ Frontend stocke dans localStorage, redirige dashboard
```

### Analyser une transaction
```bash
curl -X POST http://localhost:8000/v1/analyze \
  -H "x-api-key: fs_prod_VOTRE_CLE" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_001",
    "user_id": "usr_42",
    "amount": 2500.00,
    "ip_address": "185.220.101.1",
    "payment_method": "card",
    "country": "NG",
    "email": "test@mailinator.com"
  }'
```

```json
{
  "fraud_score": 0.89,
  "decision": "block",
  "risk_level": "critical",
  "triggered_rules": ["SUSPICIOUS_IP", "HIGH_RISK_COUNTRY", "DISPOSABLE_EMAIL"],
  "processing_time_ms": 187.4
}
```

---

## 🔐 Authentification — 2 modes

| Mode | Header | Utilisé par |
|---|---|---|
| JWT Bearer | `Authorization: Bearer <token>` | Dashboard Next.js |
| Clé API | `x-api-key: fs_prod_...` | App du client |

Le refresh token renouvelle automatiquement le JWT sans déconnexion.

---

## 🧠 Règles de détection

| Règle | Score | Déclencheur |
|---|---|---|
| `BLOCKED_COUNTRY` | +0.95 | Pays sanctionné |
| `VELOCITY_EXCEEDED` | +0.45 | 5+ transactions en 10min |
| `SUSPICIOUS_IP` | +0.30 | IP blacklistée |
| `HIGH_AMOUNT` | +0.30 | Montant > 5 000€ |
| `HIGH_RISK_COUNTRY` | +0.25 | Pays à risque |
| `DISPOSABLE_EMAIL` | +0.20 | Email jetable |
| `NO_DEVICE_FINGERPRINT` | +0.10 | Pas de fingerprint |

- Score < 0.30 → ✅ allow
- Score 0.30-0.79 → ⚠️ review
- Score ≥ 0.80 → 🚫 block

---

## 📡 Endpoints

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Créer un compte |
| POST | `/auth/login` | — | Connexion |
| POST | `/auth/refresh` | — | Renouveler JWT |
| GET | `/auth/me` | JWT | Profil client |
| POST | `/v1/analyze` | API Key | Analyser transaction |
| GET | `/v1/stats` | JWT | KPIs dashboard |
| GET | `/v1/transactions` | JWT | Liste transactions |
| GET | `/v1/alerts` | JWT | Alertes actives |
| PATCH | `/v1/alerts/:id/resolve` | JWT | Résoudre alerte |
| GET | `/v1/apikeys` | JWT | Lister clés |
| POST | `/v1/apikeys` | JWT | Créer clé |
| DELETE | `/v1/apikeys/:id` | JWT | Révoquer clé |

---

## 🐛 Dépannage

**CORS error** → Vérifier `NEXT_PUBLIC_API_URL=http://localhost:8000`

**401 Unauthorized** → Token expiré, se reconnecter

**ModuleNotFoundError** → `source venv/bin/activate`

**Port occupé** → Modifier les ports dans `docker-compose.yml`

---

*OS FraudShield Full Stack — OpenSID Software Development — v1.0.0*
