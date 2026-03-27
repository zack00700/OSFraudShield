"use client"
import { useEffect, useState } from "react"
import { useRequireAuth } from "@/lib/auth-context"
import { dashboardAPI } from "@/lib/api"

export default function TransactionsPage() {
  useRequireAuth()
  const [txs, setTxs] = useState<any[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)

  const load = (decision = "") => {
    setLoading(true)
    dashboardAPI.getTransactions(100, decision || undefined)
      .then(d => setTxs(d.transactions))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const dColor = (d: string) => d === "block" ? "#ff3d6b" : d === "review" ? "#ffd700" : "#00ff88"

  return (
    <div style={{ padding: "2rem", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Transactions</h1>
          <p style={{ fontSize: "0.8rem", color: "#5a7a8a", marginTop: "0.2rem" }}>Données réelles depuis votre API</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["", "block", "review", "allow"].map(f => (
            <button key={f} onClick={() => { setFilter(f); load(f) }} style={{
              background: filter === f ? "rgba(0,229,255,0.1)" : "transparent",
              border: `1px solid ${filter === f ? "#00e5ff" : "#1e2d3d"}`,
              color: filter === f ? "#00e5ff" : "#5a7a8a",
              padding: "0.35rem 0.8rem", borderRadius: 6, fontSize: "0.75rem",
              cursor: "pointer", fontFamily: "'Syne', sans-serif"
            }}>
              {f || "Toutes"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#5a7a8a", fontFamily: "monospace" }}>Chargement...</div>
        ) : txs.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#5a7a8a" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.8rem" }}>📭</div>
            <div style={{ fontWeight: 700 }}>Aucune transaction</div>
            <div style={{ fontSize: "0.82rem", marginTop: "0.3rem" }}>Envoyez des requêtes à <code style={{ color: "#00e5ff" }}>POST /v1/analyze</code></div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["ID Transaction", "User", "Montant", "Pays", "Score", "Décision", "Date"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#5a7a8a", padding: "0.8rem 1rem", borderBottom: "1px solid #1e2d3d", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txs.map(tx => (
                <tr key={tx.id} style={{ borderBottom: "1px solid rgba(30,45,61,0.4)" }}>
                  <td style={{ padding: "0.85rem 1rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#00e5ff" }}>{tx.transaction_id}</td>
                  <td style={{ padding: "0.85rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{tx.user_id}</td>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 700 }}>€{tx.amount.toLocaleString()}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.82rem" }}>{tx.country || "—"}</td>
                  <td style={{ padding: "0.85rem 1rem", fontFamily: "monospace", fontSize: "0.78rem", color: dColor(tx.decision), fontWeight: 700 }}>{tx.fraud_score.toFixed(3)}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span style={{ background: `${dColor(tx.decision)}22`, color: dColor(tx.decision), padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, fontFamily: "monospace" }}>
                      {tx.decision.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.72rem", color: "#5a7a8a", fontFamily: "monospace" }}>
                    {new Date(tx.created_at).toLocaleString("fr")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
