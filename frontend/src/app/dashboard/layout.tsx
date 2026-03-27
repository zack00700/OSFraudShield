"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, useRequireAuth } from "@/lib/auth-context"

function Sidebar() {
  const { logout, client } = useAuth()
  const pathname = usePathname()

  const links = [
    { href: "/dashboard", label: "Vue d'ensemble", icon: "📊" },
    { href: "/dashboard/transactions", label: "Transactions", icon: "⚡" },
    { href: "/dashboard/alerts", label: "Alertes", icon: "🚨" },
    { href: "/dashboard/apikeys", label: "Clés API", icon: "🔑" },
  ]

  return (
    <aside style={{ width: 240, minHeight: "100vh", background: "#0d1117", borderRight: "1px solid #1e2d3d", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 50 }}>
      <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #1e2d3d" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#e8f4f8" }}>
          Fraud<span style={{ color: "#00e5ff" }}>Shield</span>
        </div>
        <div style={{ fontSize: "0.6rem", fontFamily: "monospace", color: "#5a7a8a", marginTop: "0.2rem" }}>Dashboard v1.0</div>
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
            }}>
              <span>{link.icon}</span>
              <span>{link.label}</span>
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
        <button onClick={logout} style={{ width: "100%", background: "transparent", border: "1px solid #1e2d3d", color: "#5a7a8a", borderRadius: 6, padding: "0.5rem", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useRequireAuth()

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#00e5ff", fontFamily: "monospace" }}>Chargement...</div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c10", color: "#e8f4f8", fontFamily: "'Syne', sans-serif" }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
