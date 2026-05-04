"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppShell from "@/components/AppShell";

type AuthGateProps = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isLoginPage = pathname === "/login";

  const isPublicPage =
    pathname?.startsWith("/v/") ||
    pathname?.startsWith("/vl/") ||
    pathname?.startsWith("/w/") ||
    pathname?.startsWith("/vpdf_") ||
    pathname?.startsWith("/valutazioni/holdingcasacorporation/");

  useEffect(() => {
    let mounted = true;

    if (isPublicPage) {
      setChecking(false);
      return;
    }

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const loggedIn = !!session;
      setIsAuthenticated(loggedIn);

      if (!loggedIn && !isLoginPage) {
        router.replace("/login");
        setChecking(false);
        return;
      }

      if (loggedIn && isLoginPage) {
        router.replace("/");
        setChecking(false);
        return;
      }

      setChecking(false);
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isPublicPage) return;

      const loggedIn = !!session;
      setIsAuthenticated(loggedIn);

      if (!loggedIn && pathname !== "/login") {
        router.replace("/login");
        return;
      }

      if (loggedIn && pathname === "/login") {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname, isLoginPage, isPublicPage]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f7f9",
          color: "#111",
          fontSize: 16,
        }}
      >
        Verifica accesso...
      </div>
    );
  }

  if (!isAuthenticated && !isLoginPage) {
    return null;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}