"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState({
    full_name: "", company_name: "", email: "", password: ""
  })
  const [apiKeys, setApiKeys] = useState<{ production: string; test: string } | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const data = await register(form)
      // Afficher les clés API avant de rediriger
      setApiKeys({
        production: data.client.api_key_production,
        test: data.client.api_key_test,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(""), 2000)
  }

  // Après inscription — afficher les clés API
  if (apiKeys) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne', sans-serif", padding: "1rem" }}>
        <div style={{ width: "100%", maxWidth: "500px" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
            <h1 style={{ color: "#e8f4f8", fontSize: "1.4rem", fontWeight: 800 }}>Compte créé !</h1>
            <p style={{ color: "#5a7a8a", fontSize: "0.85rem", marginTop: "0.3rem" }}>
              Sauvegardez vos clés API maintenant — elles ne seront plus affichées.
            </p>
          </div>

          <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem" }}>
            {[
              { label: "Clé de production", val: apiKeys.production, key: "prod" },
              { label: "Clé de test", val: apiKeys.test, key: "test" },
            ].map(({ label, val, key }) => (
              <div key={key} style={{ marginBottom: "1.2rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#5a7a8a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                  {label}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <div style={{ flex: 1, background: "#111820", border: "1px solid #1e2d3d", borderRadius: "6px", padding: "0.6rem 0.8rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#00e5ff", wordBreak: "break-all" }}>
                    {val}
                  </div>
                  <button
                    onClick={() => copy(val, key)}
                    style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.3)", color: "#00e5ff", borderRadius: "6px", padding: "0.5rem 0.8rem", cursor: "pointer", fontSize: "0.75rem", fontFamily: "monospace", whiteSpace: "nowrap" }}
                  >
                    {copied === key ? "✓" : "Copier"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Link href="/dashboard">
            <button style={{ width: "100%", background: "#00e5ff", color: "#080c10", border: "none", borderRadius: "8px", padding: "0.9rem", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
              Aller au dashboard →
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne', sans-serif", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#e8f4f8" }}>
            Fraud<span style={{ color: "#00e5ff" }}>Shield</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#5a7a8a", marginTop: "0.3rem", fontFamily: "monospace" }}>14 jours gratuits</div>
        </div>

        <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: "16px", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.3rem", color: "#e8f4f8" }}>Créer un compte</h1>
          <p style={{ fontSize: "0.85rem", color: "#5a7a8a", marginBottom: "1.8rem" }}>
            Déjà un compte ?{" "}
            <Link href="/login" style={{ color: "#00e5ff", textDecoration: "none" }}>Se connecter</Link>
          </p>

          {error && (
            <div style={{ background: "rgba(255,61,107,0.1)", border: "1px solid rgba(255,61,107,0.3)", borderRadius: "8px", padding: "0.8rem 1rem", marginBottom: "1.2rem", color: "#ff3d6b", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { key: "full_name", label: "Nom complet", type: "text", placeholder: "Jean Dupont" },
              { key: "company_name", label: "Entreprise", type: "text", placeholder: "Acme Corp" },
              { key: "email", label: "Email", type: "email", placeholder: "vous@entreprise.com" },
              { key: "password", label: "Mot de passe", type: "password", placeholder: "8 caractères minimum" },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#5a7a8a", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  required placeholder={field.placeholder}
                  style={{ width: "100%", background: "#111820", border: "1px solid #1e2d3d", borderRadius: "8px", padding: "0.75rem 1rem", color: "#e8f4f8", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#00e5ff"}
                  onBlur={e => e.target.style.borderColor = "#1e2d3d"}
                />
              </div>
            ))}

            <button
              type="submit" disabled={loading}
              style={{ background: loading ? "#1e2d3d" : "#00e5ff", color: loading ? "#5a7a8a" : "#080c10", border: "none", borderRadius: "8px", padding: "0.85rem", fontWeight: 800, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Syne', sans-serif", marginTop: "0.5rem" }}
            >
              {loading ? "Création..." : "Créer mon compte →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
