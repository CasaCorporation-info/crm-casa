"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Contact = {
  id: string;
  organization_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  email_primary: string | null;
  city: string | null;
  contact_type: string | null;
  lead_status: string | null;
  source: string | null;
  last_contact_at: string | null;
};

type ContactActivity = {
  id: string;
  contact_id: string;
  activity_type: string | null;
  note: string;
  created_at: string | null;
  created_by: string | null;
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

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [c, setC] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [newActivityText, setNewActivityText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setCurrentUserId(session?.user?.id ?? null);
    }

    bootstrap();
  }, []);

  async function loadContact() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, organization_id, first_name, last_name, phone_primary, email_primary, city, contact_type, lead_status, source, last_contact_at"
      )
      .eq("id", id)
      .single();

    if (error) {
      setErrorMsg(error.message);
      setC(null);
    } else {
      setC(data as Contact);
    }

    setLoading(false);
  }

  async function loadActivities() {
    setLoadingActivities(true);

    const { data, error } = await supabase
      .from("contact_activities")
      .select("id, contact_id, activity_type, note, created_at, created_by")
      .eq("contact_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setActivities([]);
    } else {
      setActivities((data || []) as ContactActivity[]);
    }

    setLoadingActivities(false);
  }

  useEffect(() => {
    if (!id) return;

    loadContact();
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!c) return;
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("contacts")
      .update({
        first_name: c.first_name,
        last_name: c.last_name,
        phone_primary: c.phone_primary,
        email_primary: c.email_primary,
        city: c.city,
        contact_type: c.contact_type,
        lead_status: c.lead_status,
        source: c.source,
      })
      .eq("id", c.id);

    if (error) {
      setErrorMsg(error.message);
    }

    setSaving(false);
  }

  async function addActivity() {
    if (!c) return;

    const note = newActivityText.trim();

    if (!note) {
      setErrorMsg("Scrivi un esito prima di salvare.");
      return;
    }

    if (!c.organization_id) {
      setErrorMsg("organization_id mancante sul contatto.");
      return;
    }

    setSavingActivity(true);
    setErrorMsg(null);

    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("contact_activities")
      .insert({
        organization_id: c.organization_id,
        contact_id: c.id,
        created_by: currentUserId,
        activity_type: "note",
        note,
      });

    if (insertError) {
      setErrorMsg(insertError.message);
      setSavingActivity(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ last_contact_at: nowIso })
      .eq("id", c.id);

    if (updateError) {
      setErrorMsg(updateError.message);
      setSavingActivity(false);
      return;
    }

    setNewActivityText("");
    setC((prev) => (prev ? { ...prev, last_contact_at: nowIso } : prev));

    await loadActivities();

    setSavingActivity(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Caricamento...</div>;

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

        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={c.phone_primary ? `tel:${c.phone_primary}` : "#"}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              textDecoration: "none",
              color: "#111",
              opacity: c.phone_primary ? 1 : 0.5,
              pointerEvents: c.phone_primary ? "auto" : "none",
            }}
          >
            📞 Chiama
          </a>

          <button
            onClick={save}
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
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>

      <h2 style={{ marginBottom: 6 }}>
        {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Scheda contatto"}
      </h2>

      <div style={{ opacity: 0.7, marginBottom: 6 }}>ID: {c.id}</div>
      <div style={{ opacity: 0.7, marginBottom: 18 }}>
        Ultimo contatto: {formatDateTime(c.last_contact_at)}
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input
              value={c.first_name ?? ""}
              onChange={(e) => setC({ ...c, first_name: e.target.value || null })}
              placeholder="Nome"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={c.last_name ?? ""}
              onChange={(e) => setC({ ...c, last_name: e.target.value || null })}
              placeholder="Cognome"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={c.phone_primary ?? ""}
              onChange={(e) => setC({ ...c, phone_primary: e.target.value || null })}
              placeholder="Telefono"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={c.email_primary ?? ""}
              onChange={(e) => setC({ ...c, email_primary: e.target.value || null })}
              placeholder="Email"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={c.city ?? ""}
              onChange={(e) => setC({ ...c, city: e.target.value || null })}
              placeholder="Città"
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            />

            <select
              value={c.contact_type ?? ""}
              onChange={(e) => setC({ ...c, contact_type: e.target.value || null })}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="">Tipo (vuoto)</option>
              <option value="owner">owner</option>
              <option value="buyer">buyer</option>
              <option value="investor">investor</option>
              <option value="tenant">tenant</option>
              <option value="ex_client">ex_client</option>
              <option value="lead">lead</option>
              <option value="partner">partner</option>
            </select>

            <select
              value={c.lead_status ?? ""}
              onChange={(e) => setC({ ...c, lead_status: e.target.value || null })}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="">Stato (vuoto)</option>
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="meeting">meeting</option>
              <option value="valuation">valuation</option>
              <option value="negotiation">negotiation</option>
              <option value="client">client</option>
              <option value="lost">lost</option>
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
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Attività / esiti</div>

          <textarea
            value={newActivityText}
            onChange={(e) => setNewActivityText(e.target.value)}
            placeholder="Scrivi qui l'esito del contatto, nota, aggiornamento chiamata, follow-up..."
            rows={5}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: 10,
            }}
          />

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={addActivity}
              disabled={savingActivity}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: savingActivity ? "not-allowed" : "pointer",
                opacity: savingActivity ? 0.7 : 1,
              }}
            >
              {savingActivity ? "Salvataggio..." : "Salva esito"}
            </button>

            <button
              onClick={loadActivities}
              disabled={loadingActivities}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: loadingActivities ? "not-allowed" : "pointer",
                opacity: loadingActivities ? 0.7 : 1,
              }}
            >
              Aggiorna attività
            </button>
          </div>

          <div style={{ fontWeight: 700, marginBottom: 10 }}>Storico attività</div>

          {loadingActivities ? (
            <div style={{ opacity: 0.7 }}>Caricamento attività...</div>
          ) : activities.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nessuna attività registrata.</div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 500,
                overflowY: "auto",
              }}
            >
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    border: "1px solid #e8e8e8",
                    borderRadius: 10,
                    background: "#fafafa",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                      marginBottom: 6,
                    }}
                  >
                    {activity.activity_type || "note"} •{" "}
                    {formatDateTime(activity.created_at)}
                  </div>

                  <div style={{ whiteSpace: "pre-wrap" }}>{activity.note}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}