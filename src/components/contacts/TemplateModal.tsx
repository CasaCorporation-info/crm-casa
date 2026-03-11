"use client";

import type { Contact, MessageTemplate } from "./types";
import { getFullName } from "./utils";

type Props = {
  open: boolean;
  contact: Contact | null;
  type: "whatsapp" | "email" | null;
  selectedTemplateId: string;
  availableTemplates: MessageTemplate[];
  selectedTemplate: MessageTemplate | null;
  actionLoading: boolean;
  onClose: () => void;
  onSelectedTemplateIdChange: (value: string) => void;
  onConfirm: () => void;
};

export default function TemplateModal({
  open,
  contact,
  type,
  selectedTemplateId,
  availableTemplates,
  selectedTemplate,
  actionLoading,
  onClose,
  onSelectedTemplateIdChange,
  onConfirm,
}: Props) {
  if (!open || !contact || !type) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #ddd",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {type === "whatsapp" ? "Invia WhatsApp" : "Invia Email"}
          </div>

          <div style={{ opacity: 0.7, marginTop: 4 }}>
            Contatto: <b>{getFullName(contact)}</b>
          </div>

          <div style={{ opacity: 0.7, marginTop: 4 }}>
            {type === "whatsapp"
              ? `Telefono: ${contact.phone_primary || "-"}`
              : `Email: ${contact.email_primary || "-"}`}
          </div>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Template</div>

            <select
              value={selectedTemplateId}
              onChange={(e) => onSelectedTemplateIdChange(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            >
              <option value="">Seleziona template</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>

            {availableTemplates.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
                Nessun template disponibile per questo tipo.
              </div>
            )}
          </div>

          {selectedTemplate && (
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 14,
                background: "#fafafa",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Anteprima template
              </div>

              <div style={{ marginBottom: 8 }}>
                <b>Titolo:</b> {selectedTemplate.title}
              </div>

              {type === "email" && (
                <div style={{ marginBottom: 8 }}>
                  <b>Oggetto:</b> {selectedTemplate.subject || "-"}
                </div>
              )}

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {selectedTemplate.message}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
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

            <button
              onClick={onConfirm}
              disabled={
                actionLoading ||
                !selectedTemplateId ||
                availableTemplates.length === 0
              }
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor:
                  actionLoading ||
                  !selectedTemplateId ||
                  availableTemplates.length === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  actionLoading ||
                  !selectedTemplateId ||
                  availableTemplates.length === 0
                    ? 0.7
                    : 1,
              }}
            >
              {actionLoading
                ? "Preparazione..."
                : type === "whatsapp"
                ? "Apri WhatsApp"
                : "Apri Gmail"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}