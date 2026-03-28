"use client";

import React from "react";
import type {
  Agent,
  Contact,
  RecentActivityMap,
  VisibleColumnsState,
} from "./types";
import {
  formatContactType,
  formatDateTime,
  getContactHealthColor,
  getContactHealthLabel,
  getContactHealthStatus,
  getFullName,
} from "./utils";

type Props = {
  contacts: Contact[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  loadingTemplates: boolean;
  isAdminLike: boolean;
  agents: Agent[];
  recentActivities: RecentActivityMap;
  visibleColumns: VisibleColumnsState;
  expandedNoteContactId: string | null;
  noteDrafts: Record<string, string>;
  noteTypeDrafts: Record<string, string>;
  savingNoteId: string | null;
  assignmentLoadingId: string | null;
  selectedContactIds: string[];
  bulkAssignAgentId: string;
  bulkAssignLoading: boolean;
  onToggleSelectedContact: (contactId: string) => void;
  onToggleSelectAllCurrentPage: () => void;
  onBulkAssignAgentIdChange: (value: string) => void;
  onBulkAssign: () => void;
  onToggleExpandedNote: (contactId: string) => void;
  onViewActivities: (contactId: string) => void;
  onOpenWhatsappTemplate: (contact: Contact) => void;
  onOpenEmailTemplate: (contact: Contact) => void;
  onAssignContact: (contactId: string, agentId: string) => void;
  getAgentName: (agentId: string | null) => string;
  onNoteDraftChange: (contactId: string, value: string) => void;
  onNoteTypeDraftChange: (contactId: string, value: string) => void;
  onSaveQuickNote: (contact: Contact) => void;
  onCancelQuickNote: (contactId: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export default function ContactsTable(props: Props) {
  const {
    contacts,
    loading,
    total,
    page,
    totalPages,
    loadingTemplates,
    isAdminLike,
    agents,
    recentActivities,
    visibleColumns,
    expandedNoteContactId,
    noteDrafts,
    noteTypeDrafts,
    savingNoteId,
    assignmentLoadingId,
    selectedContactIds,
    bulkAssignAgentId,
    bulkAssignLoading,
    onToggleSelectedContact,
    onToggleSelectAllCurrentPage,
    onBulkAssignAgentIdChange,
    onBulkAssign,
    onToggleExpandedNote,
    onViewActivities,
    onOpenWhatsappTemplate,
    onOpenEmailTemplate,
    onAssignContact,
    getAgentName,
    onNoteDraftChange,
    onNoteTypeDraftChange,
    onSaveQuickNote,
    onCancelQuickNote,
    onPrevPage,
    onNextPage,
  } = props;

  const baseColumns =
    5 +
    (visibleColumns.email ? 1 : 0) +
    (visibleColumns.city ? 1 : 0) +
    (visibleColumns.type ? 1 : 0) +
    (visibleColumns.source ? 1 : 0) +
    (visibleColumns.created_at ? 1 : 0);

  const tableColSpan = baseColumns + (isAdminLike ? 2 : 0);

  const currentPageIds = contacts.map((c) => c.id);
  const hasContacts = currentPageIds.length > 0;
  const allSelected =
    hasContacts && currentPageIds.every((id) => selectedContactIds.includes(id));
  const someSelected = currentPageIds.some((id) =>
    selectedContactIds.includes(id)
  );

  return (
    <div className="crm-card" style={{ overflowX: "auto" }}>
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid var(--crm-border)",
          display: "flex",
          justifyContent: "space-between",
          background: "var(--crm-surface-soft)",
        }}
      >
        <div>
          {loading ? "Caricamento..." : `Totale contatti: ${total}`}
          {loadingTemplates && (
            <span style={{ marginLeft: 10, opacity: 0.6 }}>
              · Caricamento template...
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, color: "var(--crm-text-soft)" }}>
          Pagina <b>{page}</b> / <b>{totalPages}</b>
        </div>
      </div>

      {isAdminLike && selectedContactIds.length > 0 && (
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid var(--crm-border)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            background: "var(--crm-surface-soft)",
          }}
        >
          <b>Selezionati: {selectedContactIds.length}</b>

          <select
            value={bulkAssignAgentId}
            onChange={(e) => onBulkAssignAgentIdChange(e.target.value)}
            disabled={bulkAssignLoading}
            style={{ maxWidth: 260 }}
          >
            <option value="">Seleziona agente</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name?.trim() || "Agente"}
              </option>
            ))}
          </select>

          <button
            onClick={onBulkAssign}
            disabled={bulkAssignLoading || !bulkAssignAgentId}
            className="crm-button-secondary"
          >
            {bulkAssignLoading ? "Assegnazione..." : "Assegna selezionati"}
          </button>
        </div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          minWidth: 1400,
        }}
      >
        <thead>
          <tr style={{ background: "var(--crm-surface)" }}>
            {isAdminLike && (
              <th style={th}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(i) => {
                    if (i) i.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleSelectAllCurrentPage}
                />
              </th>
            )}

            <th style={th}>Nome</th>
            <th style={th}>Telefono</th>
            {visibleColumns.email && <th style={th}>Email</th>}
            {visibleColumns.city && <th style={th}>Città</th>}
            {visibleColumns.type && <th style={th}>Tipo</th>}
            <th style={th}>Stato</th>
            {visibleColumns.source && <th style={th}>Fonte</th>}
            {visibleColumns.created_at && <th style={th}>Creato</th>}
            <th style={th}>Ultimo contatto</th>
            <th style={th}>Attività</th>
            {isAdminLike && <th style={th}>Agente</th>}
          </tr>
        </thead>

        <tbody>
          {contacts.map((c) => {
            const health = getContactHealthStatus(c.last_contact_at);
            const healthColor = getContactHealthColor(health);
            const healthLabel = getContactHealthLabel(health);

            return (
              <React.Fragment key={c.id}>
                <tr style={{ background: "#fff" }}>
                  {isAdminLike && (
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(c.id)}
                        onChange={() => onToggleSelectedContact(c.id)}
                      />
                    </td>
                  )}

                  <td style={td}>
                    <a
                      href={`/contacts/${c.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 600,
                      }}
                      title={healthLabel}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: healthColor,
                        }}
                      />
                      {getFullName(c)}
                    </a>
                  </td>

                  <td style={td}>{c.phone_primary ?? "-"}</td>
                  {visibleColumns.email && (
                    <td style={td}>{c.email_primary ?? "-"}</td>
                  )}
                  {visibleColumns.city && <td style={td}>{c.city ?? "-"}</td>}
                  {visibleColumns.type && (
                    <td style={td}>{formatContactType(c.contact_type)}</td>
                  )}
                  <td style={td}>{c.lead_status ?? "-"}</td>
                  {visibleColumns.source && (
                    <td style={td}>{c.source ?? "-"}</td>
                  )}
                  {visibleColumns.created_at && (
                    <td style={td}>{formatDateTime(c.created_at)}</td>
                  )}
                  <td style={td}>{formatDateTime(c.last_contact_at)}</td>

                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => onToggleExpandedNote(c.id)}>
                        Esito
                      </button>

                      <button onClick={() => onViewActivities(c.id)}>
                        Attività
                      </button>

                      <button onClick={() => onOpenWhatsappTemplate(c)}>
                        WA
                      </button>

                      <button onClick={() => onOpenEmailTemplate(c)}>
                        Mail
                      </button>
                    </div>
                  </td>

                  {isAdminLike && (
                    <td style={td}>
                      <select
                        value={c.assigned_agent_id ?? ""}
                        onChange={(e) => onAssignContact(c.id, e.target.value)}
                      >
                        <option value="">Agente</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>

                {expandedNoteContactId === c.id && (
                  <tr>
                    <td colSpan={tableColSpan} style={{ padding: 16 }}>
                      <div className="crm-card" style={{ padding: 16 }}>
                        <b>Aggiungi esito</b>

                        <select
                          value={noteTypeDrafts[c.id] || "Note"}
                          onChange={(e) =>
                            onNoteTypeDraftChange(c.id, e.target.value)
                          }
                          style={{ marginTop: 10, maxWidth: 260 }}
                        >
                          <option>Chiamata</option>
                          <option>WhatsApp</option>
                          <option>Email</option>
                          <option>Incontro</option>
                          <option>Note</option>
                        </select>

                        <textarea
                          value={noteDrafts[c.id] || ""}
                          onChange={(e) =>
                            onNoteDraftChange(c.id, e.target.value)
                          }
                          rows={4}
                          style={{ marginTop: 10 }}
                        />

                        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                          <button onClick={() => onSaveQuickNote(c)}>
                            Salva
                          </button>

                          <button onClick={() => onCancelQuickNote(c.id)}>
                            Annulla
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div
        style={{
          padding: 14,
          borderTop: "1px solid var(--crm-border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button onClick={onPrevPage}>←</button>
        <button onClick={onNextPage}>→</button>

        <div style={{ marginLeft: "auto", fontSize: 13 }}>
          {contacts.length} / {total}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: 12,
  textAlign: "left",
  fontSize: 12,
  color: "var(--crm-text-soft)",
  borderBottom: "1px solid var(--crm-border)",
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid var(--crm-border)",
  fontSize: 14,
};