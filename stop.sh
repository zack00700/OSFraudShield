#!/bin/bash

# ─── OS FraudShield — Arrêt complet ─────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛡️  OS FraudShield — Arrêt en cours..."
echo ""

# ── 1. Tuer le backend (uvicorn port 8000) ───────────────────────────────────
echo "🐍 Arrêt du backend..."
BACKEND_PID=$(lsof -ti:8000)
if [ -n "$BACKEND_PID" ]; then
  kill -9 $BACKEND_PID 2>/dev/null
  echo "✅ Backend arrêté (PID $BACKEND_PID)"
else
  echo "ℹ️  Backend déjà arrêté"
fi

# ── 2. Tuer le frontend (Next.js port 3000) ──────────────────────────────────
echo "⚛️  Arrêt du frontend..."
FRONTEND_PID=$(lsof -ti:3000)
if [ -n "$FRONTEND_PID" ]; then
  kill -9 $FRONTEND_PID 2>/dev/null
  echo "✅ Frontend arrêté (PID $FRONTEND_PID)"
else
  echo "ℹ️  Frontend déjà arrêté"
fi

# ── 3. Arrêter Docker (PostgreSQL + Redis) ───────────────────────────────────
echo "🐳 Arrêt de la base de données..."
cd "$PROJECT_DIR"
docker compose down
echo "✅ Base de données arrêtée"

# ── 4. Fermer les onglets Terminal du projet ─────────────────────────────────
echo ""
echo "🧹 Fermeture des terminaux..."
osascript <<EOF
tell application "Terminal"
  set windowList to every window
  repeat with w in windowList
    set tabList to every tab of w
    repeat with t in tabList
      if (custom title of t contains "backend") or ¬
         (custom title of t contains "frontend") or ¬
         (processes of t as string) contains "uvicorn" or ¬
         (processes of t as string) contains "npm" then
        close t
      end if
    end repeat
  end repeat
end tell
EOF

echo ""
echo "✅ FraudShield complètement arrêté !"
echo ""
echo "   🌐 http://localhost:3000 → hors ligne"
echo "   📡 http://localhost:8000 → hors ligne"
