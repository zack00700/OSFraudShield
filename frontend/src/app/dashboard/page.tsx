"use client"
import { useEffect, useState } from "react"
import { useRequireAuth, useAuth } from "@/lib/auth-context"
import { dashboardAPI, apiKeysAPI } from "@/lib/api"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  total: number
  blocked: number
  reviewed: number
  allowed: number
  block_rate: number
  avg_fraud_score: number
  amount_protected: number
  monthly_calls: number
  monthly_quota: number
}

interface Transaction {
  id: string
  transaction_id: string
  user_id: string
  amount: number
  currency: string
  country: string
  fraud_score: number
  decision: string
  risk_level: string
  triggered_rules: string[]
  created_at: string
}

interface Alert {
  id: string
  transaction_id: string
  risk_level: string
  triggered_rules: string[]
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const decisionColor = (d: string) =>
  d === "block" ? "#ff3d6b" : d === "review" ? "#ffd700" : "#00ff88"

const decisionLabel = (d: string) =>
  d === "block" ? "🚫 BLOCK" : d === "review" ? "⚠️ REVIEW" : "✅ ALLOW"

const riskColor = (r: string) =>
  r === "critical" ? "#ff3d6b" : r === "high" ? "#ff8c5a" : r === "medium" ? "#ffd700" : "#00ff88"

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "À l'instant"
  if (min < 60) return `Il y a ${min}min`
  return `Il y a ${Math.floor(min / 60)}h`
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ alertCount }: { alertCount: number }) {
  const { logout, client } = useAuth()
  const pathname = usePathname()

  const links = [
    { href: "/dashboard", label: "Vue d'ensemble", icon: "📊" },
    { href: "/dashboard/transactions", label: "Transactions", icon: "⚡" },
    { href: "/dashboard/alerts", label: "Alertes", icon: "🚨", badge: alertCount },
    { href: "/dashboard/apikeys", label: "Clés API", icon: "🔑" },
  ]

  return (
    <aside style={{ width: 240, minHeight: "100vh", background: "#0d1117", borderRight: "1px solid #1e2d3d", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0 }}>
      <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #1e2d3d" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#e8f4f8" }}>
          Fraud<span style={{ color: "#00e5ff" }}>Shield</span>
        </div>
        <div style={{ fontSize: "0.62rem", fontFamily: "monospace", color: "#5a7a8a", marginTop: "0.2rem" }}>Dashboard</div>
      </div>

      <nav style={{ flex: 1, padding: "1rem 0" }}>
        {links.map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.7rem 1.5rem", fontSize: "0.875rem", fontWeight: 600,
              color: pathname === link.href ? "#00e5ff" : "#5a7a8a",
              background: pathname === link.href ? "rgba(0,229,255,0.07)" : "transparent",
              borderRight: pathname === link.href ? "2px solid #00e5ff" : "2px solid transparent",
              transition: "all 0.15s"
            }}>
              <span>{link.icon}</span>
              <span style={{ flex: 1 }}>{link.label}</span>
              {link.badge ? (
                <span style={{ background: "#ff3d6b", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: "999px" }}>
                  {link.badge}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </nav>

      <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1e2d3d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.8rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00e5ff,#0070ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.8rem", color: "#080c10" }}>
            {client?.company_name?.[0] || "?"}
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e8f4f8" }}>{client?.company_name}</div>
            <div style={{ fontSize: "0.62rem", color: "#00e5ff", fontFamily: "monospace", textTransform: "uppercase" }}>{client?.plan}</div>
          </div>
        </div>
        <button onClick={logout} style={{ width: "100%", background: "transparent", border: "1px solid #1e2d3d", color: "#5a7a8a", borderRadius: "6px", padding: "0.5rem", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, color, icon, sub }: any) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: "1.5rem", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: "1.2rem", top: "1.2rem", fontSize: "1.5rem", opacity: 0.2 }}>{icon}</div>
      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#5a7a8a", marginBottom: "0.4rem", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "2.2rem", fontWeight: 800, fontFamily: "monospace", color: color || "#e8f4f8" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#5a7a8a", marginTop: "0.3rem" }}>{sub}</div>}
    </div>
  )
}

// ── Dashboard Overview ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isLoading } = useRequireAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    if (isLoading) return
    Promise.all([
      dashboardAPI.getStats(),
      dashboardAPI.getTransactions(20),
      dashboardAPI.getAlerts(10),
    ]).then(([s, t, a]) => {
      setStats(s)
      setTransactions(t.transactions)
      setAlerts(a.alerts)
    }).catch(console.error)
      .finally(() => setLoadingData(false))
  }, [isLoading])

  const reloadTransactions = async (decision?: string) => {
    const data = await dashboardAPI.getTransactions(20, decision || undefined)
    setTransactions(data.transactions)
  }

  if (isLoading || loadingData) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#00e5ff", fontFamily: "monospace", fontSize: "0.9rem" }}>Chargement...</div>
      </div>
    )
  }

  return (
    <div style={{ background: "#080c10", minHeight: "100vh", fontFamily: "'Syne', sans-serif", display: "flex" }}>
      <Sidebar alertCount={alerts.length} />

      <div style={{ marginLeft: 240, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={{ height: 60, background: "#0d1117", borderBottom: "1px solid #1e2d3d", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ fontWeight: 700 }}>Vue d'ensemble</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)", padding: "0.3rem 0.8rem", borderRadius: 999, fontSize: "0.72rem", fontFamily: "monospace", color: "#00ff88" }}>
            <div style={{ width: 6, height: 6, background: "#00ff88", borderRadius: "50%", animation: "pulse 1.5s infinite" }} />
            API active
          </div>
        </div>

        <div style={{ padding: "2rem" }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.2rem", marginBottom: "2rem" }}>
            <KPICard label="Transactions" value={stats?.total.toLocaleString() || "0"} color="#00e5ff" icon="⚡" sub={`${stats?.monthly_calls}/${stats?.monthly_quota} ce mois`} />
            <KPICard label="Fraudes bloquées" value={stats?.blocked || 0} color="#ff3d6b" icon="🚫" sub={`${stats?.block_rate}% du total`} />
            <KPICard label="En révision" value={stats?.reviewed || 0} color="#ffd700" icon="⚠️" sub="À traiter" />
            <KPICard label="Montant protégé" value={`€${(stats?.amount_protected || 0).toLocaleString()}`} color="#00ff88" icon="💰" sub="Fraudes évitées" />
          </div>

          {/* Quota bar */}
          <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: "1.2rem 1.5rem", marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "#5a7a8a" }}>Quota mensuel utilisé</span>
              <span style={{ fontFamily: "monospace", color: "#00e5ff" }}>
                {stats?.monthly_calls.toLocaleString()} / {stats?.monthly_quota.toLocaleString()}
              </span>
            </div>
            <div style={{ height: 6, background: "#1e2d3d", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${Math.min(((stats?.monthly_calls || 0) / (stats?.monthly_quota || 1)) * 100, 100)}%`,
                background: "linear-gradient(90deg, #00e5ff, #0070ff)", transition: "width 1s ease"
              }} />
            </div>
          </div>

          {/* Transactions table */}
          <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Dernières transactions</div>
                <div style={{ fontSize: "0.72rem", color: "#5a7a8a", marginTop: "0.2rem" }}>Données réelles depuis votre API</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["", "block", "review", "allow"].map(f => (
                  <button key={f} onClick={() => { setFilter(f); reloadTransactions(f) }}
                    style={{
                      background: filter === f ? "rgba(0,229,255,0.1)" : "transparent",
                      border: `1px solid ${filter === f ? "#00e5ff" : "#1e2d3d"}`,
                      color: filter === f ? "#00e5ff" : "#5a7a8a",
                      padding: "0.3rem 0.8rem", borderRadius: 6, fontSize: "0.75rem",
                      cursor: "pointer", fontFamily: "'Syne', sans-serif"
                    }}>
                    {f || "Toutes"}
                  </button>
                ))}
              </div>
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#5a7a8a" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.8rem" }}>📭</div>
                <div style={{ fontWeight: 700 }}>Aucune transaction pour l'instant</div>
                <div style={{ fontSize: "0.82rem", marginTop: "0.3rem" }}>Envoyez votre première requête à <code style={{ color: "#00e5ff" }}>POST /v1/analyze</code></div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["ID", "User", "Montant", "Pays", "Score", "Décision", "Heure"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#5a7a8a", padding: "0.6rem 0.8rem", borderBottom: "1px solid #1e2d3d", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: "1px solid rgba(30,45,61,0.5)" }}>
                      <td style={{ padding: "0.9rem 0.8rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#00e5ff" }}>{tx.transaction_id}</td>
                      <td style={{ padding: "0.9rem 0.8rem", fontFamily: "monospace", fontSize: "0.72rem" }}>{tx.user_id}</td>
                      <td style={{ padding: "0.9rem 0.8rem", fontWeight: 700, fontSize: "0.85rem" }}>€{tx.amount.toLocaleString()}</td>
                      <td style={{ padding: "0.9rem 0.8rem", fontSize: "0.82rem" }}>{tx.country || "—"}</td>
                      <td style={{ padding: "0.9rem 0.8rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <div style={{ flex: 1, height: 4, background: "#1e2d3d", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${tx.fraud_score * 100}%`, background: decisionColor(tx.decision), borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: decisionColor(tx.decision), width: 30 }}>{tx.fraud_score.toFixed(2)}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.9rem 0.8rem" }}>
                        <span style={{ background: `${decisionColor(tx.decision)}22`, color: decisionColor(tx.decision), padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700, fontFamily: "monospace" }}>
                          {decisionLabel(tx.decision)}
                        </span>
                      </td>
                      <td style={{ padding: "0.9rem 0.8rem", fontSize: "0.72rem", color: "#5a7a8a", fontFamily: "monospace" }}>{timeAgo(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
