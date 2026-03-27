"use client"
import { useEffect, useState } from "react"
import { useRequireAuth } from "@/lib/auth-context"
import { dashboardAPI } from "@/lib/api"

export default function AlertsPage() {
  useRequireAuth()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.getAlerts(50)
      .then(d => setAlerts(d.alerts))
      .finally(() => setLoading(false))
  }, [])

  const resolve = async (id: string) => {
    await dashboardAPI.resolveAlert(id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  const riskColor = (r: string) =>
    r === "critical" ? "#ff3d6b" : r === "high" ? "#ff8c5a" : "#ffd700"

  return (
    <div style={{ padding: "2rem", fontFamily: "'Syne', sans-serif" }}>
      <h1 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.3rem" }}>Alertes actives</h1>
      <p style={{ fontSize: "0.8rem", color: "#5a7a8a", marginBottom: "1.5rem" }}>
        {alerts.length} alerte{alerts.length !== 1 ? "s" : ""} non résolue{alerts.length !== 1 ? "s" : ""}
      </p>

      {loading ? (
        <div style={{ color: "#5a7a8a", fontFamily: "monospace" }}>Chargement...</div>
      ) : alerts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#5a7a8a" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>✅</div>
          <div style={{ fontWeight: 700 }}>Aucune alerte active</div>
          <div style={{ fontSize: "0.82rem", marginTop: "0.3rem" }}>Tout est sous contrôle</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {alerts.map(a => (
            <div key={a.id} style={{
              background: "#0d1117", border: `1px solid #1e2d3d`,
              borderLeft: `3px solid ${riskColor(a.risk_level)}`,
              borderRadius: 8, padding: "1rem 1.2rem",
              display: "flex", alignItems: "center", gap: "1rem"
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: riskColor(a.risk_level) }}>
                  {a.triggered_rules.join(" · ")}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#5a7a8a", marginTop: "0.2rem" }}>
                  txn: {a.transaction_id} — {new Date(a.created_at).toLocaleString("fr")}
                </div>
              </div>
              <span style={{
                background: `${riskColor(a.risk_level)}22`,
                color: riskColor(a.risk_level),
                padding: "0.2rem 0.6rem", borderRadius: 4,
                fontSize: "0.68rem", fontWeight: 700, fontFamily: "monospace"
              }}>
                {a.risk_level.toUpperCase()}
              </span>
              <button onClick={() => resolve(a.id)} style={{
                background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.2)",
                color: "#00e5ff", borderRadius: 6, padding: "0.35rem 0.8rem",
                fontSize: "0.72rem", cursor: "pointer", fontFamily: "monospace"
              }}>
                Résoudre
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
