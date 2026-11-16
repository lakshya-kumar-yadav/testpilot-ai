import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "./api";

export type User = { id: string; email: string; displayName: string; createdAt: string };
type AuthResponse = { data: { user: User; accessToken: string; tokenType: "Bearer"; expiresIn: number } };
type MeResponse = { data: { user: User } };
type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "testpilot_access_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let active = true;
    apiRequest<MeResponse>("/api/auth/me", {}, accessToken)
      .then((response) => { if (active) setUser(response.data.user); })
      .catch(() => {
        if (active) {
          sessionStorage.removeItem(TOKEN_KEY);
          setAccessToken(null);
          setUser(null);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken]);

  async function authenticate(path: "/api/auth/login" | "/api/auth/register", body: object) {
    const response = await apiRequest<AuthResponse>(path, { method: "POST", body: JSON.stringify(body) });
    sessionStorage.setItem(TOKEN_KEY, response.data.accessToken);
    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
  }

  async function login(email: string, password: string) {
    await authenticate("/api/auth/login", { email, password });
  }
  async function register(displayName: string, email: string, password: string) {
    await authenticate("/api/auth/register", { displayName, email, password });
  }
  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ user, accessToken, loading, login, register, logout }), [user, accessToken, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
