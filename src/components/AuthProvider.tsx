"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  organizationId: string | null;
  role: string | null;
  fullName: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  isAuthenticated: false,
  userId: null,
  organizationId: null,
  role: null,
  fullName: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AuthContextValue>({
    loading: true,
    isAuthenticated: false,
    userId: null,
    organizationId: null,
    role: null,
    fullName: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadAuthContext() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        setValue({
          loading: false,
          isAuthenticated: false,
          userId: null,
          organizationId: null,
          role: null,
          fullName: null,
        });
        return;
      }

      const userId = session.user.id;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, organization_id, role, full_name")
        .eq("id", userId)
        .single();

      if (!mounted) return;

      if (error || !profile) {
        setValue({
          loading: false,
          isAuthenticated: true,
          userId,
          organizationId: null,
          role: null,
          fullName: null,
        });
        return;
      }

      setValue({
        loading: false,
        isAuthenticated: true,
        userId,
        organizationId: profile.organization_id ?? null,
        role: profile.role ?? null,
        fullName: profile.full_name ?? null,
      });
    }

    loadAuthContext();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthContext();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}