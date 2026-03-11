"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 12,
  color: "#111",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
};

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setRole(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setRole(data?.role ?? null);
    }

    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const normalizedRole = String(role || "").trim().toLowerCase();
  const canSeeTemplates =
    normalizedRole === "admin" ||
    normalizedRole === "agent" ||
    normalizedRole === "manager";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #e5e7eb",
          background: "#fff",
          padding: 20,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            Casa Corporation
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
            CRM
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 18,
          }}
        >
          <Link href="/" style={linkStyle}>
            Dashboard
          </Link>

          <Link href="/contacts" style={linkStyle}>
            Lead
          </Link>

          <Link href="/pipeline" style={linkStyle}>
            Pipeline
          </Link>

          {canSeeTemplates && (
            <Link href="/admin/templates" style={linkStyle}>
              Templates
            </Link>
          )}

          {normalizedRole === "admin" && (
            <Link href="/admin/agents" style={linkStyle}>
              Agenti
            </Link>
          )}

          <Link href="/valuator" style={linkStyle}>
            Valutatore
          </Link>

          <Link href="/due-diligence" style={linkStyle}>
            Due Diligence
          </Link>
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#111",
              fontWeight: 600,
              fontSize: 14,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main style={{ minWidth: 0 }}>{children}</main>
    </div>
  );
}