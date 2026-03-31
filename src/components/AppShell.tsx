"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, fullName } = useAuthContext();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const normalizedRole = String(role || "").trim().toLowerCase();

  const canSeeTemplates =
    normalizedRole === "admin" ||
    normalizedRole === "agent" ||
    normalizedRole === "manager";

  const canSeeWhatsAppAnalytics =
    normalizedRole === "admin" ||
    normalizedRole === "agent" ||
    normalizedRole === "manager";

  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        {/* HEADER */}
        <div className="crm-sidebar-header">
          <div className="crm-logo">Casa Corporation</div>
          <div className="crm-logo-sub">CRM</div>

          {fullName && (
            <div className="crm-user">
              {fullName} · {normalizedRole || "user"}
            </div>
          )}
        </div>

        {/* NAV */}
        <nav className="crm-sidebar-nav">
          <Link href="/" className="crm-sidebar-link">
            Dashboard
          </Link>

          <Link href="/contacts" className="crm-sidebar-link">
            Lead
          </Link>

          <Link href="/pipeline" className="crm-sidebar-link">
            Pipeline
          </Link>

          {canSeeTemplates && (
            <Link href="/admin/templates" className="crm-sidebar-link">
              Templates
            </Link>
          )}

          {canSeeWhatsAppAnalytics && (
            <Link href="/whatsapp-analytics" className="crm-sidebar-link">
              WhatsApp Analytics
            </Link>
          )}

          {normalizedRole === "admin" && (
            <Link href="/admin/agents" className="crm-sidebar-link">
              Agenti
            </Link>
          )}

          <Link href="/valuator" className="crm-sidebar-link">
            Valutatore
          </Link>

          <Link href="/due-diligence" className="crm-sidebar-link">
            Due Diligence
          </Link>
        </nav>

        {/* FOOTER */}
        <div className="crm-sidebar-footer">
          <button onClick={handleLogout} className="crm-button-secondary">
            Logout
          </button>
        </div>
      </aside>

      <main className="crm-main">{children}</main>
    </div>
  );
}