"use client"
import { useEffect, useState } from "react"
import { useRequireAuth } from "@/lib/auth-context"
import { apiKeysAPI } from "@/lib/api"

export default function APIKeysPage() {
  useRequireAuth()
  const [keys, setKeys] = useState<any[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiKeysAPI.list().then(d => setKeys(d.api_keys)).finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!label.trim()) return
    const data = await apiKeysAPI.create(label, "production")
    setNewKey(data.api_key)
    setLabel("")
    apiKeysAPI.list().then(d => setKeys(d.api_keys))
  }

  const revoke = async (id: string) => {
    if (!confirm("Révoquer cette clé ?")) return
    await apiKeysAPI.revoke(id)
    setKeys(k => k.filter(x => x.id !== id))
  }

  const copy = (val: string) => {
    navigator.clipboard.writeText(val)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "'Syne', sans-serif" }}>
      <h1 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.3rem" }}>Clés API</h1>
      <p style={{ fontSize: "0.8rem", color: "#5a7a8a", marginBottom: "1.5rem" }}>Gérez vos accès à l'API</p>

      {/* Nouvelle clé affichée une seule fois */}
      {newKey && (
        <div style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 10, padding: "1.2rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#00ff88", marginBottom: "0.6rem" }}>
            ⚠️ Copiez cette clé maintenant — elle ne sera plus affichée
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <div style={{ flex: 1, fontFamily: "monospace", fontSize: "0.78rem", color: "#e8f4f8", background: "#111820", padding: "0.6rem 0.8rem", borderRadius: 6, wordBreak: "break-all" }}>
              {newKey}
            </div>
            <button onClick={() => copy(newKey)} style={{ background: "#00e5ff", border: "none", color: "#080c10", borderRadius: 6, padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
              {copied ? "✓" : "Copier"}
            </button>
          </div>
        </div>
      )}

      {/* Créer une nouvelle clé */}
      <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.8rem" }}>Créer une nouvelle clé</div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom de la clé (ex: Production app)" style={{ flex: 1, background: "#111820", border: "1px solid #1e2d3d", borderRadius: 8, padding: "0.65rem 1rem", color: "#e8f4f8", fontSize: "0.875rem", outline: "none", fontFamily: "'Syne', sans-serif" }} />
          <button onClick={create} disabled={!label.trim()} style={{ background: "#00e5ff", border: "none", color: "#080c10", borderRadius: 8, padding: "0.65rem 1.2rem", fontWeight: 800, fontSize: "0.875rem", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
            Créer
          </button>
        </div>
      </div>

      {/* Liste des clés */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {loading ? (
          <div style={{ color: "#5a7a8a", fontFamily: "monospace" }}>Chargement...</div>
        ) : keys.map(k => (
          <div key={k.id} style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 10, padding: "1rem 1.2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{k.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#5a7a8a", marginTop: "0.2rem" }}>{k.key_preview}</div>
              <div style={{ fontSize: "0.68rem", color: "#5a7a8a", marginTop: "0.2rem" }}>
                {k.last_used_at ? `Dernière utilisation: ${new Date(k.last_used_at).toLocaleDateString("fr")}` : "Jamais utilisée"}
              </div>
            </div>
            <span style={{ background: k.environment === "production" ? "rgba(0,229,255,0.1)" : "rgba(255,215,0,0.1)", color: k.environment === "production" ? "#00e5ff" : "#ffd700", padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.68rem", fontWeight: 700, fontFamily: "monospace" }}>
              {k.environment}
            </span>
            <button onClick={() => revoke(k.id)} style={{ background: "rgba(255,61,107,0.1)", border: "1px solid rgba(255,61,107,0.2)", color: "#ff3d6b", borderRadius: 6, padding: "0.35rem 0.8rem", fontSize: "0.72rem", cursor: "pointer", fontFamily: "monospace" }}>
              Révoquer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
