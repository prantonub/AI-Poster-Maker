"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiClient } from "@/lib/apiClient";
import { AuthUser, AuthResponse } from "@/lib/authTypes";

const TOKEN_KEY = "poster-maker-token";
const USER_KEY = "poster-maker-user";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  /** Resolves with the signed-in user so callers can route by role. */
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session from localStorage on first mount.
  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedUser = window.localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const persistSession = useCallback((data: AuthResponse) => {
    window.localStorage.setItem(TOKEN_KEY, data.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const { data } = await apiClient.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      persistSession(data);
      return data.user;
    },
    [persistSession]
  );

  const register = useCallback(
    async (name: string, email: string, phone: string, password: string) => {
      const { data } = await apiClient.post<AuthResponse>("/auth/register", {
        name,
        email,
        phone,
        password,
      });
      persistSession(data);
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
