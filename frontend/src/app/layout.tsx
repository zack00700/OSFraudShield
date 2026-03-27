import type { Metadata } from "next"
import { AuthProvider } from "@/lib/auth-context"

export const metadata: Metadata = {
  title: "FraudShield — Fraud Detection API",
  description: "Protect your marketplace from fraud in real-time",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body style={{ margin: 0, background: "#080c10", color: "#e8f4f8", fontFamily: "'Syne', sans-serif" }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
