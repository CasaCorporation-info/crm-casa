"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, fullName } = useAuthContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const normalizedRole = String(role || "").trim().toLowerCase();

  const canSeeTemplates =
    normalizedRole === "admin" ||
    normalizedRole === "agent" ||
    normalizedRole === "manager";

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function toggleKpiMenu() {
    setKpiOpen((prev) => !prev);
  }

  return (
    <div className="crm-shell">
      <button
        type="button"
        className="crm-mobile-menu-button"
        onClick={() => setSidebarOpen(true)}
      >
        Menu
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="crm-sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Chiudi menu"
        />
      )}

      <aside className={`crm-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="crm-sidebar-header">
          <div className="crm-logo">Casa Corporation</div>
          <div className="crm-logo-sub">CRM</div>

          {fullName && (
            <div className="crm-user">
              {fullName} · {normalizedRole || "user"}
            </div>
          )}
        </div>

        <nav className="crm-sidebar-nav">
          <Link href="/" className="crm-sidebar-link" onClick={closeSidebar}>
            Dashboard
          </Link>

          <Link
            href="/contacts"
            className="crm-sidebar-link"
            onClick={closeSidebar}
          >
            Lead
          </Link>

          <Link
            href="/pipeline"
            className="crm-sidebar-link"
            onClick={closeSidebar}
          >
            Pipeline
          </Link>

          {canSeeTemplates && (
            <Link
              href="/admin/templates"
              className="crm-sidebar-link"
              onClick={closeSidebar}
            >
              Templates
            </Link>
          )}

          <div className="crm-sidebar-section">
            <button
              type="button"
              onClick={toggleKpiMenu}
              className="crm-sidebar-link"
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              aria-expanded={kpiOpen}
            >
              <span>KPI</span>
              <span>{kpiOpen ? "▾" : "▸"}</span>
            </button>

            {kpiOpen && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginLeft: "12px",
                }}
              >
                <Link
                  href="/whatsapp-analytics"
                  className="crm-sidebar-link"
                  onClick={closeSidebar}
                >
                  WhatsApp Analytics
                </Link>

                <Link
                  href="/lead-tracking"
                  className="crm-sidebar-link"
                  onClick={closeSidebar}
                >
                  Tracciamento Leads
                </Link>

                <Link
                  href="/kpi/privati"
                  className="crm-sidebar-link"
                  onClick={closeSidebar}
                >
                  Privati Analytics
                </Link>

                <Link
                  href="/contact-alerts"
                  className="crm-sidebar-link"
                  onClick={closeSidebar}
                >
                  Alert IA
                </Link>
              </div>
            )}
          </div>

          {normalizedRole === "admin" && (
            <Link
              href="/admin/agents"
              className="crm-sidebar-link"
              onClick={closeSidebar}
            >
              Agenti
            </Link>
          )}

          <Link
            href="/valuator"
            className="crm-sidebar-link"
            onClick={closeSidebar}
          >
            Valutatore
          </Link>

          <Link
            href="/due-diligence"
            className="crm-sidebar-link"
            onClick={closeSidebar}
          >
            Due Diligence
          </Link>
        </nav>

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