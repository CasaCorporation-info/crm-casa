"use client";

import React from "react";
import type {
  Agent,
  Contact,
  RecentActivityMap,
  VisibleColumnsState,
} from "./types";
import {
  formatDateTime,
  getContactHealthColor,
  getContactHealthLabel,
  getContactHealthStatus,
  getDaysAgoLabel,
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

export default function ContactsTable({
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
}: Props) {
  const baseColumns =
    5 +
    (visibleColumns.email ? 1 : 0) +
    (visibleColumns.city ? 1 : 0) +
    (visibleColumns.type ? 1 : 0) +
    (visibleColumns.source ? 1 : 0) +
    (visibleColumns.created_at ? 1 : 0);

  const tableColSpan = baseColumns + (isAdminLike ? 2 : 0);

  const currentPageIds = contacts.map((contact) => contact.id);
  const hasContacts = currentPageIds.length > 0;
  const allCurrentPageSelected =
    hasContacts && currentPageIds.every((id) => selectedContactIds.includes(id));
  const someCurrentPageSelected = currentPageIds.some((id) =>
    selectedContactIds.includes(id)
  );

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        overflowX: "auto",
        background: "#fff",
      }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #ddd",
          background: "#fafafa",
          display: "flex",
          justifyContent: "space-between",
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
        <div style={{ opacity: 0.7 }}>
          Pagina <b>{page}</b> / <b>{totalPages}</b>
        </div>
      </div>

      {isAdminLike && selectedContactIds.length > 0 && (
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #ddd",
            background: "#f8fafc",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            Selezionati: {selectedContactIds.length}
          </div>

          <select
            value={bulkAssignAgentId}
            onChange={(e) => onBulkAssignAgentIdChange(e.target.value)}
            disabled={bulkAssignLoading}
            style={{
              minWidth: 220,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: bulkAssignLoading ? "not-allowed" : "pointer",
              opacity: bulkAssignLoading ? 0.7 : 1,
            }}
          >
            <option value="">Seleziona agente</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.full_name?.trim() || "Agente"}
              </option>
            ))}
          </select>

          <button
            onClick={onBulkAssign}
            disabled={bulkAssignLoading || !bulkAssignAgentId}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor:
                bulkAssignLoading || !bulkAssignAgentId
                  ? "not-allowed"
                  : "pointer",
              opacity: bulkAssignLoading || !bulkAssignAgentId ? 0.6 : 1,
            }}
          >
            {bulkAssignLoading ? "Assegnazione..." : "Assegna selezionati"}
          </button>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1500 }}>
        <thead>
          <tr style={{ textAlign: "left", background: "#fff" }}>
            {isAdminLike && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee", width: 50 }}>
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate =
                        someCurrentPageSelected && !allCurrentPageSelected;
                    }
                  }}
                  onChange={onToggleSelectAllCurrentPage}
                  disabled={!hasContacts || loading || bulkAssignLoading}
                />
              </th>
            )}

            <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Nome</th>
            <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              Telefono
            </th>

            {visibleColumns.email && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Email</th>
            )}

            {visibleColumns.city && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Città</th>
            )}

            {visibleColumns.type && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Tipo</th>
            )}

            <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Stato</th>

            {visibleColumns.source && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>Fonte</th>
            )}

            {visibleColumns.created_at && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                Creato il
              </th>
            )}

            <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              Ultimo contatto
            </th>

            <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              Attività
            </th>

            {isAdminLike && (
              <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                Agente
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {contacts.map((c) => {
            const recentWhatsapp = recentActivities[c.id]?.whatsapp || null;
            const recentEmail = recentActivities[c.id]?.email || null;
            const healthStatus = getContactHealthStatus(c.last_contact_at);
            const healthColor = getContactHealthColor(healthStatus);
            const healthLabel = getContactHealthLabel(healthStatus);
            const isSelected = selectedContactIds.includes(c.id);

            return (
              <React.Fragment key={c.id}>
                <tr>
                  {isAdminLike && (
                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #f2f2f2",
                        verticalAlign: "top",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectedContact(c.id)}
                        disabled={loading || bulkAssignLoading}
                      />
                    </td>
                  )}

                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #f2f2f2",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <a
                      href={`/contacts/${c.id}`}
                      style={{
                        fontWeight: 700,
                        color: "#111",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                      title={healthLabel}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: healthColor,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      <span>{getFullName(c)}</span>
                    </a>
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                    {c.phone_primary ?? "-"}
                  </td>

                  {visibleColumns.email && (
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                      {c.email_primary ?? "-"}
                    </td>
                  )}

                  {visibleColumns.city && (
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                      {c.city ?? "-"}
                    </td>
                  )}

                  {visibleColumns.type && (
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                      {c.contact_type ?? "-"}
                    </td>
                  )}

                  <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                    {c.lead_status ?? "-"}
                  </td>

                  {visibleColumns.source && (
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                      {c.source ?? "-"}
                    </td>
                  )}

                  {visibleColumns.created_at && (
                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #f2f2f2",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDateTime(c.created_at)}
                    </td>
                  )}

                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #f2f2f2",
                      whiteSpace: "nowrap",
                    }}
                    title={healthLabel}
                  >
                    {formatDateTime(c.last_contact_at)}
                  </td>

                  <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => onToggleExpandedNote(c.id)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background:
                            expandedNoteContactId === c.id ? "#111" : "#fff",
                          color:
                            expandedNoteContactId === c.id ? "#fff" : "#111",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {expandedNoteContactId === c.id
                          ? "Chiudi esito"
                          : "Aggiungi esito"}
                      </button>

                      <button
                        onClick={() => onViewActivities(c.id)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                          color: "#111",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Vedi attività
                      </button>

                      <button
                        onClick={() => onOpenWhatsappTemplate(c)}
                        disabled={!c.phone_primary?.trim()}
                        title={
                          !c.phone_primary?.trim()
                            ? "Telefono mancante"
                            : "Invia WhatsApp"
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                          color: "#111",
                          cursor: !c.phone_primary?.trim()
                            ? "not-allowed"
                            : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !c.phone_primary?.trim() ? 0.5 : 1,
                        }}
                      >
                        WhatsApp
                      </button>

                      <button
                        onClick={() => onOpenEmailTemplate(c)}
                        disabled={!c.email_primary?.trim()}
                        title={
                          !c.email_primary?.trim()
                            ? "Email mancante"
                            : "Invia Email"
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                          color: "#111",
                          cursor: !c.email_primary?.trim()
                            ? "not-allowed"
                            : "pointer",
                          whiteSpace: "nowrap",
                          opacity: !c.email_primary?.trim() ? 0.5 : 1,
                        }}
                      >
                        Email
                      </button>

                      {(recentWhatsapp || recentEmail) && (
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {recentWhatsapp && (
                            <span>
                              WA: {getDaysAgoLabel(recentWhatsapp.created_at)}
                            </span>
                          )}
                          {recentEmail && (
                            <span>
                              Mail: {getDaysAgoLabel(recentEmail.created_at)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {isAdminLike && (
                    <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                      <select
                        value={c.assigned_agent_id ?? ""}
                        onChange={(e) => onAssignContact(c.id, e.target.value)}
                        disabled={assignmentLoadingId === c.id || bulkAssignLoading}
                        style={{
                          minWidth: 180,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "#fff",
                          cursor:
                            assignmentLoadingId === c.id || bulkAssignLoading
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            assignmentLoadingId === c.id || bulkAssignLoading
                              ? 0.6
                              : 1,
                        }}
                      >
                        <option value="">
                          {c.assigned_agent_id
                            ? "Rimuovi assegnazione"
                            : "Seleziona agente"}
                        </option>

                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.full_name?.trim() || "Agente"}
                          </option>
                        ))}
                      </select>

                      {assignmentLoadingId === c.id && (
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                          Salvataggio...
                        </div>
                      )}

                      {assignmentLoadingId !== c.id && c.assigned_agent_id && (
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                          Attuale: {getAgentName(c.assigned_agent_id)}
                        </div>
                      )}
                    </td>
                  )}
                </tr>

                {expandedNoteContactId === c.id && (
                  <tr>
                    <td
                      colSpan={tableColSpan}
                      style={{
                        padding: 16,
                        background: "#fafafa",
                        borderBottom: "1px solid #f2f2f2",
                      }}
                    >
                      <div style={{ maxWidth: 900 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>
                          Aggiungi esito rapido
                        </div>

                        <select
                          value={noteTypeDrafts[c.id] || "Note"}
                          onChange={(e) =>
                            onNoteTypeDraftChange(c.id, e.target.value)
                          }
                          style={{
                            width: "100%",
                            maxWidth: 260,
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            marginBottom: 10,
                          }}
                        >
                          <option value="Chiamata">Chiamata</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Email">Email</option>
                          <option value="Incontro">Incontro</option>
                          <option value="Note">Note</option>
                        </select>

                        <textarea
                          value={noteDrafts[c.id] || ""}
                          onChange={(e) =>
                            onNoteDraftChange(c.id, e.target.value)
                          }
                          placeholder="Scrivi qui l'esito del contatto..."
                          rows={4}
                          style={{
                            width: "100%",
                            padding: 12,
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            resize: "vertical",
                            fontFamily: "inherit",
                          }}
                        />

                        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                          <button
                            onClick={() => onSaveQuickNote(c)}
                            disabled={savingNoteId === c.id}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: "1px solid #111",
                              background: "#111",
                              color: "#fff",
                              cursor:
                                savingNoteId === c.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: savingNoteId === c.id ? 0.7 : 1,
                            }}
                          >
                            {savingNoteId === c.id
                              ? "Salvataggio..."
                              : "Salva esito"}
                          </button>

                          <button
                            onClick={() => onCancelQuickNote(c.id)}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "#fff",
                              cursor: "pointer",
                            }}
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
              <td colSpan={tableColSpan} style={{ padding: 14, opacity: 0.7 }}>
                Nessun contatto trovato.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: 12,
          borderTop: "1px solid #ddd",
          background: "#fff",
        }}
      >
        <button
          onClick={onPrevPage}
          disabled={page === 1 || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: page === 1 || loading ? "not-allowed" : "pointer",
            opacity: page === 1 || loading ? 0.5 : 1,
          }}
        >
          ← Precedente
        </button>

        <button
          onClick={onNextPage}
          disabled={page >= totalPages || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: page >= totalPages || loading ? "not-allowed" : "pointer",
            opacity: page >= totalPages || loading ? 0.5 : 1,
          }}
        >
          Successivo →
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.7 }}>
          Mostrati: {contacts.length} su {total}
        </div>
      </div>
    </div>
  );
}