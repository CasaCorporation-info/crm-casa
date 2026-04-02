"use client";

import type {
  Agent,
  SortDirection,
  SortField,
  VisibleColumnKey,
  VisibleColumnsState,
} from "./types";
import { CONTACT_TYPE_OPTIONS, LEAD_STATUS_OPTIONS } from "./types";
import { formatContactType } from "./utils";

type Props = {
  isAdminLike: boolean;
  adminLeadView: "assigned" | "unassigned";
  selectedAssignedAgentId: string;
  agents: Agent[];
  search: string;
  filterType: string;
  filterStatus: string;
  filterSource: string;
  onlyWithPhone: boolean;
  filterHealth: string;
  sortField: SortField;
  sortDirection: SortDirection;
  visibleColumns: VisibleColumnsState;
  onAdminLeadViewChange: (value: "assigned" | "unassigned") => void;
  onSelectedAssignedAgentIdChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onToggleShowForm: () => void;
  onRefresh: () => void;
  onFilterTypeChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onFilterSourceChange: (value: string) => void;
  onOnlyWithPhoneChange: (value: boolean) => void;
  onFilterHealthChange: (value: string) => void;
  onSortFieldChange: (value: SortField) => void;
  onSortDirectionChange: (value: SortDirection) => void;
  onToggleVisibleColumn: (key: VisibleColumnKey) => void;
  onResetFilters: () => void;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
};

const buttonPrimaryStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const buttonSecondaryStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

export default function ContactsFilters({
  isAdminLike,
  adminLeadView,
  selectedAssignedAgentId,
  agents,
  search,
  filterType,
  filterStatus,
  filterSource,
  onlyWithPhone,
  filterHealth,
  sortField,
  sortDirection,
  visibleColumns,
  onAdminLeadViewChange,
  onSelectedAssignedAgentIdChange,
  onSearchChange,
  onToggleShowForm,
  onRefresh,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterSourceChange,
  onOnlyWithPhoneChange,
  onFilterHealthChange,
  onSortFieldChange,
  onSortDirectionChange,
  onToggleVisibleColumn,
  onResetFilters,
}: Props) {
  return (
    <>
      {isAdminLike && (
        <div
          className="crm-card"
          style={{
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => onAdminLeadViewChange("unassigned")}
              style={{
                ...buttonSecondaryStyle,
                border:
                  adminLeadView === "unassigned"
                    ? "1px solid #111"
                    : "1px solid #ddd",
                background: adminLeadView === "unassigned" ? "#111" : "#fff",
                color: adminLeadView === "unassigned" ? "#fff" : "#111",
              }}
            >
              Da assegnare
            </button>

            <button
              onClick={() => onAdminLeadViewChange("assigned")}
              style={{
                ...buttonSecondaryStyle,
                border:
                  adminLeadView === "assigned"
                    ? "1px solid #111"
                    : "1px solid #ddd",
                background: adminLeadView === "assigned" ? "#111" : "#fff",
                color: adminLeadView === "assigned" ? "#fff" : "#111",
              }}
            >
              Assegnati
            </button>

            {adminLeadView === "assigned" && (
              <select
                value={selectedAssignedAgentId}
                onChange={(e) => onSelectedAssignedAgentIdChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">Tutti gli agenti</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name || "Agente"}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div
        className="crm-card"
        style={{
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca per nome, telefono, email, città, tipo, fonte..."
            style={inputStyle}
          />

          <button onClick={onToggleShowForm} style={buttonPrimaryStyle}>
            + Nuovo contatto
          </button>

          <button onClick={onRefresh} style={buttonSecondaryStyle}>
            Aggiorna
          </button>
        </div>
      </div>

      <div
        className="crm-card"
        style={{
          padding: 14,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            alignItems: "center",
          }}
        >
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">Tutti i tipi</option>
            {CONTACT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {formatContactType(type)}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">Tutti gli stati</option>
            {LEAD_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={filterHealth}
            onChange={(e) => onFilterHealthChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">Tutti i pallini</option>
            <option value="never">Nero · Mai contattato</option>
            <option value="red">Rosso · Oltre 90 giorni</option>
            <option value="orange">Arancione · 45-89 giorni</option>
            <option value="yellow">Giallo · 16-44 giorni</option>
            <option value="green">Verde · Meno di 16 giorni</option>
          </select>

          <select
            value={sortField}
            onChange={(e) => onSortFieldChange(e.target.value as SortField)}
            style={inputStyle}
          >
            <option value="created_at">Ordina per creato il</option>
            <option value="last_contact_at">Ordina per ultimo contatto</option>
            <option value="name">Ordina per nome</option>
          </select>

          <select
            value={sortDirection}
            onChange={(e) => onSortDirectionChange(e.target.value as SortDirection)}
            style={inputStyle}
          >
            <option value="desc">
              {sortField === "name" ? "Z-A" : "Più recente"}
            </option>
            <option value="asc">
              {sortField === "name" ? "A-Z" : "Meno recente"}
            </option>
          </select>

          <input
            value={filterSource}
            onChange={(e) => onFilterSourceChange(e.target.value)}
            placeholder="Filtra fonte (es: idealista, whatsapp, xls...)"
            style={inputStyle}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              padding: "0 4px",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={onlyWithPhone}
              onChange={(e) => onOnlyWithPhoneChange(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                flex: "0 0 auto",
              }}
            />
            Solo con telefono
          </label>

          <button onClick={onResetFilters} style={buttonSecondaryStyle}>
            Reset filtri
          </button>
        </div>
      </div>

      <div
        className="crm-card"
        style={{
          padding: 14,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: 10,
            fontSize: 14,
          }}
        >
          Colonne visibili
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={visibleColumns.email}
              onChange={() => onToggleVisibleColumn("email")}
              style={{ width: 16, height: 16 }}
            />
            Email
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={visibleColumns.city}
              onChange={() => onToggleVisibleColumn("city")}
              style={{ width: 16, height: 16 }}
            />
            Città
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={visibleColumns.type}
              onChange={() => onToggleVisibleColumn("type")}
              style={{ width: 16, height: 16 }}
            />
            Tipo
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={visibleColumns.source}
              onChange={() => onToggleVisibleColumn("source")}
              style={{ width: 16, height: 16 }}
            />
            Fonte
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={visibleColumns.created_at}
              onChange={() => onToggleVisibleColumn("created_at")}
              style={{ width: 16, height: 16 }}
            />
            Creato il
          </label>
        </div>
      </div>
    </>
  );
}