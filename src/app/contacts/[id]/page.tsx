"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";
import Activities from "@/components/contacts/Activities";
import {
  CONTACT_TYPE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  type Contact,
  type ContactFormValues,
  type LeadStatus,
} from "@/components/contacts/types";
import {
  buildContactUpdatePayload,
  buildGmailComposeUrl,
  buildWhatsAppUrl,
  createContactActivityAndTouchContact,
  diffContactEditableFields,
  formatContactType,
  formatDateTime,
  getFullName,
  normalizeEmail,
  normalizeTextInput,
} from "@/components/contacts/utils";

type EditableContact = Contact & {
  email_primary: string | null;
};

function extractEditableValues(contact: EditableContact): ContactFormValues {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name,
    phone_primary: contact.phone_primary,
    email_primary: contact.email_primary,
    city: contact.city,
    contact_type: contact.contact_type,
    lead_status: contact.lead_status,
    source: contact.source,
  };
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuthContext();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [c, setC] = useState<EditableContact | null>(null);
  const [originalContact, setOriginalContact] = useState<EditableContact | null>(
    null
  );

  const normalizedRole = String(auth.role || "").trim().toLowerCase();
  const isAdminLike =
    normalizedRole === "admin" || normalizedRole === "manager";

  const contactName = useMemo(
    () => (c ? getFullName(c) : "Scheda contatto"),
    [c]
  );

  async function loadContact() {
    if (!id) return;

    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, organization_id, first_name, last_name, phone_primary, email_primary, city, contact_type, lead_status, source, assigned_agent_id, created_at, updated_at, last_contact_at"
      )
      .eq("id", id)
      .single();

    if (error) {
      setErrorMsg(error.message);
      setC(null);
      setOriginalContact(null);
      setLoading(false);
      return;
    }

    const contact = data as EditableContact;

    if (
      auth.organizationId &&
      contact.organization_id &&
      String(contact.organization_id) !== String(auth.organizationId)
    ) {
      setErrorMsg("Non puoi visualizzare questo contatto.");
      setC(null);
      setOriginalContact(null);
      setLoading(false);
      return;
    }

    if (
      !isAdminLike &&
      auth.userId &&
      contact.assigned_agent_id &&
      String(contact.assigned_agent_id) !== String(auth.userId)
    ) {
      setErrorMsg("Non puoi visualizzare questo contatto.");
      setC(null);
      setOriginalContact(null);
      setLoading(false);
      return;
    }

    setC(contact);
    setOriginalContact(contact);
    setLoading(false);
  }

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      router.push("/login");
      return;
    }
    loadContact();
  }, [id, auth.loading, auth.isAuthenticated]);

  async function save() {
    if (!c || !originalContact) return;

    if (!auth.userId) {
      setErrorMsg("Utente non autenticato.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const nextValues = extractEditableValues(c);
    const previousValues = extractEditableValues(originalContact);
    const changes = diffContactEditableFields(previousValues, nextValues);
    const updatePayload = buildContactUpdatePayload(nextValues);

    const { error } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", c.id);

    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    if (c.organization_id && changes.length > 0) {
      try {
        for (const change of changes) {
          await supabase.from("contact_activities").insert({
            organization_id: c.organization_id,
            contact_id: c.id,
            created_by: auth.userId,
            activity_type:
              change.field === "lead_status"
                ? "status_change"
                : "profile_update",
            channel: null,
            template_id: null,
            note:
              change.field === "lead_status"
                ? `Cambio stato lead: ${
                    change.previousValue || "vuoto"
                  } → ${change.nextValue || "vuoto"}`
                : `MODIFICA ANAGRAFICA · ${change.label}: ${
                    change.previousValue || "vuoto"
                  } → ${change.nextValue || "vuoto"}`,
            metadata:
              change.field === "lead_status"
                ? {
                    source: "contact_edit",
                    from_status: change.previousValue,
                    to_status: change.nextValue,
                    field_name: change.field,
                    field_label: change.label,
                  }
                : {
                    source: "contact_edit",
                    field_name: change.field,
                    field_label: change.label,
                    previous_value: change.previousValue,
                    new_value: change.nextValue,
                  },
          });
        }
      } catch {
        setErrorMsg(
          "Contatto salvato, ma non sono riuscito a registrare tutto lo storico modifiche."
        );
      }
    }

    const updatedContact: EditableContact = {
      ...c,
      ...updatePayload,
    };

    setC(updatedContact);
    setOriginalContact(updatedContact);
    setSaving(false);
  }

  async function handleDeleteContact() {
    if (!c?.id) return;

    if (!isAdminLike) {
      setErrorMsg("Solo admin o manager possono eliminare un contatto.");
      return;
    }

    const confirmed = window.confirm(
      `Confermi l'eliminazione definitiva del contatto "${contactName}"?\n\nQuesta azione non si può annullare.`
    );

    if (!confirmed) return;

    setDeleteLoading(true);
    setErrorMsg(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setErrorMsg("Sessione non valida. Fai di nuovo login.");
        setDeleteLoading(false);
        return;
      }

      const response = await fetch("/api/contacts/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          contact_id: c.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result?.error || "Errore durante l'eliminazione.");
        setDeleteLoading(false);
        return;
      }

      router.push("/contacts");
      router.refresh();
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore durante l'eliminazione del contatto."
      );
      setDeleteLoading(false);
    }
  }

  async function handleCallClick() {
    if (!c?.phone_primary || !c.organization_id || !auth.userId) return;

    setActionLoading(true);
    setErrorMsg(null);

    try {
      const result = await createContactActivityAndTouchContact({
        organizationId: c.organization_id,
        contactId: c.id,
        createdBy: auth.userId,
        activityType: "call",
        note: "Avviata chiamata dal CRM.",
        currentLeadStatus: c.lead_status,
        metadata: {
          source: "contact_detail_actions",
          label: "Chiamata",
        },
      });

      setC((prev) =>
        prev
          ? {
              ...prev,
              last_contact_at: result.last_contact_at,
              lead_status: result.lead_status as LeadStatus | string | null,
            }
          : prev
      );

      window.location.href = `tel:${c.phone_primary}`;
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore durante la chiamata."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWhatsAppClick() {
    if (!c?.phone_primary || !c.organization_id || !auth.userId) return;

    const targetUrl = buildWhatsAppUrl(c.phone_primary, "");
    if (!targetUrl) {
      setErrorMsg("Numero WhatsApp non valido.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);

    try {
      const result = await createContactActivityAndTouchContact({
        organizationId: c.organization_id,
        contactId: c.id,
        createdBy: auth.userId,
        activityType: "whatsapp",
        note: "Aperta conversazione WhatsApp dal CRM.",
        currentLeadStatus: c.lead_status,
        channel: "whatsapp",
        metadata: {
          source: "contact_detail_actions",
          label: "WhatsApp",
          phone: c.phone_primary,
        },
      });

      setC((prev) =>
        prev
          ? {
              ...prev,
              last_contact_at: result.last_contact_at,
              lead_status: result.lead_status as LeadStatus | string | null,
            }
          : prev
      );

      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura di WhatsApp."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEmailClick() {
    if (!c?.email_primary || !c.organization_id || !auth.userId) return;

    const email = normalizeEmail(c.email_primary);
    if (!email) {
      setErrorMsg("Email non valida.");
      return;
    }

    const targetUrl = buildGmailComposeUrl(email, "", "");
    if (!targetUrl) {
      setErrorMsg("Impossibile costruire il link Gmail.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);

    try {
      const result = await createContactActivityAndTouchContact({
        organizationId: c.organization_id,
        contactId: c.id,
        createdBy: auth.userId,
        activityType: "email",
        note: "Aperta email Gmail web dal CRM.",
        currentLeadStatus: c.lead_status,
        channel: "email",
        metadata: {
          source: "contact_detail_actions",
          label: "Email",
          email,
        },
      });

      setC((prev) =>
        prev
          ? {
              ...prev,
              last_contact_at: result.last_contact_at,
              lead_status: result.lead_status as LeadStatus | string | null,
            }
          : prev
      );

      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura di Gmail."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Caricamento...</div>;
  }

  if (!c) {
    return (
      <div style={{ padding: 40 }}>
        <button onClick={() => router.back()} style={{ marginBottom: 12 }}>
          ← Indietro
        </button>

        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <b>Errore:</b> {errorMsg || "Contatto non trovato"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 1200 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          ← Indietro
        </button>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleCallClick}
            disabled={!c.phone_primary || actionLoading || deleteLoading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              opacity: c.phone_primary ? 1 : 0.5,
              cursor:
                !c.phone_primary || actionLoading || deleteLoading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            📞 Chiama
          </button>

          <button
            onClick={handleWhatsAppClick}
            disabled={!c.phone_primary || actionLoading || deleteLoading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              opacity: c.phone_primary ? 1 : 0.5,
              cursor:
                !c.phone_primary || actionLoading || deleteLoading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            💬 WhatsApp
          </button>

          <button
            onClick={handleEmailClick}
            disabled={
              !normalizeTextInput(c.email_primary) || actionLoading || deleteLoading
            }
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#111",
              opacity: normalizeTextInput(c.email_primary) ? 1 : 0.5,
              cursor:
                !normalizeTextInput(c.email_primary) ||
                actionLoading ||
                deleteLoading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            ✉️ Email
          </button>

          <button
            onClick={save}
            disabled={saving || deleteLoading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: saving || deleteLoading ? "not-allowed" : "pointer",
              opacity: saving || deleteLoading ? 0.7 : 1,
            }}
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>

          {isAdminLike && (
            <button
              onClick={handleDeleteContact}
              disabled={deleteLoading || saving || actionLoading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #b42318",
                background: "#fff",
                color: "#b42318",
                cursor:
                  deleteLoading || saving || actionLoading
                    ? "not-allowed"
                    : "pointer",
                opacity: deleteLoading || saving || actionLoading ? 0.7 : 1,
              }}
            >
              {deleteLoading ? "Eliminazione..." : "🗑 Elimina contatto"}
            </button>
          )}
        </div>
      </div>

      <h2 style={{ marginBottom: 6 }}>{contactName || "Scheda contatto"}</h2>

      <div style={{ opacity: 0.7, marginBottom: 6 }}>ID: {c.id}</div>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>
        Ultimo contatto: {formatDateTime(c.last_contact_at)}
      </div>
      <div style={{ opacity: 0.7, marginBottom: 18 }}>
        Creato il: {formatDateTime(c.created_at)}
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          <b>Errore:</b> {errorMsg}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Dati contatto</div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <input
              value={c.first_name ?? ""}
              onChange={(e) =>
                setC({ ...c, first_name: e.target.value || null })
              }
              placeholder="Nome"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />

            <input
              value={c.last_name ?? ""}
              onChange={(e) => setC({ ...c, last_name: e.target.value || null })}
              placeholder="Cognome"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />

            <input
              value={c.phone_primary ?? ""}
              onChange={(e) =>
                setC({ ...c, phone_primary: e.target.value || null })
              }
              placeholder="Telefono"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />

            <input
              value={c.email_primary ?? ""}
              onChange={(e) =>
                setC({ ...c, email_primary: e.target.value || null })
              }
              placeholder="Email"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />

            <input
              value={c.city ?? ""}
              onChange={(e) => setC({ ...c, city: e.target.value || null })}
              placeholder="Città"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />

            <select
              value={c.contact_type ?? ""}
              onChange={(e) =>
                setC({ ...c, contact_type: e.target.value || null })
              }
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
              value={c.lead_status ?? ""}
              onChange={(e) =>
                setC({ ...c, lead_status: e.target.value || null })
              }
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            >
              <option value="">Stato (vuoto)</option>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <input
              value={c.source ?? ""}
              onChange={(e) => setC({ ...c, source: e.target.value || null })}
              placeholder="Fonte"
              style={{
                gridColumn: "1 / -1",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
          </div>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            Attività / esiti
          </div>

          <Activities
            contactId={c.id}
            organizationId={c.organization_id}
            leadStatus={c.lead_status}
            onActivityCreated={({ last_contact_at, lead_status }) =>
              setC((prev) =>
                prev
                  ? {
                      ...prev,
                      last_contact_at,
                      lead_status,
                    }
                  : prev
              )
            }
          />
        </div>
      </div>
    </div>
  );
}