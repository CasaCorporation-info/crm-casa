"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import {
  PIPELINE_STATUSES,
  type PipelineStatus,
} from "@/components/pipeline/constants";
import type { PipelineContact } from "@/components/pipeline/types";

type CurrentUserProfile = {
  id: string;
  role: string | null;
  organization_id: string | null;
};

type PipelineStatItem = {
  status: PipelineStatus;
  count: number;
};

type FilterMode =
  | "all"
  | "assigned"
  | "unassigned"
  | "with-name"
  | "with-phone";

const PIPELINE_VISIBLE_LIMIT = 5000;

function normalizeStatus(value: string | null | undefined): PipelineStatus {
  const normalized = String(value || "nuovo").trim().toLowerCase();
  return PIPELINE_STATUSES.find((status) => status === normalized) ?? "nuovo";
}

function getStatusChipColors(status: string) {
  const key = status.trim().toLowerCase();

  switch (key) {
    case "nuovo":
      return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
    case "contattato":
      return { bg: "#ccfbf1", color: "#0f766e", border: "#99f6e4" };
    case "informazione":
      return { bg: "#ede9fe", color: "#6d28d9", border: "#ddd6fe" };
    case "notizia":
      return { bg: "#cffafe", color: "#0e7490", border: "#a5f3fc" };
    case "valutazione fissata":
      return { bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
    case "valutazione effettuata":
      return { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" };
    case "incarico preso":
      return { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" };
    case "venduto":
      return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
    case "non interessato":
      return { bg: "#e2e8f0", color: "#475569", border: "#cbd5e1" };
    case "da eliminare":
      return { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" };
    default:
      return { bg: "#e2e8f0", color: "#334155", border: "#cbd5e1" };
  }
}

async function countContactsByStatus(
  organizationId: string | null,
  assignedAgentId?: string
): Promise<PipelineStatItem[]> {
  const results = await Promise.all(
    PIPELINE_STATUSES.map(async (status) => {
      let query = supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("lead_status", status);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      if (assignedAgentId) {
        query = query.eq("assigned_agent_id", assignedAgentId);
      }

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return {
        status,
        count: count ?? 0,
      };
    })
  );

  return results;
}

function hasName(contact: PipelineContact) {
  return Boolean(
    String(contact.first_name || "").trim() ||
      String(contact.last_name || "").trim()
  );
}

function hasPhone(contact: PipelineContact) {
  return Boolean(String(contact.phone_primary || "").trim());
}

function applyFilter(contacts: PipelineContact[], filterMode: FilterMode) {
  switch (filterMode) {
    case "assigned":
      return contacts.filter((contact) =>
        Boolean(String(contact.assigned_agent_id || "").trim())
      );
    case "unassigned":
      return contacts.filter(
        (contact) => !String(contact.assigned_agent_id || "").trim()
      );
    case "with-name":
      return contacts.filter(hasName);
    case "with-phone":
      return contacts.filter(hasPhone);
    case "all":
    default:
      return contacts;
  }
}

export default function PipelinePage() {
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [stats, setStats] = useState<PipelineStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingContactId, setMovingContactId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(
    null
  );
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  useEffect(() => {
    async function loadPipeline() {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setErrorMessage("Sessione non valida. Effettua di nuovo il login.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, organization_id")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        setErrorMessage("Impossibile caricare il profilo utente.");
        setLoading(false);
        return;
      }

      setCurrentUser(profile);

      const normalizedRole = String(profile.role || "").trim().toLowerCase();
      const isAdmin = normalizedRole === "admin";

      const assignedAgentId = isAdmin ? undefined : profile.id;

      const [statsResult, contactsResult] = await Promise.all([
        countContactsByStatus(profile.organization_id, assignedAgentId),
        (async () => {
          let query = supabase
            .from("contacts")
            .select(
              "id, first_name, last_name, phone_primary, lead_status, assigned_agent_id"
            );

          if (profile.organization_id) {
            query = query.eq("organization_id", profile.organization_id);
          }

          if (!isAdmin) {
            query = query.eq("assigned_agent_id", profile.id);
          }

          return await query
            .order("created_at", { ascending: false })
            .range(0, PIPELINE_VISIBLE_LIMIT - 1);
        })(),
      ]);

      setStats(statsResult);

      if (contactsResult.error) {
        setErrorMessage("Errore nel caricamento dei contatti.");
        setLoading(false);
        return;
      }

      setContacts((contactsResult.data ?? []) as PipelineContact[]);
      setLoading(false);
    }

    loadPipeline();
  }, []);

  function refreshStatsAfterMove(
    previousStatus: PipelineStatus,
    newStatus: PipelineStatus
  ) {
    setStats((prev) =>
      prev.map((item) => {
        if (item.status === previousStatus) {
          return { ...item, count: Math.max(0, item.count - 1) };
        }

        if (item.status === newStatus) {
          return { ...item, count: item.count + 1 };
        }

        return item;
      })
    );
  }

  async function handleMoveContact(
    contactId: string,
    newStatus: PipelineStatus
  ) {
    if (!currentUser) return;

    const existingContact = contacts.find((contact) => contact.id === contactId);
    if (!existingContact) return;

    const previousStatus = normalizeStatus(existingContact.lead_status);
    if (previousStatus === newStatus) return;

    setErrorMessage(null);
    setMovingContactId(contactId);

    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? { ...contact, lead_status: newStatus }
          : contact
      )
    );

    refreshStatsAfterMove(previousStatus, newStatus);

    const { error } = await supabase
      .from("contacts")
      .update({ lead_status: newStatus })
      .eq("id", contactId);

    if (error) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId
            ? { ...contact, lead_status: previousStatus }
            : contact
        )
      );

      setStats((prev) =>
        prev.map((item) => {
          if (item.status === newStatus) {
            return { ...item, count: Math.max(0, item.count - 1) };
          }

          if (item.status === previousStatus) {
            return { ...item, count: item.count + 1 };
          }

          return item;
        })
      );

      setErrorMessage("Spostamento non riuscito. Riprova.");
    }

    setMovingContactId(null);
  }

  const filteredContacts = useMemo(
    () => applyFilter(contacts, filterMode),
    [contacts, filterMode]
  );

  const totalsByStatus = useMemo(
    () =>
      Object.fromEntries(
        stats.map((item) => [item.status, item.count])
      ) as Record<PipelineStatus, number>,
    [stats]
  );

  const isAdmin =
    String(currentUser?.role || "").trim().toLowerCase() === "admin";

  const filterButtons: Array<{ key: FilterMode; label: string }> = isAdmin
    ? [
        { key: "all", label: "Tutti" },
        { key: "assigned", label: "Solo assegnati" },
        { key: "unassigned", label: "Solo senza agente" },
        { key: "with-name", label: "Solo con nome" },
        { key: "with-phone", label: "Solo con telefono" },
      ]
    : [
        { key: "all", label: "Tutti" },
        { key: "with-name", label: "Solo con nome" },
        { key: "with-phone", label: "Solo con telefono" },
      ];

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Pipeline</h1>
        <div style={{ marginTop: 16 }}>Caricamento pipeline...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid #e2e8f0",
            borderRadius: 18,
            padding: "18px 20px",
            boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
            }}
          >
            Pipeline
          </h1>

          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Admin: conteggi globali reali + fino a {PIPELINE_VISIBLE_LIMIT} contatti
            visibili. Agente: conteggi reali sui propri contatti + fino a{" "}
            {PIPELINE_VISIBLE_LIMIT} contatti assegnati visibili.
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {stats.map((item) => {
            const chip = getStatusChipColors(item.status);

            return (
              <div
                key={item.status}
                style={{
                  background: chip.bg,
                  color: chip.color,
                  border: `1px solid ${chip.border}`,
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                }}
              >
                {item.status}: {item.count}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {filterButtons.map((button) => {
            const isActive = filterMode === button.key;

            return (
              <button
                key={button.key}
                onClick={() => setFilterMode(button.key)}
                style={{
                  border: isActive ? "1px solid #2563eb" : "1px solid #cbd5e1",
                  background: isActive ? "#dbeafe" : "#ffffff",
                  color: isActive ? "#1d4ed8" : "#334155",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                }}
              >
                {button.label}
              </button>
            );
          })}
        </div>

        <PipelineBoard
          contacts={filteredContacts}
          statuses={PIPELINE_STATUSES}
          onMoveContact={handleMoveContact}
          movingContactId={movingContactId}
          totalsByStatus={totalsByStatus}
          showTotals={isAdmin}
        />
      </div>
    </div>
  );
}