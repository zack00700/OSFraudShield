"""
AntiScalpEngine — Module anti-revente de billets
Détecte les scalpers via :
  1. Limite billets par compte/event
  2. Détection bots (Selenium, Puppeteer, headless browsers)
  3. Liaison de comptes suspects (même CB, adresse, device)
  4. Blocage VPN/proxies (via IP reputation)
  5. File d'attente intelligente
"""
import hashlib
import re
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session


class AntiScalpEngine:

    # ── Config par défaut (configurable par client) ───────────────────────────
    DEFAULT_MAX_TICKETS_PER_USER = 2       # max billets par compte par event
    DEFAULT_MAX_TICKETS_PER_DEVICE = 2     # max billets par appareil par event
    DEFAULT_PURCHASE_WINDOW_MINUTES = 30   # fenêtre de temps analysée

    # Headless browser signatures connues
    BOT_USER_AGENT_PATTERNS = [
        "headlesschrome", "phantomjs", "selenium", "webdriver",
        "puppeteer", "playwright", "nightmare", "zombie",
        "python-requests", "curl/", "wget/", "scrapy",
        "bot", "crawler", "spider"
    ]

    # Headers que les vrais navigateurs ont toujours
    REQUIRED_BROWSER_HEADERS = [
        "accept-language",
        "accept-encoding",
        "accept"
    ]

    # Plages IP connues comme VPN/proxy/datacenter
    DATACENTER_IP_PREFIXES = [
        "185.220.", "45.142.", "194.165.",   # Tor exit nodes
        "104.21.", "172.64.", "172.67.",      # Cloudflare (parfois proxy)
        "35.180.", "52.47.", "54.93.",        # AWS datacenter
        "20.36.", "20.37.", "20.38.",         # Azure datacenter
        "34.1.", "34.2.", "34.3.",            # GCP datacenter
    ]

    def __init__(self):
        # Cache en mémoire (en prod → Redis)
        self._purchase_log: Dict[str, List[datetime]] = {}
        self._device_log: Dict[str, List[str]] = {}      # device → [user_ids]
        self._card_log: Dict[str, List[str]] = {}        # card_hash → [user_ids]
        self._address_log: Dict[str, List[str]] = {}     # address_hash → [user_ids]

    # ── Analyse principale ────────────────────────────────────────────────────

    def analyze(self, data: Dict[str, Any], db: Session = None) -> Dict[str, Any]:
        """
        Analyse une tentative d'achat de billet.
        Retourne : risk_score, decision, triggered_rules, recommendation
        """
        triggered_rules = []
        score = 0.0

        # ── Règle 1 : Détection bot ───────────────────────────────────────────
        bot_result = self._detect_bot(data)
        if bot_result["is_bot"]:
            triggered_rules.append(f"BOT_DETECTED:{bot_result['reason']}")
            score += 0.90

        # ── Règle 2 : Limite billets par compte ───────────────────────────────
        max_tickets = data.get("max_tickets_per_user", self.DEFAULT_MAX_TICKETS_PER_USER)
        user_tickets = self._get_user_tickets_for_event(
            data.get("user_id"), data.get("event_id"), data.get("quantity", 1)
        )
        if user_tickets > max_tickets:
            triggered_rules.append(f"TICKET_LIMIT_EXCEEDED:{user_tickets}/{max_tickets}")
            score += 0.85

        # ── Règle 3 : Limite billets par device ───────────────────────────────
        device_tickets = self._get_device_tickets_for_event(
            data.get("device_fingerprint"), data.get("event_id")
        )
        if device_tickets > self.DEFAULT_MAX_TICKETS_PER_DEVICE:
            triggered_rules.append(f"DEVICE_LIMIT_EXCEEDED:{device_tickets}")
            score += 0.75

        # ── Règle 4 : Liaison de comptes (même CB) ───────────────────────────
        if data.get("card_fingerprint"):
            linked_users = self._get_linked_accounts_by_card(
                data.get("card_fingerprint"), data.get("user_id")
            )
            if len(linked_users) > 1:
                triggered_rules.append(f"LINKED_ACCOUNTS_CARD:{len(linked_users)}_comptes")
                score += 0.70

        # ── Règle 5 : Liaison de comptes (même device) ───────────────────────
        if data.get("device_fingerprint"):
            linked_by_device = self._get_linked_accounts_by_device(
                data.get("device_fingerprint"), data.get("user_id")
            )
            if len(linked_by_device) > 1:
                triggered_rules.append(f"LINKED_ACCOUNTS_DEVICE:{len(linked_by_device)}_comptes")
                score += 0.65

        # ── Règle 6 : VPN/Proxy/Datacenter ───────────────────────────────────
        if self._is_datacenter_ip(data.get("ip_address", "")):
            triggered_rules.append("VPN_OR_PROXY_IP")
            score += 0.60

        # ── Règle 7 : Vitesse d'achat anormale ───────────────────────────────
        if self._is_purchase_too_fast(data.get("user_id"), data.get("time_on_page_seconds", 99)):
            triggered_rules.append("PURCHASE_TOO_FAST")
            score += 0.50

        # ── Règle 8 : Comportement souris/clavier mécanique ──────────────────
        if data.get("mouse_movement_score", 1.0) < 0.2:
            triggered_rules.append("MECHANICAL_BEHAVIOR")
            score += 0.45

        # Normaliser le score
        score = min(1.0, score)

        # Enregistrer l'achat si autorisé
        if score < 0.70:
            self._record_purchase(data)

        decision, recommendation = self._decide(score)

        return {
            "risk_score": round(score, 4),
            "decision": decision,
            "triggered_rules": triggered_rules,
            "recommendation": recommendation,
            "user_tickets_this_event": user_tickets,
            "is_bot": bot_result["is_bot"],
            "is_vpn": self._is_datacenter_ip(data.get("ip_address", "")),
        }

    # ── Détection bot ─────────────────────────────────────────────────────────

    def _detect_bot(self, data: Dict) -> Dict:
        user_agent = (data.get("user_agent") or "").lower()
        headers = data.get("headers") or {}

        # Vérifier user agent suspect
        for pattern in self.BOT_USER_AGENT_PATTERNS:
            if pattern in user_agent:
                return {"is_bot": True, "reason": f"USER_AGENT:{pattern}"}

        # User agent vide = bot
        if not user_agent:
            return {"is_bot": True, "reason": "MISSING_USER_AGENT"}

        # WebDriver flag (injecté par Selenium)
        if data.get("webdriver") is True:
            return {"is_bot": True, "reason": "WEBDRIVER_FLAG"}

        # Headers manquants = pas un vrai navigateur
        headers_lower = {k.lower(): v for k, v in headers.items()}
        missing = [h for h in self.REQUIRED_BROWSER_HEADERS if h not in headers_lower]
        if len(missing) >= 2:
            return {"is_bot": True, "reason": f"MISSING_HEADERS:{','.join(missing)}"}

        # Résolution écran = 0 ou absente (headless)
        screen = data.get("screen_resolution", "")
        if not screen or screen == "0x0":
            return {"is_bot": True, "reason": "NO_SCREEN_RESOLUTION"}

        return {"is_bot": False, "reason": None}

    # ── Gestion des achats par event ──────────────────────────────────────────

    def _get_user_tickets_for_event(self, user_id: str, event_id: str, quantity: int) -> int:
        """Retourne le total de billets achetés par ce user pour cet event."""
        key = f"user:{user_id}:event:{event_id}"
        existing = len(self._purchase_log.get(key, []))
        return existing + quantity

    def _get_device_tickets_for_event(self, device_fp: str, event_id: str) -> int:
        if not device_fp or not event_id:
            return 0
        key = f"device:{device_fp}:event:{event_id}"
        return len(self._purchase_log.get(key, []))

    def _record_purchase(self, data: Dict):
        """Enregistre l'achat dans les logs."""
        user_id = data.get("user_id")
        event_id = data.get("event_id")
        device_fp = data.get("device_fingerprint")
        card_fp = data.get("card_fingerprint")
        now = datetime.utcnow()

        if user_id and event_id:
            key = f"user:{user_id}:event:{event_id}"
            if key not in self._purchase_log:
                self._purchase_log[key] = []
            self._purchase_log[key].append(now)

        if device_fp and event_id:
            key = f"device:{device_fp}:event:{event_id}"
            if key not in self._purchase_log:
                self._purchase_log[key] = []
            self._purchase_log[key].append(now)

        # Enregistrer liens entre comptes
        if device_fp and user_id:
            if device_fp not in self._device_log:
                self._device_log[device_fp] = []
            if user_id not in self._device_log[device_fp]:
                self._device_log[device_fp].append(user_id)

        if card_fp and user_id:
            if card_fp not in self._card_log:
                self._card_log[card_fp] = []
            if user_id not in self._card_log[card_fp]:
                self._card_log[card_fp].append(user_id)

    # ── Liaison de comptes ────────────────────────────────────────────────────

    def _get_linked_accounts_by_card(self, card_fingerprint: str, current_user: str) -> List[str]:
        """Retourne tous les user_ids qui ont utilisé cette CB."""
        return self._card_log.get(card_fingerprint, [current_user])

    def _get_linked_accounts_by_device(self, device_fp: str, current_user: str) -> List[str]:
        """Retourne tous les user_ids qui ont utilisé cet appareil."""
        return self._device_log.get(device_fp, [current_user])

    # ── VPN/Proxy ─────────────────────────────────────────────────────────────

    def _is_datacenter_ip(self, ip: str) -> bool:
        if not ip:
            return False
        return any(ip.startswith(prefix) for prefix in self.DATACENTER_IP_PREFIXES)

    # ── Vitesse d'achat ───────────────────────────────────────────────────────

    def _is_purchase_too_fast(self, user_id: str, time_on_page: float) -> bool:
        """
        Un humain prend au moins 15 secondes pour lire et acheter.
        Moins de 3 secondes = bot.
        """
        return time_on_page < 3.0

    # ── Décision finale ───────────────────────────────────────────────────────

    def _decide(self, score: float):
        if score >= 0.70:
            return "block", "Achat bloqué — comportement scalper détecté."
        elif score >= 0.40:
            return "challenge", "Vérification CAPTCHA requise avant achat."
        else:
            return "allow", "Achat autorisé."
