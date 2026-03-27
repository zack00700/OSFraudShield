// lib/api.ts — Client API central qui parle au back FastAPI

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access)
  localStorage.setItem("refresh_token", refresh)
}

export function clearTokens() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
  localStorage.removeItem("client")
}

// ── Base fetch avec auth automatique ─────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  // Token expiré → essayer de refresh
  if (res.status === 401) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`
      return fetch(`${API_URL}${path}`, { ...options, headers })
    } else {
      clearTokens()
      window.location.href = "/login"
      throw new Error("Session expirée")
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur serveur" }))
    throw new Error(err.detail || "Erreur inconnue")
  }

  return res.json()
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem("refresh_token")
  if (!refresh) return false
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem("access_token", data.access_token)
    return true
  } catch {
    return false
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authAPI = {
  async register(data: {
    email: string
    password: string
    company_name: string
    full_name: string
  }) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || "Erreur inscription")
    }
    const json = await res.json()
    setTokens(json.access_token, json.refresh_token)
    localStorage.setItem("client", JSON.stringify(json.client))
    return json
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || "Email ou mot de passe incorrect")
    }
    const json = await res.json()
    setTokens(json.access_token, json.refresh_token)
    localStorage.setItem("client", JSON.stringify(json.client))
    return json
  },

  async logout() {
    const refresh = localStorage.getItem("refresh_token")
    if (refresh) {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => {})
    }
    clearTokens()
  },

  async me() {
    return apiFetch("/auth/me")
  },
}

// ── Dashboard API ─────────────────────────────────────────────────────────────

export const dashboardAPI = {
  async getStats() {
    return apiFetch("/v1/stats")
  },

  async getTransactions(limit = 50, decision?: string) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (decision) params.set("decision", decision)
    return apiFetch(`/v1/transactions?${params}`)
  },

  async getAlerts(limit = 50) {
    return apiFetch(`/v1/alerts?limit=${limit}`)
  },

  async resolveAlert(alertId: string) {
    return apiFetch(`/v1/alerts/${alertId}/resolve`, { method: "PATCH" })
  },
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export const apiKeysAPI = {
  async list() {
    return apiFetch("/v1/apikeys")
  },

  async create(label: string, environment: string) {
    return apiFetch("/v1/apikeys", {
      method: "POST",
      body: JSON.stringify({ label, environment }),
    })
  },

  async revoke(keyId: string) {
    return apiFetch(`/v1/apikeys/${keyId}`, { method: "DELETE" })
  },
}
