import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema.js";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);

  const { data, isLoading, error } = useQuery<User>({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await fetch("/auth/user");
      if (!response.ok) {
        throw new Error("Not authenticated");
      }
      return response.json() as Promise<User>;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    } else if (error) {
      setUser(null);
    }
  }, [data, error]);

  const login = (): void => {
    window.location.href = "/auth/google";
  };

  const logout = async (): Promise<void> => {
    try {
      // Get CSRF token first
      const csrfResponse = await fetch("/auth/csrf-token", { credentials: "include" });
      const { csrfToken } = await csrfResponse.json() as { csrfToken: string };

      // Make logout request with CSRF token
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
      });

      // Server clears the auth cookie, just redirect
      window.location.href = "/login";
    } catch {
      // If logout fails, still redirect (server might have cleared cookie anyway)
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
