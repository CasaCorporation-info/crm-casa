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
    <div className="crm-card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid var(--crm-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          background: "var(--crm-surface-soft)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {loading ? "Caricamento..." : `Totale contatti: ${total}`}
          {loadingTemplates && (
            <span style={{ marginLeft: 10, opacity: 0.6, fontWeight: 400 }}>
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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            alignItems: "center",
            background: "var(--crm-surface-soft)",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            Selezionati: {selectedContactIds.length}
          </div>

          <select
            value={bulkAssignAgentId}
            onChange={(e) => onBulkAssignAgentIdChange(e.target.value)}
            disabled={bulkAssignLoading}
            style={{ width: "100%", minWidth: 0 }}
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

      <div style={{ width: "100%", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 1200,
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
                    style={{ width: 16, height: 16 }}
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
              const isExpanded = expandedNoteContactId === c.id;

              return (
                <React.Fragment key={c.id}>
                  <tr style={{ background: "#fff" }}>
                    {isAdminLike && (
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(c.id)}
                          onChange={() => onToggleSelectedContact(c.id)}
                          style={{ width: 16, height: 16 }}
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
                          minWidth: 0,
                        }}
                        title={healthLabel}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: healthColor,
                            flex: "0 0 auto",
                          }}
                        />
                        <span
                          style={{
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getFullName(c)}
                        </span>
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
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => onToggleExpandedNote(c.id)}
                          className="crm-button-secondary"
                          style={miniButtonStyle}
                        >
                          Esito
                        </button>

                        <button
                          onClick={() => onViewActivities(c.id)}
                          className="crm-button-secondary"
                          style={miniButtonStyle}
                        >
                          Attività
                        </button>

                        <button
                          onClick={() => onOpenWhatsappTemplate(c)}
                          className="crm-button-secondary"
                          style={miniButtonStyle}
                        >
                          WA
                        </button>

                        <button
                          onClick={() => onOpenEmailTemplate(c)}
                          className="crm-button-secondary"
                          style={miniButtonStyle}
                        >
                          Mail
                        </button>
                      </div>
                    </td>

                    {isAdminLike && (
                      <td style={td}>
                        <select
                          value={c.assigned_agent_id ?? ""}
                          onChange={(e) => onAssignContact(c.id, e.target.value)}
                          disabled={assignmentLoadingId === c.id}
                          style={{ width: "100%", minWidth: 140 }}
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

                  {isExpanded && (
                    <tr>
                      <td colSpan={tableColSpan} style={{ padding: 16 }}>
                        <div className="crm-card" style={{ padding: 16 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              marginBottom: 10,
                            }}
                          >
                            Aggiungi esito
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: 10,
                              alignItems: "start",
                            }}
                          >
                            <select
                              value={noteTypeDrafts[c.id] || "Note"}
                              onChange={(e) =>
                                onNoteTypeDraftChange(c.id, e.target.value)
                              }
                              style={{ width: "100%", minWidth: 0 }}
                            >
                              <option>Chiamata</option>
                              <option>WhatsApp</option>
                              <option>Email</option>
                              <option>Incontro</option>
                              <option>Note</option>
                            </select>
                          </div>

                          <textarea
                            value={noteDrafts[c.id] || ""}
                            onChange={(e) =>
                              onNoteDraftChange(c.id, e.target.value)
                            }
                            rows={4}
                            style={{
                              marginTop: 10,
                              width: "100%",
                            }}
                          />

                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                              marginTop: 10,
                            }}
                          >
                            <button
                              onClick={() => onSaveQuickNote(c)}
                              disabled={savingNoteId === c.id}
                              className="crm-button-secondary"
                              style={{
                                ...actionButtonStyle,
                                background: "#111",
                                color: "#fff",
                                border: "1px solid #111",
                              }}
                            >
                              {savingNoteId === c.id ? "Salvataggio..." : "Salva"}
                            </button>

                            <button
                              onClick={() => onCancelQuickNote(c.id)}
                              className="crm-button-secondary"
                              style={actionButtonStyle}
                            >
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

            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan={tableColSpan} style={{ padding: 24 }}>
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--crm-text-soft)",
                    }}
                  >
                    Nessun contatto trovato.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: 14,
          borderTop: "1px solid var(--crm-border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onPrevPage}
          className="crm-button-secondary"
          style={paginationButtonStyle}
        >
          ←
        </button>

        <button
          onClick={onNextPage}
          className="crm-button-secondary"
          style={paginationButtonStyle}
        >
          →
        </button>

        <div
          style={{
            marginLeft: "auto",
            fontSize: 13,
            color: "var(--crm-text-soft)",
          }}
        >
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
  whiteSpace: "nowrap",
  background: "var(--crm-surface)",
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid var(--crm-border)",
  fontSize: 14,
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const miniButtonStyle: React.CSSProperties = {
  width: "auto",
  padding: "8px 10px",
  fontSize: 12,
  lineHeight: 1.2,
};

const actionButtonStyle: React.CSSProperties = {
  width: "auto",
  minWidth: 120,
  textAlign: "center",
  padding: "10px 14px",
};

const paginationButtonStyle: React.CSSProperties = {
  width: "auto",
  minWidth: 44,
  textAlign: "center",
  padding: "10px 12px",
};