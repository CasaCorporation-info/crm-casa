"use client";

import { CONTACT_TYPE_OPTIONS, LEAD_STATUS_OPTIONS } from "./types";
import { formatContactType } from "./utils";

type Props = {
  show: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  contactType: string;
  leadStatus: string;
  source: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onContactTypeChange: (value: string) => void;
  onLeadStatusChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function CreateContactForm({
  show,
  firstName,
  lastName,
  phone,
  city,
  contactType,
  leadStatus,
  source,
  onFirstNameChange,
  onLastNameChange,
  onPhoneChange,
  onCityChange,
  onContactTypeChange,
  onLeadStatusChange,
  onSourceChange,
  onSave,
  onCancel,
}: Props) {
  if (!show) return null;

  return (
    <div className="crm-card" style={{ padding: 16, marginBottom: 18 }}>
      <div
        style={{
          fontWeight: 700,
          marginBottom: 12,
          fontSize: 16,
        }}
      >
        Nuovo contatto
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <input
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder="Nome"
        />

        <input
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          placeholder="Cognome"
        />

        <input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Telefono"
        />

        <input
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="Città"
        />

        <select
          value={contactType}
          onChange={(e) => onContactTypeChange(e.target.value)}
        >
          {CONTACT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {formatContactType(type)}
            </option>
          ))}
        </select>

        <select
          value={leadStatus}
          onChange={(e) => onLeadStatusChange(e.target.value)}
        >
          {LEAD_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <input
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          placeholder="Fonte (es: immobiliare, idealista, whatsapp...)"
          style={{ gridColumn: "1 / -1" }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onSave}
          className="crm-button-secondary"
          style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #111",
            minWidth: 140,
          }}
        >
          Salva contatto
        </button>

        <button
          onClick={onCancel}
          className="crm-button-secondary"
          style={{
            minWidth: 120,
          }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}