"use client";

import type {
  SortDirection,
  SortField,
  VisibleColumnKey,
  VisibleColumnsState,
} from "./types";

type Props = {
  isAdminLike: boolean;
  adminLeadView: "assigned" | "unassigned";
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

export default function ContactsFilters({
  isAdminLike,
  adminLeadView,
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
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => onAdminLeadViewChange("unassigned")}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border:
                adminLeadView === "unassigned"
                  ? "1px solid #111"
                  : "1px solid #ddd",
              background: adminLeadView === "unassigned" ? "#111" : "#fff",
              color: adminLeadView === "unassigned" ? "#fff" : "#111",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Da assegnare
          </button>

          <button
            onClick={() => onAdminLeadViewChange("assigned")}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border:
                adminLeadView === "assigned"
                  ? "1px solid #111"
                  : "1px solid #ddd",
              background: adminLeadView === "assigned" ? "#111" : "#fff",
              color: adminLeadView === "assigned" ? "#fff" : "#111",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Assegnati
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cerca per nome, telefono, email, città, tipo, fonte..."
          style={{
            flex: 1,
            minWidth: 280,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        />

        <button
          onClick={onToggleShowForm}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Nuovo contatto
        </button>

        <button
          onClick={onRefresh}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Aggiorna
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <option value="">Tutti i tipi</option>
          <option value="owner">owner</option>
          <option value="buyer">buyer</option>
          <option value="investor">investor</option>
          <option value="tenant">tenant</option>
          <option value="ex_client">ex_client</option>
          <option value="lead">lead</option>
          <option value="partner">partner</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <option value="">Tutti gli stati</option>
          <option value="nuovo">nuovo</option>
          <option value="contattato">contattato</option>
          <option value="non interessato">non interessato</option>
          <option value="informazione">informazione</option>
          <option value="notizia">notizia</option>
          <option value="valutazione fissata">valutazione fissata</option>
          <option value="valutazione effettuata">valutazione effettuata</option>
          <option value="incarico preso">incarico preso</option>
          <option value="venduto">venduto</option>
          <option value="da eliminare">da eliminare</option>
        </select>

        <select
          value={filterHealth}
          onChange={(e) => onFilterHealthChange(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
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
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <option value="created_at">Ordina per creato il</option>
          <option value="last_contact_at">Ordina per ultimo contatto</option>
          <option value="name">Ordina per nome</option>
        </select>

        <select
          value={sortDirection}
          onChange={(e) => onSortDirectionChange(e.target.value as SortDirection)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
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
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 260,
            background: "#fff",
          }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
          }}
        >
          <input
            type="checkbox"
            checked={onlyWithPhone}
            onChange={(e) => onOnlyWithPhoneChange(e.target.checked)}
          />
          Solo con telefono
        </label>

        <button
          onClick={onResetFilters}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Reset filtri
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          marginBottom: 18,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Colonne visibili</div>

        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={visibleColumns.email}
              onChange={() => onToggleVisibleColumn("email")}
            />
            Email
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={visibleColumns.city}
              onChange={() => onToggleVisibleColumn("city")}
            />
            Città
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={visibleColumns.type}
              onChange={() => onToggleVisibleColumn("type")}
            />
            Tipo
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={visibleColumns.source}
              onChange={() => onToggleVisibleColumn("source")}
            />
            Fonte
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={visibleColumns.created_at}
              onChange={() => onToggleVisibleColumn("created_at")}
            />
            Creato il
          </label>
        </div>
      </div>
    </>
  );
}