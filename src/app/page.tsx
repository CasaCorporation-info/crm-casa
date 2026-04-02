"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

type AgentStats = {
  agent_id: string;
  agent_name: string;
  worked_contacts: number;
  activities: number;
  calls: number;
  whatsapp: number;
  emails: number;
  meetings: number;
  notes: number;
  news: number;
  valuations: number;
  listings: number;
};

type DashboardStats = {
  contactedToday: number;
  contactedWeek: number;
  totalActivities: number;
  newLeads: number;
  valuations: number;
  listings: number;
};

export default function DashboardPage() {
  const auth = useAuthContext();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats>({
    contactedToday: 0,
    contactedWeek: 0,
    totalActivities: 0,
    newLeads: 0,
    valuations: 0,
    listings: 0,
  });

  const [agents, setAgents] = useState<AgentStats[]>([]);

  const role = String(auth.role || "").toLowerCase();

  const isAdmin = role === "admin" || role === "manager";

  useEffect(() => {
    loadDashboard();
  }, [auth.userId]);

  async function loadDashboard() {
    if (!auth.userId || !auth.organizationId) return;

    setLoading(true);

    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();

    const week = new Date();
    week.setDate(week.getDate() - 7);
    const weekStart = week.toISOString();

    let activityQuery = supabase
      .from("contact_activities")
      .select("activity_type, created_at, contact_id, created_by");

    if (!isAdmin) {
      activityQuery = activityQuery.eq("created_by", auth.userId);
    }

    const { data: activities } = await activityQuery;

    let contactedToday = 0;
    let contactedWeek = 0;
    const totalActivities = activities?.length || 0;

    const agentMap: Record<string, AgentStats> = {};

    activities?.forEach((a) => {
      const created = new Date(a.created_at);

      if (created >= new Date(todayStart)) contactedToday++;
      if (created >= new Date(weekStart)) contactedWeek++;

      const agentId = a.created_by || "unknown";

      if (!agentMap[agentId]) {
        agentMap[agentId] = {
          agent_id: agentId,
          agent_name: "Agente",
          worked_contacts: 0,
          activities: 0,
          calls: 0,
          whatsapp: 0,
          emails: 0,
          meetings: 0,
          notes: 0,
          news: 0,
          valuations: 0,
          listings: 0,
        };
      }

      const agent = agentMap[agentId];

      agent.activities++;

      if (a.activity_type === "call") agent.calls++;
      if (a.activity_type === "whatsapp") agent.whatsapp++;
      if (a.activity_type === "email") agent.emails++;
      if (a.activity_type === "meeting") agent.meetings++;
      if (a.activity_type === "note") agent.notes++;
    });

    const { data: contacts } = await supabase
      .from("contacts")
      .select("lead_status,assigned_agent_id");

    let newLeads = 0;
    let valuations = 0;
    let listings = 0;

    contacts?.forEach((c) => {
      if (c.lead_status === "nuovo") newLeads++;

      if (c.lead_status === "valutazione effettuata") valuations++;

      if (c.lead_status === "incarico preso") listings++;

      const agentId = c.assigned_agent_id;

      if (agentId && agentMap[agentId]) {
        agentMap[agentId].worked_contacts++;
      }
    });

    setStats({
      contactedToday,
      contactedWeek,
      totalActivities,
      newLeads,
      valuations,
      listings,
    });

    setAgents(Object.values(agentMap));

    setLoading(false);
  }

  return (
    <div className="crm-page">
      <div
        style={{
          marginBottom: 24,
        }}
      >
        <h1 className="crm-page-title">Dashboard</h1>
        <div className="crm-page-subtitle">Panoramica operativa del CRM</div>
      </div>

      {loading && <div>Caricamento...</div>}

      {!loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            <Stat title="Contatti lavorati oggi" value={stats.contactedToday} />
            <Stat
              title="Contatti lavorati settimana"
              value={stats.contactedWeek}
            />
            <Stat title="Attività totali" value={stats.totalActivities} />
            <Stat title="Lead nuovi" value={stats.newLeads} />
            <Stat title="Valutazioni fatte" value={stats.valuations} />
            <Stat title="Incarichi presi" value={stats.listings} />
          </div>

          <div
            className="crm-card"
            style={{
              marginTop: 24,
              padding: 16,
              overflowX: "auto",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: 20,
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Performance agenti
            </h2>

            <table
              style={{
                width: "100%",
                minWidth: 760,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <TableHeadCell>Agente</TableHeadCell>
                  <TableHeadCell>Contatti lavorati</TableHeadCell>
                  <TableHeadCell>Attività</TableHeadCell>
                  <TableHeadCell>Chiamate</TableHeadCell>
                  <TableHeadCell>WhatsApp</TableHeadCell>
                  <TableHeadCell>Email</TableHeadCell>
                  <TableHeadCell>Incontri</TableHeadCell>
                  <TableHeadCell>Note</TableHeadCell>
                </tr>
              </thead>

              <tbody>
                {agents.map((a) => (
                  <tr key={a.agent_id}>
                    <TableCell>{a.agent_name}</TableCell>
                    <TableCell>{a.worked_contacts}</TableCell>
                    <TableCell>{a.activities}</TableCell>
                    <TableCell>{a.calls}</TableCell>
                    <TableCell>{a.whatsapp}</TableCell>
                    <TableCell>{a.emails}</TableCell>
                    <TableCell>{a.meetings}</TableCell>
                    <TableCell>{a.notes}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div
      className="crm-card"
      style={{
        padding: 18,
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          opacity: 0.7,
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          lineHeight: 1,
          marginTop: 12,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableHeadCell({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        borderBottom: "1px solid #e2e8f0",
        fontSize: 13,
        fontWeight: 700,
        color: "#475569",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        borderBottom: "1px solid #e2e8f0",
        fontSize: 14,
        color: "#0f172a",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}