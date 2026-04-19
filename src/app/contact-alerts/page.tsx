"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

type ActivityRow = {
  id: string;
  contact_id: string | null;
  created_at: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  template_id: string | null;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  city: string | null;
  lead_status: string | null;
  last_contact_at: string | null;
};

type AlertRow = {
  activityId: string;
  contactId: string;
  contactName: string;
  phone: string;
  city: string;
  leadStatus: string;
  createdAt: string | null;
  alertType: "opened" | "button_clicked";
  campaignName: string;
  buttonLabel: string;
  whatsappNumber: string;
  note: string;
  priority: "media" | "alta";
  lastContactAt: string | null;
  isWorkedAfterEvent: boolean;
};

const ALERT_LOOKBACK_DAYS = 7;

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function buildContactName(contact?: ContactRow) {
  if (!contact) return "Contatto non trovato";

  const fullName = [contact.first_name, contact.last_name]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ");

  return fullName || "Senza nome";
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isHotButton(label: string) {
  const normalized = normalizeText(label);

  return (
    normalized.includes("interessa") ||
    normalized.includes("mi interessa") ||
    normalized.includes("valutazione") ||
    normalized.includes("vorrei") ||
    normalized.includes("richiam") ||
    normalized.includes("contatt")
  );
}

function extractString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function extractAlertType(
  metadata: Record<string, unknown> | null
): "opened" | "button_clicked" {
  const eventType = extractString(metadata, "event_type");
  return eventType === "button_clicked" ? "button_clicked" : "opened";
}

function toTime(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function ContactAlertsPage() {
  const auth = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, ContactRow>>({});
  const [myWhatsAppNumber, setMyWhatsAppNumber] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "media" | "alta">(
    "all"
  );
  const [typeFilter, setTypeFilter] = useState<"all" | "opened" | "button_clicked">(
    "all"
  );
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [hideOpenedOnly, setHideOpenedOnly] = useState(false);

  const normalizedRole = String(auth.role || "").trim().toLowerCase();
  const isAdminLike = normalizedRole === "admin" || normalizedRole === "manager";

  useEffect(() => {
    if (auth.loading) return;
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.userId, auth.organizationId, auth.role]);

  async function loadAlerts() {
    if (!auth.userId || !auth.organizationId) {
      setLoading(false);
      setErrorMsg("Utente o organizzazione non disponibili.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("whatsapp_number")
        .eq("id", auth.userId)
        .single();

      if (profileError) {
        setErrorMsg("Errore nel caricamento profilo.");
        setLoading(false);
        return;
      }

      const currentNumber = String(profile?.whatsapp_number || "").trim() || null;
      setMyWhatsAppNumber(currentNumber);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ALERT_LOOKBACK_DAYS);
      const cutoffIso = cutoffDate.toISOString();

      const { data: activitiesData, error: activitiesError } = await supabase
        .from("contact_activities")
        .select("id, contact_id, created_at, note, metadata, template_id")
        .eq("organization_id", auth.organizationId)
        .eq("activity_type", "system")
        .eq("channel", "whatsapp")
        .in("metadata->>source", ["whatsapp_landing_open", "whatsapp_landing_click"])
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (activitiesError) {
        setErrorMsg(activitiesError.message);
        setLoading(false);
        return;
      }

      let safeActivities = (activitiesData ?? []) as ActivityRow[];

      if (!isAdminLike && currentNumber) {
        safeActivities = safeActivities.filter((item) => {
          const metadata = item.metadata as Record<string, unknown> | null;
          const number = extractString(metadata, "whatsapp_number");
          return number === currentNumber;
        });
      }

      setActivities(safeActivities);

      const contactIds = Array.from(
        new Set(safeActivities.map((item) => item.contact_id).filter(Boolean))
      ) as string[];

      if (contactIds.length === 0) {
        setContactsMap({});
        setLoading(false);
        return;
      }

      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, phone_primary, city, lead_status, last_contact_at"
        )
        .in("id", contactIds);

      if (contactsError) {
        setErrorMsg(contactsError.message);
        setLoading(false);
        return;
      }

      const nextContactsMap: Record<string, ContactRow> = {};
      for (const contact of (contactsData ?? []) as ContactRow[]) {
        nextContactsMap[contact.id] = contact;
      }

      setContactsMap(nextContactsMap);
      setLoading(false);
    } catch {
      setErrorMsg("Errore imprevisto nel caricamento alert.");
      setLoading(false);
    }
  }

  const alerts = useMemo<AlertRow[]>(() => {
    const rawAlerts = activities
      .map((activity) => {
        if (!activity.contact_id) return null;

        const metadata = activity.metadata as Record<string, unknown> | null;
        const alertType = extractAlertType(metadata);
        const buttonLabel = extractString(metadata, "button_label");
        const campaignName =
          extractString(metadata, "campaign_name") || "Campagna senza nome";
        const whatsappNumber = extractString(metadata, "whatsapp_number") || "—";

        const priority: "media" | "alta" =
          alertType === "button_clicked" && isHotButton(buttonLabel)
            ? "alta"
            : alertType === "button_clicked"
            ? "alta"
            : "media";

        const contact = contactsMap[activity.contact_id];
        const eventTime = toTime(activity.created_at);
        const lastContactTime = toTime(contact?.last_contact_at || null);

        return {
          activityId: activity.id,
          contactId: activity.contact_id,
          contactName: buildContactName(contact),
          phone: String(contact?.phone_primary || "").trim() || "—",
          city: String(contact?.city || "").trim() || "—",
          leadStatus: String(contact?.lead_status || "").trim() || "—",
          createdAt: activity.created_at,
          alertType,
          campaignName,
          buttonLabel: buttonLabel || "—",
          whatsappNumber,
          note: String(activity.note || "").trim() || "—",
          priority,
          lastContactAt: contact?.last_contact_at || null,
          isWorkedAfterEvent:
            lastContactTime > 0 && eventTime > 0 && lastContactTime > eventTime,
        } satisfies AlertRow;
      })
      .filter(Boolean) as AlertRow[];

    const notWorkedAlerts = rawAlerts.filter((item) => !item.isWorkedAfterEvent);

    const latestByContact = new Map<string, AlertRow>();

    for (const alert of notWorkedAlerts) {
      const existing = latestByContact.get(alert.contactId);
      if (!existing || toTime(alert.createdAt) > toTime(existing.createdAt)) {
        latestByContact.set(alert.contactId, alert);
      }
    }

    return Array.from(latestByContact.values());
  }, [activities, contactsMap]);

  const campaignOptions = useMemo(() => {
    return Array.from(new Set(alerts.map((item) => item.campaignName))).sort((a, b) =>
      a.localeCompare(b, "it")
    );
  }, [alerts]);

  const visibleAlerts = useMemo(() => {
    let result = [...alerts];

    if (priorityFilter !== "all") {
      result = result.filter((item) => item.priority === priorityFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((item) => item.alertType === typeFilter);
    }

    if (campaignFilter !== "all") {
      result = result.filter((item) => item.campaignName === campaignFilter);
    }

    if (hideOpenedOnly) {
      result = result.filter((item) => item.alertType !== "opened");
    }

    const normalizedSearch = normalizeText(search);
    if (normalizedSearch) {
      result = result.filter((item) => {
        const haystack = [
          item.contactName,
          item.phone,
          item.city,
          item.leadStatus,
          item.campaignName,
          item.buttonLabel,
          item.whatsappNumber,
          item.note,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });
    }

    return result.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [
    alerts,
    priorityFilter,
    typeFilter,
    campaignFilter,
    hideOpenedOnly,
    search,
  ]);

  const totals = useMemo(() => {
    return {
      total: alerts.length,
      opened: alerts.filter((item) => item.alertType === "opened").length,
      clicked: alerts.filter((item) => item.alertType === "button_clicked").length,
      high: alerts.filter((item) => item.priority === "alta").length,
    };
  }, [alerts]);

  return (
    <div style={{ padding: 24 }}>
      <div style={headerWrap}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Alert IA</h1>
          <p style={subText}>
            Mostra solo lead recenti che hanno interagito e non sono ancora stati
            lavorati dopo l’evento.
          </p>
        </div>

        <button onClick={loadAlerts} style={refreshButton}>
          Aggiorna
        </button>
      </div>

      {!isAdminLike && (
        <div style={infoBox}>
          Visualizzazione filtrata sul tuo numero WhatsApp:
          <strong> {myWhatsAppNumber || "non configurato"}</strong>
        </div>
      )}

      {errorMsg ? <div style={errorBox}>{errorMsg}</div> : null}

      {loading ? (
        <div style={{ marginTop: 24 }}>Caricamento...</div>
      ) : (
        <>
          <div style={statsGrid}>
            <StatCard title="Alert attivi" value={totals.total} />
            <StatCard title="Aperture attive" value={totals.opened} />
            <StatCard title="Click attivi" value={totals.clicked} />
            <StatCard title="Priorità alta" value={totals.high} />
          </div>

          <div style={sectionCard}>
            <div style={sectionHeader}>
              <h2 style={sectionTitleNoMargin}>Filtri</h2>
            </div>

            <div style={filtersGrid}>
              <div style={fieldWrap}>
                <label style={labelStyle}>Ricerca</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, telefono, campagna, bottone..."
                  style={inputStyle}
                />
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Priorità</label>
                <select
                  value={priorityFilter}
                  onChange={(e) =>
                    setPriorityFilter(e.target.value as "all" | "media" | "alta")
                  }
                  style={selectStyle}
                >
                  <option value="all">Tutte</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Tipo alert</label>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(
                      e.target.value as "all" | "opened" | "button_clicked"
                    )
                  }
                  style={selectStyle}
                >
                  <option value="all">Tutti</option>
                  <option value="opened">Solo aperture</option>
                  <option value="button_clicked">Solo click</option>
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Campagna</label>
                <select
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  style={selectStyle}
                >
                  <option value="all">Tutte le campagne</option>
                  {campaignOptions.map((campaign) => (
                    <option key={campaign} value={campaign}>
                      {campaign}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label style={checkboxWrap}>
              <input
                type="checkbox"
                checked={hideOpenedOnly}
                onChange={(e) => setHideOpenedOnly(e.target.checked)}
              />
              <span>Nascondi aperture semplici e mostra solo click</span>
            </label>
          </div>

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Lead da lavorare</h2>

            {visibleAlerts.length === 0 ? (
              <div>Nessun alert attivo disponibile.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Priorità</th>
                      <th style={thStyle}>Data evento</th>
                      <th style={thStyle}>Tipo</th>
                      <th style={thStyle}>Contatto</th>
                      <th style={thStyle}>Telefono</th>
                      <th style={thStyle}>Città</th>
                      <th style={thStyle}>Stato lead</th>
                      <th style={thStyle}>Campagna</th>
                      <th style={thStyle}>Bottone</th>
                      <th style={thStyle}>Numero agente</th>
                      <th style={thStyle}>Ultimo contatto</th>
                      <th style={thStyle}>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAlerts.map((item) => (
                      <tr key={item.activityId}>
                        <td style={tdStyle}>
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td style={tdStyle}>{formatDateTime(item.createdAt)}</td>
                        <td style={tdStyle}>
                          {item.alertType === "opened" ? "Apertura link" : "Click bottone"}
                        </td>
                        <td style={tdStyleStrong}>{item.contactName}</td>
                        <td style={tdStyle}>{item.phone}</td>
                        <td style={tdStyle}>{item.city}</td>
                        <td style={tdStyle}>{item.leadStatus}</td>
                        <td style={tdStyle}>{item.campaignName}</td>
                        <td style={tdStyle}>{item.buttonLabel}</td>
                        <td style={tdStyle}>{item.whatsappNumber}</td>
                        <td style={tdStyle}>{formatDateTime(item.lastContactAt)}</td>
                        <td style={tdStyle}>
                          <Link
                            href={`/contacts/${item.contactId}`}
                            style={primaryLinkButton}
                          >
                            Apri contatto
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={statCard}>
      <div style={statTitle}>{title}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "media" | "alta" }) {
  const styleMap: Record<"media" | "alta", React.CSSProperties> = {
    media: {
      background: "#fff7ed",
      color: "#c2410c",
      border: "1px solid #fdba74",
    },
    alta: {
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    },
  };

  return (
    <span
      style={{
        ...badgeBase,
        ...styleMap[priority],
      }}
    >
      {priority}
    </span>
  );
}

const headerWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 20,
  flexWrap: "wrap",
};

const subText: React.CSSProperties = {
  margin: "8px 0 0 0",
  color: "#64748b",
};

const refreshButton: React.CSSProperties = {
  border: "1px solid #d0d7de",
  background: "#ffffff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

const infoBox: React.CSSProperties = {
  marginBottom: 16,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
  borderRadius: 12,
  padding: 12,
};

const errorBox: React.CSSProperties = {
  marginBottom: 16,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  borderRadius: 12,
  padding: 12,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const statCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 16,
};

const statTitle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 8,
};

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "#0f172a",
};

const sectionCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 16,
  marginBottom: 20,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  marginBottom: 12,
  fontSize: 20,
};

const sectionTitleNoMargin: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
};

const filtersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const fieldWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
};

const checkboxWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  marginTop: 14,
  fontSize: 14,
  color: "#0f172a",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#475569",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  fontSize: 14,
};

const tdStyleStrong: React.CSSProperties = {
  ...tdStyle,
  fontWeight: 700,
};

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
};

const primaryLinkButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#0f172a",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 700,
};