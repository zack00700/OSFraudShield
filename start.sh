#!/bin/bash

# ─── OS FraudShield — Script de lancement automatique ───────────────────────
# Double-clique sur ce fichier pour tout lancer en une commande

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛡️  OS FraudShield — Démarrage..."
echo "📁 Dossier : $PROJECT_DIR"

# ── 1. Lancer Docker (PostgreSQL + Redis) en arrière-plan ────────────────────
echo ""
echo "🐳 Lancement de la base de données..."
cd "$PROJECT_DIR"
docker compose up -d

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Erreur Docker — Vérifie que Docker Desktop est ouvert (baleine 🐳 dans la barre de menu)"
  read -p "Appuie sur Entrée pour quitter..."
  exit 1
fi

echo "✅ Base de données prête"
sleep 2

# ── 2. Lancer le Backend dans un nouvel onglet Terminal ──────────────────────
echo ""
echo "🐍 Lancement du backend Python..."

osascript <<EOF
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd '$PROJECT_DIR/backend' && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000" in front window
end tell
EOF

sleep 2

# ── 3. Lancer le Frontend dans un nouvel onglet Terminal ────────────────────
echo ""
echo "⚛️  Lancement du frontend Next.js..."

osascript <<EOF
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd '$PROJECT_DIR/frontend' && npm run dev" in front window
end tell
EOF

# ── 4. Ouvrir le navigateur après 5 secondes ────────────────────────────────
echo ""
echo "⏳ Ouverture du navigateur dans 5 secondes..."
sleep 5

open "http://localhost:3000"

echo ""
echo "✅ FraudShield est lancé !"
echo ""
echo "   🌐 App       → http://localhost:3000"
echo "   📡 API       → http://localhost:8000"
echo "   📖 Swagger   → http://localhost:8000/docs"
echo ""
echo "Pour tout arrêter : docker compose down (dans le dossier du projet)"
