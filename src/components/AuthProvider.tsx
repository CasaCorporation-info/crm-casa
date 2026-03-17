"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  organizationId: string | null;
  role: string | null;
  fullName: string | null;
  refreshProfile: () => Promise<void>;
};

const defaultAuthContextValue: AuthContextValue = {
  loading: true,
  isAuthenticated: false,
  userId: null,
  organizationId: null,
  role: null,
  fullName: null,
  refreshProfile: async () => {},
};

const AuthContext = createContext<AuthContextValue>(defaultAuthContextValue);

function normalizeRole(role: unknown): string | null {
  if (typeof role !== "string") return null;

  const value = role.trim().toLowerCase();
  return value || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AuthContextValue>(defaultAuthContextValue);

  const loadAuthContext = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setValue((prev) => ({
        ...prev,
        loading: false,
        isAuthenticated: false,
        userId: null,
        organizationId: null,
        role: null,
        fullName: null,
      }));
      return;
    }

    const userId = session.user.id;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, organization_id, role, full_name")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      setValue((prev) => ({
        ...prev,
        loading: false,
        isAuthenticated: true,
        userId,
        organizationId: null,
        role: null,
        fullName: null,
      }));
      return;
    }

    setValue((prev) => ({
      ...prev,
      loading: false,
      isAuthenticated: true,
      userId,
      organizationId: profile.organization_id ?? null,
      role: normalizeRole(profile.role),
      fullName: profile.full_name?.trim() || null,
    }));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function safeLoad() {
      if (!isMounted) return;

      setValue((prev) => ({
        ...prev,
        loading: true,
      }));

      await loadAuthContext();

      if (!isMounted) return;
    }

    safeLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      safeLoad();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadAuthContext]);

  const refreshProfile = useCallback(async () => {
    setValue((prev) => ({
      ...prev,
      loading: true,
    }));

    await loadAuthContext();
  }, [loadAuthContext]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...value,
      refreshProfile,
    }),
    [value, refreshProfile]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}