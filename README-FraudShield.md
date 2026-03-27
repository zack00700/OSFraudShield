# 🛡️ OS FraudShield — Guide d'installation (Mac)

API de détection de fraude en temps réel.
**Backend** FastAPI (Python) + **Frontend** Next.js + **DB** PostgreSQL via Docker

---

## 🏗️ Ce qui se lance où

```
Terminal 1 → Docker (PostgreSQL + Redis)
Terminal 2 → Backend Python  → http://localhost:8000
Terminal 3 → Frontend Next.js → http://localhost:3000
```

Docker gère uniquement la base de données.
Le backend et le frontend se lancent manuellement.

---

## ⚙️ Étape 0 — Vérifier les prérequis

Ouvre un terminal et vérifie que tout est installé :

```bash
python3 --version   # doit afficher 3.10 ou plus
node --version      # doit afficher 18 ou plus
docker --version    # doit afficher 24 ou plus
```

### Si Python3 manque

```bash
# Installer Homebrew d'abord si pas déjà fait
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Puis installer Python
brew install python3
```

### Si Node.js manque

```bash
brew install node
```

### Si Docker manque

Télécharger Docker Desktop sur https://www.docker.com/get-started
Ouvrir l'app après installation → attendre la baleine 🐳 dans la barre de menu

---

## 📁 Structure du projet

```
fraudshield-full/
├── docker-compose.yml        ← Lance PostgreSQL + Redis
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── fraud_engine.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   └── routers/
│       ├── auth.py
│       ├── analyze.py
│       └── apikeys.py
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── .env.local.example
    └── src/
        ├── app/
        │   ├── (auth)/login/
        │   ├── (auth)/register/
        │   └── dashboard/
        └── lib/
            ├── api.ts
            └── auth-context.tsx
```

---

## 🐳 Terminal 1 — Lancer la base de données

Ouvre un premier terminal dans le dossier du projet :

```bash
cd fraudshield-full
```

Ouvrir `docker-compose.yml` et supprimer la ligne `version: "3.9"` si elle existe.

Puis lancer :

```bash
docker compose up -d
```

Vérifier que tout tourne :

```bash
docker compose ps
```

Tu dois voir `db` et `redis` avec le statut `running`. ✅

---

## 🐍 Terminal 2 — Backend Python

Ouvre un **deuxième terminal** :

```bash
cd fraudshield-full/backend
```

### Créer l'environnement virtuel

```bash
python3 -m venv venv
source venv/bin/activate
```

> Tu dois voir `(venv)` au début de la ligne dans le terminal ✅

### Installer les dépendances

```bash
pip install -r requirements.txt
```

> Cette étape prend 1-2 minutes la première fois

### Configurer les variables d'environnement

```bash
cp .env.example .env
```

Ouvrir `.env` et remplacer `SECRET_KEY` par une vraie clé :

```bash
# Générer une clé sécurisée
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copier la valeur affichée et la coller dans `.env` :

```env
DATABASE_URL=postgresql://postgres:postgres@localhost/fraudshield
REDIS_URL=redis://localhost:6379
SECRET_KEY=colle_ta_cle_ici
FRAUD_THRESHOLD_BLOCK=0.80
FRAUD_THRESHOLD_REVIEW=0.55
```

### Initialiser la base de données (une seule fois)

```bash
python3 -c "from database import init_db; init_db()"
```

> Tu dois voir les tables créées sans erreur ✅

### Lancer l'API

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Tu dois voir :

```
✅ FraudShield API v1.0.0 démarré
INFO: Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

Ouvrir dans le navigateur → http://localhost:8000/docs ✅

---

## ⚛️ Terminal 3 — Frontend Next.js

Ouvre un **troisième terminal** :

```bash
cd fraudshield-full/frontend
```

### Installer les dépendances Node.js

```bash
npm install
```

> Cette étape prend 1-2 minutes la première fois

### Configurer l'URL du backend

```bash
cp .env.local.example .env.local
```

Le fichier `.env.local` doit contenir :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Lancer le frontend

```bash
npm run dev
```

Tu dois voir :

```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

Ouvrir dans le navigateur → http://localhost:3000 ✅

---

## ✅ Vérification finale

Les 3 terminaux doivent tourner en même temps :

| Terminal | Commande | URL |
|---|---|---|
| 1 — Docker | `docker compose up -d` | — |
| 2 — Backend | `uvicorn main:app --reload --port 8000` | http://localhost:8000/docs |
| 3 — Frontend | `npm run dev` | http://localhost:3000 |

---

## 🔄 Tester que tout est connecté

### 1. Créer un compte

Aller sur http://localhost:3000/register et créer un compte.
Deux clés API s'affichent → **les sauvegarder** (affichées une seule fois).

### 2. Tester l'API depuis le terminal

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

Réponse attendue :

```json
{
  "fraud_score": 0.89,
  "decision": "block",
  "risk_level": "critical",
  "triggered_rules": ["SUSPICIOUS_IP", "HIGH_RISK_COUNTRY", "DISPOSABLE_EMAIL"]
}
```

---

## 🔁 Relancer le projet les prochaines fois

```bash
# Terminal 1
cd fraudshield-full
docker compose up -d

# Terminal 2
cd fraudshield-full/backend
source venv/bin/activate      ← ne pas oublier
uvicorn main:app --reload --port 8000

# Terminal 3
cd fraudshield-full/frontend
npm run dev
```

> `python3 -c "from database import init_db; init_db()"` n'est à faire qu'une seule fois.
> `npm install` et `pip install` n'est à refaire que si les dépendances changent.

---

## 🐛 Problèmes fréquents

### `command not found: python` → utiliser `python3`

Sur Mac, la commande s'appelle toujours `python3` :

```bash
python3 --version
python3 -m venv venv
python3 -c "from database import init_db; init_db()"
```

### `(venv)` n'apparaît pas

L'environnement virtuel n'est pas activé :

```bash
source venv/bin/activate
```

### `Cannot connect to Docker daemon`

Docker Desktop n'est pas ouvert. Ouvrir l'app Docker Desktop et attendre la baleine 🐳 dans la barre de menu.

### `address already in use` — port occupé

Un autre processus utilise le port. Tuer le processus :

```bash
# Trouver et tuer le processus sur le port 8000
lsof -ti:8000 | xargs kill -9

# Ou changer le port
uvicorn main:app --reload --port 8001
```

### `ModuleNotFoundError`

Les dépendances ne sont pas installées dans le bon environnement :

```bash
source venv/bin/activate   # activer le venv d'abord
pip install -r requirements.txt
```

### `connection refused` sur PostgreSQL

Docker n'est pas lancé ou pas encore prêt :

```bash
docker compose up -d
docker compose ps   # vérifier que "db" est "running"
```

### CORS error dans le navigateur

Vérifier que `.env.local` contient bien :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Et que le backend tourne sur le port 8000.

---

## 🧠 Règles de détection

| Règle | Score ajouté | Déclencheur |
|---|---|---|
| `BLOCKED_COUNTRY` | +0.95 | Iran, Corée du Nord, Cuba |
| `VELOCITY_EXCEEDED` | +0.45 | 5+ transactions en 10 min |
| `SUSPICIOUS_IP` | +0.30 | IP blacklistée |
| `HIGH_AMOUNT` | +0.30 | Montant > 5 000€ |
| `HIGH_RISK_COUNTRY` | +0.25 | Pays à risque élevé |
| `DISPOSABLE_EMAIL` | +0.20 | Email jetable (mailinator, yopmail...) |
| `NO_DEVICE_FINGERPRINT` | +0.10 | Pas de fingerprint appareil |

**Décisions finales :**
- Score < 0.30 → ✅ `allow`
- Score 0.30–0.79 → ⚠️ `review`
- Score ≥ 0.80 → 🚫 `block`

---

*OS FraudShield — OpenSID Software Development — v1.0.0*
