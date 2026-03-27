"use client"
// lib/auth-context.tsx — Context d'authentification global

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { authAPI, clearTokens } from "./api"
import { useRouter } from "next/navigation"

interface Client {
  id: string
  email: string
  company_name: string
  full_name: string
  plan: string
  monthly_quota: number
  monthly_calls: number
}

interface AuthContextType {
  client: Client | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<any>
  logout: () => Promise<void>
  refreshClient: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Charger le client au démarrage
  useEffect(() => {
    const stored = localStorage.getItem("client")
    const token = localStorage.getItem("access_token")
    if (stored && token) {
      setClient(JSON.parse(stored))
      // Vérifier que le token est encore valide
      authAPI.me()
        .then(data => {
          setClient(data)
          localStorage.setItem("client", JSON.stringify(data))
        })
        .catch(() => {
          clearTokens()
          setClient(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password)
    setClient(data.client)
    router.push("/dashboard")
  }

  const register = async (formData: any) => {
    const data = await authAPI.register(formData)
    setClient(data.client)
    router.push("/dashboard")
    return data
  }

  const logout = async () => {
    await authAPI.logout()
    setClient(null)
    router.push("/login")
  }

  const refreshClient = async () => {
    const data = await authAPI.me()
    setClient(data)
    localStorage.setItem("client", JSON.stringify(data))
  }

  return (
    <AuthContext.Provider value={{
      client,
      isLoading,
      isAuthenticated: !!client,
      login,
      register,
      logout,
      refreshClient,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider")
  return ctx
}

// Hook pour protéger les pages
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading])
  return { isLoading }
}
