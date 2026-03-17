"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ContactActivity, QuickActivityUiType } from "./types";
import {
  createContactActivityAndTouchContact,
  formatActivityTypeLabel,
  formatDateShort,
  formatTime,
  getActivityDisplayNote,
  getActivityTimelineDotStyle,
  mapQuickActivityTypeToDbValue,
} from "./utils";

const DEFAULT_ACTIVITY_TYPE: QuickActivityUiType = "Note";

export default function Activities({
  contactId,
  organizationId,
  leadStatus,
  onActivityCreated,
}: {
  contactId: string;
  organizationId: string | null;
  leadStatus: string | null;
  onActivityCreated?: (payload: {
    last_contact_at: string;
    lead_status: string | null;
  }) => void;
}) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [type, setType] = useState<QuickActivityUiType>(DEFAULT_ACTIVITY_TYPE);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  async function loadActivities() {
    if (!contactId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("contact_activities")
      .select(
        "id, organization_id, contact_id, created_by, activity_type, channel, template_id, note, metadata, created_at"
      )
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setActivities([]);
      setLoading(false);
      return;
    }

    setActivities((data || []) as ContactActivity[]);
    setLoading(false);
  }

  async function addActivity() {
    const cleanNote = note.trim();

    if (!organizationId) {
      setErrorMsg("organization_id mancante sul contatto.");
      return;
    }

    if (!cleanNote) {
      setErrorMsg("Scrivi una nota prima di salvare.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const result = await createContactActivityAndTouchContact({
        organizationId,
        contactId,
        createdBy: currentUserId,
        activityType: mapQuickActivityTypeToDbValue(type),
        note: cleanNote,
        currentLeadStatus: leadStatus,
        metadata: {
          source: "contact_detail",
          label: type,
        },
      });

      setNote("");
      setType(DEFAULT_ACTIVITY_TYPE);

      onActivityCreated?.({
        last_contact_at: result.last_contact_at,
        lead_status: result.lead_status,
      });

      await loadActivities();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Errore nel salvataggio."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, [contactId]);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Aggiungi attività</div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuickActivityUiType)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              minWidth: 180,
            }}
          >
            <option value="Chiamata">Chiamata</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">Email</option>
            <option value="Incontro">Incontro</option>
            <option value="Note">Note</option>
          </select>

          <button
            onClick={addActivity}
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
            {saving ? "Salvataggio..." : "Aggiungi"}
          </button>
        </div>

        <textarea
          placeholder="Scrivi una nota attività..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <b>Errore:</b> {errorMsg}
        </div>
      )}

      <div style={{ fontWeight: 700, marginBottom: 12 }}>Storico attività</div>

      {loading ? (
        <div style={{ opacity: 0.7 }}>Caricamento attività...</div>
      ) : activities.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Nessuna attività registrata.</div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: 560,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {activities.map((activity, index) => {
            const dotStyle = getActivityTimelineDotStyle(activity.activity_type);
            const isLast = index === activities.length - 1;

            return (
              <div
                key={activity.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                    minHeight: 72,
                  }}
                >
                  {!isLast && (
                    <div
                      style={{
                        position: "absolute",
                        top: 14,
                        bottom: -18,
                        width: 2,
                        background: "#ececec",
                      }}
                    />
                  )}

                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      marginTop: 6,
                      ...dotStyle,
                    }}
                  />
                </div>

                <div
                  style={{
                    border: "1px solid #ebebeb",
                    borderRadius: 14,
                    background: "#fff",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {formatActivityTypeLabel(activity.activity_type)}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatTime(activity.created_at)} ·{" "}
                      {formatDateShort(activity.created_at)}
                    </div>
                  </div>

                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                      color: "#1f2937",
                    }}
                  >
                    {getActivityDisplayNote(activity)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}