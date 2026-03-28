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
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        marginBottom: 18,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Nuovo contatto</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <input
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder="Nome"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />

        <input
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          placeholder="Cognome"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />

        <input
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="Telefono"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />

        <input
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="Città"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />

        <select
          value={contactType}
          onChange={(e) => onContactTypeChange(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
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
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
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
          style={{
            gridColumn: "1 / -1",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={onSave}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Salva contatto
        </button>

        <button
          onClick={onCancel}
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
  );
}