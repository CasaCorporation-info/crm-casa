"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

type DashboardStats = {
  totalContacts: number;
  workedContacts: number;
  neverContacted: number;
  contactedToday: number;
  assignedToMe: number;
  unassignedContacts: number;
};

export default function DashboardPage() {
  const auth = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    workedContacts: 0,
    neverContacted: 0,
    contactedToday: 0,
    assignedToMe: 0,
    unassignedContacts: 0,
  });

  const currentUserId = auth.userId;
  const currentOrganizationId = auth.organizationId;
  const currentRole = String(auth.role || "").trim().toLowerCase();
  const authReady = !auth.loading;

  const isAdminLike = currentRole === "admin" || currentRole === "manager";
  const isAgentOnly = currentRole === "agent";

  useEffect(() => {
    async function loadDashboard() {
      if (!authReady) return;

      if (!auth.isAuthenticated || !currentUserId) {
        setLoading(false);
        setErrorMsg("Utente non autenticato.");
        return;
      }

      if (!currentOrganizationId) {
        setLoading(false);
        setErrorMsg("organization_id utente mancante.");
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      let contactsQuery = supabase
        .from("contacts")
        .select(
          "id, assigned_agent_id, lead_status, last_contact_at, created_at"
        )
        .eq("organization_id", currentOrganizationId);

      if (isAgentOnly) {
        contactsQuery = contactsQuery.eq("assigned_agent_id", currentUserId);
      }

      const { data, error } = await contactsQuery;

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const rows = data || [];
      const today = new Date();
      const todayY = today.getFullYear();
      const todayM = today.getMonth();
      const todayD = today.getDate();

      let totalContacts = 0;
      let workedContacts = 0;
      let neverContacted = 0;
      let contactedToday = 0;
      let assignedToMe = 0;
      let unassignedContacts = 0;

      for (const row of rows as any[]) {
        totalContacts += 1;

        const assignedAgentId = row.assigned_agent_id || null;
        const leadStatus = String(row.lead_status || "")
          .trim()
          .toLowerCase();
        const lastContactAt = row.last_contact_at || null;

        if (assignedAgentId && String(assignedAgentId) === String(currentUserId)) {
          assignedToMe += 1;
        }

        if (!assignedAgentId) {
          unassignedContacts += 1;
        }

        if (lastContactAt) {
          workedContacts += 1;

          const dt = new Date(lastContactAt);
          if (
            dt.getFullYear() === todayY &&
            dt.getMonth() === todayM &&
            dt.getDate() === todayD
          ) {
            contactedToday += 1;
          }
        }

        if (!lastContactAt || leadStatus === "nuovo") {
          neverContacted += 1;
        }
      }

      setStats({
        totalContacts,
        workedContacts,
        neverContacted,
        contactedToday,
        assignedToMe,
        unassignedContacts,
      });

      setLoading(false);
    }

    loadDashboard();
  }, [
    authReady,
    auth.isAuthenticated,
    currentUserId,
    currentOrganizationId,
    isAgentOnly,
  ]);

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ marginBottom: 10 }}>Dashboard</h1>

      <div style={{ opacity: 0.7, marginBottom: 26 }}>
        {auth.fullName
          ? `Benvenuto, ${auth.fullName}`
          : "Panoramica CRM della tua organization"}
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <b>Errore:</b> {errorMsg}
        </div>
      )}

      <div style={gridStyle}>
        <StatBox
          title="Contatti in gestione"
          value={loading ? "..." : String(stats.totalContacts)}
        />
        <StatBox
          title="Contatti lavorati"
          value={loading ? "..." : String(stats.workedContacts)}
        />
        <StatBox
          title="Mai contattati"
          value={loading ? "..." : String(stats.neverContacted)}
        />
        <StatBox
          title="Contattati oggi"
          value={loading ? "..." : String(stats.contactedToday)}
        />
        <StatBox
          title="Assegnati a me"
          value={loading ? "..." : String(stats.assignedToMe)}
        />
        <StatBox
          title="Non assegnati"
          value={loading ? "..." : String(stats.unassignedContacts)}
        />
      </div>

      <div style={{ marginTop: 40 }}>
        <div style={todayBox}>
          <h2 style={{ margin: 0 }}>Riepilogo rapido</h2>

          <div style={{ marginTop: 14, lineHeight: 1.8 }}>
            <div>
              Ruolo: <b>{auth.role || "-"}</b>
            </div>
            <div>
              Organization: <b>{auth.organizationId || "-"}</b>
            </div>
            <div>
              Vista:{" "}
              <b>{isAdminLike ? "globale organization" : "solo miei contatti"}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ title, value }: { title: string; value: string }) {
  return (
    <div style={boxStyle}>
      <p style={boxTitle}>{title}</p>
      <p style={boxValue}>{value}</p>
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
};

const boxStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 12,
  padding: 20,
  border: "1px solid #e5e5e5",
};

const boxTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#666",
};

const boxValue: React.CSSProperties = {
  marginTop: 10,
  fontSize: 32,
  fontWeight: "bold",
};

const todayBox: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 12,
  padding: 30,
  border: "1px solid #e5e5e5",
  maxWidth: 520,
};