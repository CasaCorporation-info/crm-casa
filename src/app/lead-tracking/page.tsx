"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

type CampaignLinkRow = {
  id: string;
  token: string;
  contact_id: string | null;
  template_id: string | null;
  campaign_name: string | null;
  whatsapp_number: string | null;
  created_at: string | null;
};

type CampaignEventRow = {
  id: string;
  link_id: string | null;
  contact_id: string | null;
  event_type: "opened" | "button_clicked" | string;
  button_key: string | null;
  button_label: string | null;
  created_at: string | null;
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  city: string | null;
  lead_status: string | null;
};

type TrackedLeadRow = {
  linkId: string;
  token: string;
  contactId: string | null;
  contactName: string;
  contactPhone: string;
  city: string;
  leadStatus: string;
  campaignName: string;
  senderWhatsAppNumber: string;
  sentAt: string | null;
  openedCount: number;
  clickedCount: number;
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
  clickedButtons: string[];
  engagementLevel: "basso" | "medio" | "alto";
};

type EventDetail = {
  id: string;
  linkId: string;
  eventType: string;
  buttonLabel: string;
  createdAt: string | null;
};

const PAGE_LIMIT = 1000;

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

function getEngagementLevel(
  openedCount: number,
  clickedCount: number,
  clickedButtons: string[]
): "basso" | "medio" | "alto" {
  if (
    clickedCount > 0 &&
    clickedButtons.some((button) => isHotButton(button))
  ) {
    return "alto";
  }

  if (clickedCount > 0 || openedCount >= 2) {
    return "medio";
  }

  return "basso";
}

export default function LeadTrackingPage() {
  const auth = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [links, setLinks] = useState<CampaignLinkRow[]>([]);
  const [events, setEvents] = useState<CampaignEventRow[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, ContactRow>>({});

  const [myWhatsAppNumber, setMyWhatsAppNumber] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<
    "all" | "opened" | "button_clicked"
  >("all");
  const [engagementFilter, setEngagementFilter] = useState<
    "all" | "basso" | "medio" | "alto"
  >("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [hotOnly, setHotOnly] = useState(false);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const normalizedRole = String(auth.role || "").trim().toLowerCase();
  const isAdminLike = normalizedRole === "admin" || normalizedRole === "manager";

  useEffect(() => {
    if (auth.loading) return;
    loadTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.userId, auth.organizationId, auth.role]);

  async function loadTracking() {
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

      let linksQuery = supabase
        .from("whatsapp_campaign_links")
        .select(
          "id, token, contact_id, template_id, campaign_name, whatsapp_number, created_at"
        )
        .eq("organization_id", auth.organizationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);

      if (!isAdminLike && currentNumber) {
        linksQuery = linksQuery.eq("whatsapp_number", currentNumber);
      }

      const { data: linksData, error: linksError } = await linksQuery;

      if (linksError) {
        setErrorMsg(linksError.message);
        setLoading(false);
        return;
      }

      const safeLinks = (linksData ?? []) as CampaignLinkRow[];
      setLinks(safeLinks);

      if (safeLinks.length === 0) {
        setEvents([]);
        setContactsMap({});
        setActiveLinkId(null);
        setLoading(false);
        return;
      }

      const linkIds = safeLinks.map((item) => item.id);
      const contactIds = Array.from(
        new Set(safeLinks.map((item) => item.contact_id).filter(Boolean))
      ) as string[];

      const [eventsResult, contactsResult] = await Promise.all([
        supabase
          .from("whatsapp_campaign_events")
          .select(
            "id, link_id, contact_id, event_type, button_key, button_label, created_at"
          )
          .in("link_id", linkIds)
          .order("created_at", { ascending: false })
          .limit(PAGE_LIMIT * 8),
        contactIds.length > 0
          ? supabase
              .from("contacts")
              .select("id, first_name, last_name, phone_primary, city, lead_status")
              .in("id", contactIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (eventsResult.error) {
        setErrorMsg(eventsResult.error.message);
        setLoading(false);
        return;
      }

      if (contactsResult.error) {
        setErrorMsg(contactsResult.error.message);
        setLoading(false);
        return;
      }

      const safeEvents = (eventsResult.data ?? []) as CampaignEventRow[];
      const safeContacts = (contactsResult.data ?? []) as ContactRow[];

      const nextContactsMap: Record<string, ContactRow> = {};
      for (const contact of safeContacts) {
        nextContactsMap[contact.id] = contact;
      }

      setEvents(safeEvents);
      setContactsMap(nextContactsMap);
      setLoading(false);
    } catch {
      setErrorMsg("Errore imprevisto nel caricamento tracciamento leads.");
      setLoading(false);
    }
  }

  const trackedLeads = useMemo<TrackedLeadRow[]>(() => {
    const eventsByLinkId = new Map<string, CampaignEventRow[]>();

    for (const event of events) {
      const key = String(event.link_id || "").trim();
      if (!key) continue;
      if (!eventsByLinkId.has(key)) eventsByLinkId.set(key, []);
      eventsByLinkId.get(key)!.push(event);
    }

    return links
      .map((link) => {
        const relatedEvents = eventsByLinkId.get(link.id) ?? [];
        if (relatedEvents.length === 0) return null;

        const openedEvents = relatedEvents.filter((e) => e.event_type === "opened");
        const clickedEvents = relatedEvents.filter(
          (e) => e.event_type === "button_clicked"
        );

        const clickedButtons = Array.from(
          new Set(
            clickedEvents
              .map((e) => String(e.button_label || "").trim())
              .filter(Boolean)
          )
        );

        const contact = link.contact_id ? contactsMap[link.contact_id] : undefined;

        return {
          linkId: link.id,
          token: link.token,
          contactId: link.contact_id,
          contactName: buildContactName(contact),
          contactPhone: String(contact?.phone_primary || "").trim() || "—",
          city: String(contact?.city || "").trim() || "—",
          leadStatus: String(contact?.lead_status || "").trim() || "—",
          campaignName: String(link.campaign_name || "").trim() || "Campagna senza nome",
          senderWhatsAppNumber: String(link.whatsapp_number || "").trim() || "—",
          sentAt: link.created_at,
          openedCount: openedEvents.length,
          clickedCount: clickedEvents.length,
          lastOpenedAt: openedEvents[0]?.created_at ?? null,
          lastClickedAt: clickedEvents[0]?.created_at ?? null,
          clickedButtons,
          engagementLevel: getEngagementLevel(
            openedEvents.length,
            clickedEvents.length,
            clickedButtons
          ),
        } satisfies TrackedLeadRow;
      })
      .filter(Boolean) as TrackedLeadRow[];
  }, [links, events, contactsMap]);

  const campaignOptions = useMemo(() => {
    return Array.from(
      new Set(
        trackedLeads
          .map((item) => item.campaignName)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [trackedLeads]);

  const visibleTrackedLeads = useMemo(() => {
    let result = [...trackedLeads];

    if (campaignFilter !== "all") {
      result = result.filter((item) => item.campaignName === campaignFilter);
    }

    if (eventFilter === "opened") {
      result = result.filter((item) => item.openedCount > 0);
    }

    if (eventFilter === "button_clicked") {
      result = result.filter((item) => item.clickedCount > 0);
    }

    if (engagementFilter !== "all") {
      result = result.filter((item) => item.engagementLevel === engagementFilter);
    }

    if (hotOnly) {
      result = result.filter((item) =>
        item.clickedButtons.some((button) => isHotButton(button))
      );
    }

    const normalizedSearch = normalizeText(search);
    if (normalizedSearch) {
      result = result.filter((item) => {
        const haystack = [
          item.contactName,
          item.contactPhone,
          item.city,
          item.leadStatus,
          item.campaignName,
          item.senderWhatsAppNumber,
          item.clickedButtons.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });
    }

    return result.sort((a, b) => {
      const aTime = new Date(a.lastClickedAt || a.lastOpenedAt || a.sentAt || 0).getTime();
      const bTime = new Date(b.lastClickedAt || b.lastOpenedAt || b.sentAt || 0).getTime();
      return bTime - aTime;
    });
  }, [
    trackedLeads,
    campaignFilter,
    eventFilter,
    engagementFilter,
    hotOnly,
    search,
  ]);

  useEffect(() => {
    if (visibleTrackedLeads.length === 0) {
      setActiveLinkId(null);
      return;
    }

    setActiveLinkId((current) => {
      if (current && visibleTrackedLeads.some((item) => item.linkId === current)) {
        return current;
      }
      return visibleTrackedLeads[0]?.linkId ?? null;
    });
  }, [visibleTrackedLeads]);

  const activeLead = useMemo(() => {
    if (!activeLinkId) return null;
    return visibleTrackedLeads.find((item) => item.linkId === activeLinkId) ?? null;
  }, [visibleTrackedLeads, activeLinkId]);

  const activeLeadEvents = useMemo<EventDetail[]>(() => {
    if (!activeLinkId) return [];

    return events
      .filter((event) => String(event.link_id || "") === activeLinkId)
      .map((event) => ({
        id: event.id,
        linkId: String(event.link_id || ""),
        eventType:
          event.event_type === "opened" ? "Apertura link" : "Click bottone",
        buttonLabel: String(event.button_label || "").trim() || "—",
        createdAt: event.created_at,
      }))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [events, activeLinkId]);

  const totals = useMemo(() => {
    const totalTracked = trackedLeads.length;
    const totalOpened = trackedLeads.filter((item) => item.openedCount > 0).length;
    const totalClicked = trackedLeads.filter((item) => item.clickedCount > 0).length;
    const totalHot = trackedLeads.filter((item) =>
      item.clickedButtons.some((button) => isHotButton(button))
    ).length;

    return {
      totalTracked,
      totalOpened,
      totalClicked,
      totalHot,
    };
  }, [trackedLeads]);

  return (
    <div style={{ padding: 24 }}>
      <div style={headerWrap}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Tracciamento Leads</h1>
          <p style={subText}>
            Lead che hanno aperto o cliccato i link WhatsApp tracciati.
          </p>
        </div>

        <button onClick={loadTracking} style={refreshButton}>
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
            <StatCard title="Lead tracciati" value={totals.totalTracked} />
            <StatCard title="Lead che hanno aperto" value={totals.totalOpened} />
            <StatCard title="Lead che hanno cliccato" value={totals.totalClicked} />
            <StatCard title="Lead caldi" value={totals.totalHot} />
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
                  placeholder="Nome, telefono, città, campagna..."
                  style={inputStyle}
                />
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

              <div style={fieldWrap}>
                <label style={labelStyle}>Evento</label>
                <select
                  value={eventFilter}
                  onChange={(e) =>
                    setEventFilter(
                      e.target.value as "all" | "opened" | "button_clicked"
                    )
                  }
                  style={selectStyle}
                >
                  <option value="all">Aperture + click</option>
                  <option value="opened">Solo aperture</option>
                  <option value="button_clicked">Solo click</option>
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Coinvolgimento</label>
                <select
                  value={engagementFilter}
                  onChange={(e) =>
                    setEngagementFilter(
                      e.target.value as "all" | "basso" | "medio" | "alto"
                    )
                  }
                  style={selectStyle}
                >
                  <option value="all">Tutti</option>
                  <option value="basso">Basso</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </div>
            </div>

            <label style={checkboxWrap}>
              <input
                type="checkbox"
                checked={hotOnly}
                onChange={(e) => setHotOnly(e.target.checked)}
              />
              <span>Mostra solo lead caldi</span>
            </label>
          </div>

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Lead rilevati</h2>

            {visibleTrackedLeads.length === 0 ? (
              <div>Nessun lead tracciato disponibile.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Priorità</th>
                      <th style={thStyle}>Contatto</th>
                      <th style={thStyle}>Telefono</th>
                      <th style={thStyle}>Città</th>
                      <th style={thStyle}>Stato lead</th>
                      <th style={thStyle}>Campagna</th>
                      <th style={thStyle}>Numero agente</th>
                      <th style={thStyle}>Aperture</th>
                      <th style={thStyle}>Click</th>
                      <th style={thStyle}>Ultima attività</th>
                      <th style={thStyle}>Bottoni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrackedLeads.map((item) => (
                      <tr
                        key={item.linkId}
                        style={{
                          ...clickableRow,
                          ...(activeLinkId === item.linkId ? activeRow : {}),
                        }}
                        onClick={() => setActiveLinkId(item.linkId)}
                      >
                        <td style={tdStyle}>
                          <EngagementBadge level={item.engagementLevel} />
                        </td>
                        <td style={tdStyleStrong}>{item.contactName}</td>
                        <td style={tdStyle}>{item.contactPhone}</td>
                        <td style={tdStyle}>{item.city}</td>
                        <td style={tdStyle}>{item.leadStatus}</td>
                        <td style={tdStyle}>{item.campaignName}</td>
                        <td style={tdStyle}>{item.senderWhatsAppNumber}</td>
                        <td style={tdStyle}>{item.openedCount}</td>
                        <td style={tdStyle}>{item.clickedCount}</td>
                        <td style={tdStyle}>
                          {formatDateTime(
                            item.lastClickedAt || item.lastOpenedAt || item.sentAt
                          )}
                        </td>
                        <td style={tdStyle}>
                          {item.clickedButtons.length > 0
                            ? item.clickedButtons.join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Dettaglio lead</h2>

            {!activeLead ? (
              <div>Seleziona un lead dalla tabella sopra.</div>
            ) : (
              <>
                <div style={detailGrid}>
                  <DetailCard label="Contatto" value={activeLead.contactName} />
                  <DetailCard label="Telefono" value={activeLead.contactPhone} />
                  <DetailCard label="Città" value={activeLead.city} />
                  <DetailCard label="Stato lead" value={activeLead.leadStatus} />
                  <DetailCard label="Campagna" value={activeLead.campaignName} />
                  <DetailCard
                    label="Numero agente"
                    value={activeLead.senderWhatsAppNumber}
                  />
                  <DetailCard
                    label="Coinvolgimento"
                    valueNode={<EngagementBadge level={activeLead.engagementLevel} />}
                  />
                  <DetailCard
                    label="Ultima apertura"
                    value={formatDateTime(activeLead.lastOpenedAt)}
                  />
                  <DetailCard
                    label="Ultimo click"
                    value={formatDateTime(activeLead.lastClickedAt)}
                  />
                </div>

                <div style={actionRow}>
                  {activeLead.contactId ? (
                    <Link
                      href={`/contacts/${activeLead.contactId}`}
                      style={primaryLinkButton}
                    >
                      Apri contatto
                    </Link>
                  ) : null}
                </div>

                <div style={detailButtonsWrap}>
                  <div style={detailButtonsTitle}>Bottoni premuti</div>

                  {activeLead.clickedButtons.length === 0 ? (
                    <div style={mutedText}>Nessun bottone premuto.</div>
                  ) : (
                    <div style={chipsWrap}>
                      {activeLead.clickedButtons.map((button) => (
                        <span
                          key={button}
                          style={{
                            ...chipStyle,
                            ...(isHotButton(button) ? hotChipStyle : {}),
                          }}
                        >
                          {button}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 18 }}>
                  <h3 style={subSectionTitle}>Eventi di questo lead</h3>

                  {activeLeadEvents.length === 0 ? (
                    <div>Nessun evento disponibile.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Data</th>
                            <th style={thStyle}>Evento</th>
                            <th style={thStyle}>Bottone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLeadEvents.map((item) => (
                            <tr key={item.id}>
                              <td style={tdStyle}>{formatDateTime(item.createdAt)}</td>
                              <td style={tdStyle}>{item.eventType}</td>
                              <td style={tdStyle}>{item.buttonLabel}</td>
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

function EngagementBadge({
  level,
}: {
  level: "basso" | "medio" | "alto";
}) {
  const styleMap: Record<"basso" | "medio" | "alto", React.CSSProperties> = {
    basso: {
      background: "#f1f5f9",
      color: "#334155",
      border: "1px solid #cbd5e1",
    },
    medio: {
      background: "#fff7ed",
      color: "#c2410c",
      border: "1px solid #fdba74",
    },
    alto: {
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    },
  };

  return (
    <span
      style={{
        ...badgeBase,
        ...styleMap[level],
      }}
    >
      {level}
    </span>
  );
}

function DetailCard({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div style={detailCard}>
      <div style={detailLabel}>{label}</div>
      <div style={detailValue}>{valueNode ?? value ?? "—"}</div>
    </div>
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

const subSectionTitle: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 17,
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

const clickableRow: React.CSSProperties = {
  cursor: "pointer",
};

const activeRow: React.CSSProperties = {
  background: "#f8fafc",
};

const detailGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const detailCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 8,
  fontWeight: 700,
  textTransform: "uppercase",
};

const detailValue: React.CSSProperties = {
  fontSize: 15,
  color: "#0f172a",
  fontWeight: 600,
};

const detailButtonsWrap: React.CSSProperties = {
  marginTop: 18,
};

const detailButtonsTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#334155",
  marginBottom: 10,
};

const chipsWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #cbd5e1",
};

const hotChipStyle: React.CSSProperties = {
  background: "#ecfdf5",
  color: "#047857",
  border: "1px solid #a7f3d0",
};

const mutedText: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const actionRow: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryLinkButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#0f172a",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 700,
};