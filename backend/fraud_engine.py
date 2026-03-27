"""
FraudEngine — Moteur de détection de fraude
Combine règles métier + scoring ML
"""
from typing import Dict, Any
import math


class FraudEngine:

    # ─── Règles métier ────────────────────────────────────────────────────────

    BLOCKED_COUNTRIES = {"KP", "IR", "CU"}  # Pays sanctionnés
    HIGH_RISK_COUNTRIES = {"NG", "RU", "VN", "BD"}
    MAX_AMOUNT_INSTANT = 5000.0
    VELOCITY_LIMIT = 5  # max transactions en 10 minutes

    def __init__(self):
        # Historique simplifié en mémoire (en prod → Redis)
        self._user_history: Dict[str, list] = {}

    def analyze(self, data: Dict[str, Any]) -> Dict[str, Any]:
        triggered_rules = []
        score = 0.0

        # ── Règle 1 : Pays bloqué ─────────────────────────────────
        country = data.get("country", "").upper()
        if country in self.BLOCKED_COUNTRIES:
            triggered_rules.append("BLOCKED_COUNTRY")
            score += 0.95

        # ── Règle 2 : Pays à haut risque ─────────────────────────
        elif country in self.HIGH_RISK_COUNTRIES:
            triggered_rules.append("HIGH_RISK_COUNTRY")
            score += 0.25

        # ── Règle 3 : Montant anormal ─────────────────────────────
        amount = data.get("amount", 0)
        if amount > self.MAX_AMOUNT_INSTANT:
            triggered_rules.append("HIGH_AMOUNT")
            score += 0.30

        # ── Règle 4 : Vitesse de transactions (velocity) ──────────
        user_id = data.get("user_id")
        velocity = self._get_velocity(user_id)
        if velocity >= self.VELOCITY_LIMIT:
            triggered_rules.append("VELOCITY_EXCEEDED")
            score += 0.45

        # ── Règle 5 : IP suspecte (exemple simplifié) ─────────────
        ip = data.get("ip_address", "")
        if self._is_suspicious_ip(ip):
            triggered_rules.append("SUSPICIOUS_IP")
            score += 0.30

        # ── Règle 6 : Email jetable ───────────────────────────────
        email = data.get("email", "")
        if self._is_disposable_email(email):
            triggered_rules.append("DISPOSABLE_EMAIL")
            score += 0.20

        # ── Règle 7 : Device fingerprint manquant ─────────────────
        if not data.get("device_fingerprint"):
            triggered_rules.append("NO_DEVICE_FINGERPRINT")
            score += 0.10

        # ── Score ML simulé (en prod → vrai modèle XGBoost) ───────
        ml_score = self._ml_score(data)
        score = min(1.0, score * 0.6 + ml_score * 0.4)

        # Enregistrer dans l'historique
        self._record_transaction(user_id)

        # ── Décision finale ───────────────────────────────────────
        decision, risk_level, recommendation = self._decide(score)

        return {
            "fraud_score": round(score, 4),
            "decision": decision,
            "risk_level": risk_level,
            "triggered_rules": triggered_rules,
            "recommendation": recommendation
        }

    def _decide(self, score: float):
        if score >= 0.80:
            return "block", "critical", "Transaction automatiquement bloquée. Fraude probable."
        elif score >= 0.55:
            return "review", "high", "Nécessite une vérification manuelle avant validation."
        elif score >= 0.30:
            return "review", "medium", "Transaction suspecte. Surveillance recommandée."
        else:
            return "allow", "low", "Transaction approuvée."

    def _get_velocity(self, user_id: str) -> int:
        """Retourne le nombre de transactions récentes (10 min)."""
        import time
        now = time.time()
        history = self._user_history.get(user_id, [])
        recent = [t for t in history if now - t < 600]
        self._user_history[user_id] = recent
        return len(recent)

    def _record_transaction(self, user_id: str):
        import time
        if user_id not in self._user_history:
            self._user_history[user_id] = []
        self._user_history[user_id].append(time.time())

    def _is_suspicious_ip(self, ip: str) -> bool:
        """Vérifie si l'IP est dans une plage connue comme suspecte."""
        # En production → intégrer une base IP Reputation (AbuseIPDB, etc.)
        suspicious_prefixes = ["185.220.", "45.142.", "194.165."]
        return any(ip.startswith(p) for p in suspicious_prefixes)

    def _is_disposable_email(self, email: str) -> bool:
        """Vérifie si l'email utilise un domaine jetable."""
        disposable_domains = [
            "mailinator.com", "tempmail.com", "guerrillamail.com",
            "10minutemail.com", "throwaway.email", "yopmail.com"
        ]
        domain = email.split("@")[-1].lower() if "@" in email else ""
        return domain in disposable_domains

    def _ml_score(self, data: Dict[str, Any]) -> float:
        """
        Score ML simplifié (logique heuristique).
        En production → charger un modèle XGBoost entraîné sur vos données.
        
        Exemple de chargement en prod:
            import joblib
            model = joblib.load("fraud_model.pkl")
            features = extract_features(data)
            return float(model.predict_proba([features])[0][1])
        """
        score = 0.0
        amount = data.get("amount", 0)
        
        # Montants ronds suspects
        if amount % 100 == 0 and amount > 500:
            score += 0.15
        
        # Paiement carte sans fingerprint
        if data.get("payment_method") == "card" and not data.get("device_fingerprint"):
            score += 0.20
            
        # Métadonnées vides = bot possible
        if not data.get("metadata"):
            score += 0.10

        return min(score, 1.0)
