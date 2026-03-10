"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserProfile = {
  id: string;
  role: string | null;
  organization_id: string | null;
};

type MessageTemplate = {
  id: string;
  organization_id: string;
  type: "whatsapp" | "email";
  title: string;
  subject: string | null;
  message: string;
  created_at: string;
  updated_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TemplatesPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<"" | "whatsapp" | "email">("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<"whatsapp" | "email">("whatsapp");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const normalizedRole = String(currentUserRole || "")
    .trim()
    .toLowerCase();

  const canView =
    normalizedRole === "admin" ||
    normalizedRole === "manager" ||
    normalizedRole === "agent";

  const canManage = normalizedRole === "admin";

  const filteredTemplates = useMemo(() => {
    if (!filterType) return templates;
    return templates.filter((t) => t.type === filterType);
  }, [templates, filterType]);

  async function bootstrapAuth() {
    setCheckingAuth(true);
    setErrorMsg(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push("/login");
      return;
    }

    const userId = session.user.id;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      setErrorMsg("Profilo utente non trovato.");
      setCheckingAuth(false);
      setLoading(false);
      return;
    }

    const typedProfile = profile as UserProfile;
    setCurrentUserRole(typedProfile.role);
    setOrganizationId(typedProfile.organization_id);
    setCheckingAuth(false);
  }

  async function loadTemplates(nextOrgId?: string | null) {
    const orgId = nextOrgId ?? organizationId;

    if (!orgId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("message_templates")
      .select(
        "id, organization_id, type, title, subject, message, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setTemplates([]);
      setLoading(false);
      return;
    }

    setTemplates((data || []) as MessageTemplate[]);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setType("whatsapp");
    setTitle("");
    setSubject("");
    setMessage("");
  }

  function startEdit(template: MessageTemplate) {
    if (!canManage) return;

    setEditingId(template.id);
    setType(template.type);
    setTitle(template.title || "");
    setSubject(template.subject || "");
    setMessage(template.message || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!canManage) return;

    setErrorMsg(null);

    if (!organizationId) {
      setErrorMsg("organization_id mancante nel profilo.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle) {
      setErrorMsg("Inserisci un titolo template.");
      return;
    }

    if (!cleanMessage) {
      setErrorMsg("Inserisci il contenuto del messaggio.");
      return;
    }

    if (type === "email" && !cleanSubject) {
      setErrorMsg("Per i template email inserisci anche l'oggetto.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("message_templates")
        .update({
          type,
          title: cleanTitle,
          subject: type === "email" ? cleanSubject : null,
          message: cleanMessage,
        })
        .eq("id", editingId)
        .eq("organization_id", organizationId);

      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("message_templates").insert({
        organization_id: organizationId,
        type,
        title: cleanTitle,
        subject: type === "email" ? cleanSubject : null,
        message: cleanMessage,
      });

      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }
    }

    resetForm();
    await loadTemplates(organizationId);
    setSaving(false);
  }

  async function handleDelete(templateId: string, templateTitle: string) {
    if (!canManage) return;

    const confirmed = window.confirm(
      `Eliminare definitivamente il template "${templateTitle}"?`
    );

    if (!confirmed) return;
    if (!organizationId) return;

    setDeletingId(templateId);
    setErrorMsg(null);

    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", templateId)
      .eq("organization_id", organizationId);

    if (error) {
      setErrorMsg(error.message);
      setDeletingId(null);
      return;
    }

    if (editingId === templateId) {
      resetForm();
    }

    await loadTemplates(organizationId);
    setDeletingId(null);
  }

  useEffect(() => {
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkingAuth && canView && organizationId) {
      loadTemplates(organizationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, organizationId, currentUserRole]);

  if (checkingAuth) {
    return (
      <main style={{ padding: 32 }}>
        <div>Controllo accesso...</div>
      </main>
    );
  }

  if (!canView) {
    return (
      <main style={{ padding: 32 }}>
        <div
          style={{
            maxWidth: 700,
            border: "1px solid #f1c7c7",
            background: "#fff4f4",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Accesso negato</div>
          <div style={{ marginBottom: 12 }}>
            Non hai i permessi per vedere i template.
          </div>
          <button
            onClick={() => router.push("/contacts")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Torna ai lead
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 32 }}>
      <div style={{ maxWidth: 1300 }}>
        <h1 style={{ marginBottom: 6 }}>Templates</h1>
        <div style={{ opacity: 0.7, marginBottom: 18 }}>
          {canManage
            ? "Gestione template WhatsApp ed Email"
            : "Visualizzazione template WhatsApp ed Email"}
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
            gridTemplateColumns: canManage ? "420px 1fr" : "1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {canManage && (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                background: "#fff",
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 12 }}>
                {editingId ? "Modifica template" : "Nuovo template"}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Tipo</div>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "whatsapp" | "email")}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "#fff",
                    }}
                  >
                    <option value="whatsapp">whatsapp</option>
                    <option value="email">email</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Titolo</div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Es: Primo contatto proprietario"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                {type === "email" && (
                  <div>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>Oggetto email</div>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Es: Richiesta valutazione immobile"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Messaggio</div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Scrivi qui il testo del template..."
                    rows={10}
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving
                      ? "Salvataggio..."
                      : editingId
                      ? "Salva modifiche"
                      : "Crea template"}
                  </button>

                  <button
                    onClick={resetForm}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              background: "#fff",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #ddd",
                background: "#fafafa",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                Lista template ({filteredTemplates.length})
              </div>

              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "" | "whatsapp" | "email")
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                }}
              >
                <option value="">Tutti i tipi</option>
                <option value="whatsapp">whatsapp</option>
                <option value="email">email</option>
              </select>
            </div>

            {loading ? (
              <div style={{ padding: 16 }}>Caricamento...</div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{ padding: 16, opacity: 0.7 }}>
                Nessun template trovato.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 0 }}>
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      padding: 16,
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div
                          style={{
                            display: "inline-block",
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #ddd",
                            marginBottom: 8,
                            textTransform: "uppercase",
                          }}
                        >
                          {template.type}
                        </div>

                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          {template.title}
                        </div>

                        {template.type === "email" && (
                          <div style={{ marginBottom: 8 }}>
                            <b>Oggetto:</b> {template.subject || "-"}
                          </div>
                        )}

                        <div
                          style={{
                            whiteSpace: "pre-wrap",
                            opacity: 0.9,
                            lineHeight: 1.5,
                            marginBottom: 10,
                          }}
                        >
                          {template.message}
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.65 }}>
                          Creato: {formatDateTime(template.created_at)} · Aggiornato:{" "}
                          {formatDateTime(template.updated_at)}
                        </div>
                      </div>

                      {canManage && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => startEdit(template)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            Modifica
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(template.id, template.title || "Template")
                            }
                            disabled={deletingId === template.id}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #111",
                              background: "#111",
                              color: "#fff",
                              cursor:
                                deletingId === template.id ? "not-allowed" : "pointer",
                              opacity: deletingId === template.id ? 0.7 : 1,
                            }}
                          >
                            {deletingId === template.id ? "Eliminazione..." : "Elimina"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}