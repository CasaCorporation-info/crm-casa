"use client";

import React from "react";
import type { Contact, MessageTemplate } from "@/components/contacts/types";

type WhatsappOutcome =
  | "sent"
  | "not_sent"
  | "no_whatsapp"
  | "error"
  | "invalid_number";

type PendingWhatsappSend = {
  contact: Contact;
  template: MessageTemplate;
  finalMessage: string;
  targetUrl: string | null;
  metadata: Record<string, unknown>;
};

type Props = {
  pendingWhatsappSend: PendingWhatsappSend | null;
  whatsappOutcomeLoading: boolean;
  onClose: () => void;
  onOutcome: (outcome: WhatsappOutcome) => void;
};

export default function WhatsappOutcomeModal({
  pendingWhatsappSend,
  whatsappOutcomeLoading,
  onClose,
  onOutcome,
}: Props) {
  if (!pendingWhatsappSend) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
          padding: 22,
        }}
      >
        <div style={{ marginBottom: 10, fontSize: 20, fontWeight: 700 }}>
          Esito invio WhatsApp
        </div>

        <div style={{ marginBottom: 18, color: "#475569", lineHeight: 1.5 }}>
          Contatto:{" "}
          <b>
            {pendingWhatsappSend.contact.first_name || ""}{" "}
            {pendingWhatsappSend.contact.last_name || ""}
          </b>
          <br />
          Template: <b>{pendingWhatsappSend.template.title}</b>
          <br />
          Numero: <b>{pendingWhatsappSend.contact.phone_primary || "-"}</b>
        </div>

        {!pendingWhatsappSend.targetUrl && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Il link WhatsApp non è stato costruito correttamente. Puoi salvare
            direttamente “Numero non valido”.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <button
            type="button"
            disabled={whatsappOutcomeLoading}
            onClick={() => onOutcome("sent")}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 700,
              background: "#16a34a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            WhatsApp inviato
          </button>

          <button
            type="button"
            disabled={whatsappOutcomeLoading}
            onClick={() => onOutcome("not_sent")}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 700,
              background: "#475569",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Non inviato
          </button>

          <button
            type="button"
            disabled={whatsappOutcomeLoading}
            onClick={() => onOutcome("no_whatsapp")}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 700,
              background: "#fff",
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            Contatto senza WhatsApp
          </button>

          <button
            type="button"
            disabled={whatsappOutcomeLoading}
            onClick={() => onOutcome("error")}
            style={{
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 700,
              background: "#fff1f2",
              color: "#b91c1c",
              cursor: "pointer",
            }}
          >
            Errore
          </button>

          <button
            type="button"
            disabled={whatsappOutcomeLoading}
            onClick={() => onOutcome("invalid_number")}
            style={{
              gridColumn: "1 / -1",
              border: "1px solid #fde68a",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 700,
              background: "#fffbeb",
              color: "#92400e",
              cursor: "pointer",
            }}
          >
            Numero non valido
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <button
            type="button"
            disabled={whatsappOutcomeLoading}
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}