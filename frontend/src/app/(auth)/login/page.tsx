"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.message || "Erreur de connexion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#080c10",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif", padding: "1rem"
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#e8f4f8" }}>
            Fraud<span style={{ color: "#00e5ff" }}>Shield</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#5a7a8a", marginTop: "0.3rem", fontFamily: "monospace" }}>
            fraud detection API
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#0d1117", border: "1px solid #1e2d3d",
          borderRadius: "16px", padding: "2rem"
        }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.3rem", color: "#e8f4f8" }}>
            Connexion
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#5a7a8a", marginBottom: "1.8rem" }}>
            Pas encore de compte ?{" "}
            <Link href="/register" style={{ color: "#00e5ff", textDecoration: "none" }}>
              Créer un compte
            </Link>
          </p>

          {error && (
            <div style={{
              background: "rgba(255,61,107,0.1)", border: "1px solid rgba(255,61,107,0.3)",
              borderRadius: "8px", padding: "0.8rem 1rem", marginBottom: "1.2rem",
              color: "#ff3d6b", fontSize: "0.85rem"
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#5a7a8a", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="vous@entreprise.com"
                style={{
                  width: "100%", background: "#111820", border: "1px solid #1e2d3d",
                  borderRadius: "8px", padding: "0.75rem 1rem", color: "#e8f4f8",
                  fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                  fontFamily: "monospace"
                }}
                onFocus={e => e.target.style.borderColor = "#00e5ff"}
                onBlur={e => e.target.style.borderColor = "#1e2d3d"}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#5a7a8a", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>
                Mot de passe
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••"
                style={{
                  width: "100%", background: "#111820", border: "1px solid #1e2d3d",
                  borderRadius: "8px", padding: "0.75rem 1rem", color: "#e8f4f8",
                  fontSize: "0.9rem", outline: "none", boxSizing: "border-box"
                }}
                onFocus={e => e.target.style.borderColor = "#00e5ff"}
                onBlur={e => e.target.style.borderColor = "#1e2d3d"}
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                background: loading ? "#1e2d3d" : "#00e5ff",
                color: loading ? "#5a7a8a" : "#080c10",
                border: "none", borderRadius: "8px", padding: "0.85rem",
                fontWeight: 800, fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Syne', sans-serif", transition: "all 0.2s", marginTop: "0.5rem"
              }}
            >
              {loading ? "Connexion..." : "Se connecter →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
