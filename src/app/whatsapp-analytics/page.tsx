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
};

type TemplateRow = {
  id: string;
  title: string | null;
  linked_asset_id: string | null;
};

type LinkAssetRow = {
  id: string;
  link_type: string | null;
};

type SendStatus = "inviato" | "aperto" | "cliccato";

type SendSummary = {
  linkId: string;
  token: string;
  templateId: string;
  campaignName: string;
  contactId: string | null;
  contactName: string;
  contactPhone: string;
  senderWhatsAppNumber: string;
  sentAt: string | null;
  openedCount: number;
  clickedCount: number;
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
  clickedButtons: string[];
  status: SendStatus;
};

type CampaignAggregate = {
  templateId: string;
  campaignName: string;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalOpenEvents: number;
  totalClickEvents: number;
  openRate: number;
  clickRate: number;
  uniqueButtons: string[];
  hotLeadCount: number;
  lastSentAt: string | null;
};

type EventDetail = {
  id: string;
  linkId: string;
  templateId: string;
  campaignName: string;
  contactId: string | null;
  contactName: string;
  contactPhone: string;
  senderWhatsAppNumber: string;
  eventType: string;
  buttonLabel: string;
  createdAt: string | null;
};

const PAGE_LIMIT = 500;

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
    normalized.includes("vorrei")
  );
}

function getStatusFromCounts(
  openedCount: number,
  clickedCount: number
): SendStatus {
  if (clickedCount > 0) return "cliccato";
  if (openedCount > 0) return "aperto";
  return "inviato";
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function WhatsAppAnalyticsPage() {
  const auth = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [links, setLinks] = useState<CampaignLinkRow[]>([]);
  const [events, setEvents] = useState<CampaignEventRow[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, ContactRow>>({});
  const [templatesMap, setTemplatesMap] = useState<Record<string, TemplateRow>>(
    {}
  );

  const [myWhatsAppNumber, setMyWhatsAppNumber] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "inviato" | "aperto" | "cliccato"
  >("all");
  const [eventFilter, setEventFilter] = useState<
    "all" | "opened" | "button_clicked"
  >("all");
  const [buttonFilter, setButtonFilter] = useState<string>("all");
  const [hotOnly, setHotOnly] = useState(false);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const normalizedRole = String(auth.role || "").trim().toLowerCase();
  const isAdminLike = normalizedRole === "admin" || normalizedRole === "manager";

  useEffect(() => {
    if (auth.loading) return;
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.userId, auth.organizationId, auth.role]);

  async function loadAnalytics() {
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

      const { data: templatesData, error: templatesError } = await supabase
        .from("message_templates")
        .select("id, title, linked_asset_id")
        .eq("organization_id", auth.organizationId)
        .eq("type", "whatsapp")
        .not("linked_asset_id", "is", null);

      if (templatesError) {
        setErrorMsg(templatesError.message);
        setLoading(false);
        return;
      }

      const rawTemplates = (templatesData ?? []) as TemplateRow[];
      const assetIds = Array.from(
        new Set(
          rawTemplates
            .map((template) => template.linked_asset_id)
            .filter(Boolean)
        )
      ) as string[];

      if (assetIds.length === 0) {
        setLinks([]);
        setEvents([]);
        setContactsMap({});
        setTemplatesMap({});
        setActiveLinkId(null);
        setLoading(false);
        return;
      }

      const { data: assetsData, error: assetsError } = await supabase
        .from("link_assets")
        .select("id, link_type")
        .in("id", assetIds);

      if (assetsError) {
        setErrorMsg(assetsError.message);
        setLoading(false);
        return;
      }

      const assets = (assetsData ?? []) as LinkAssetRow[];
      const landingAssetIds = new Set(
        assets
          .filter((asset) => asset.link_type === "whatsapp_landing")
          .map((asset) => asset.id)
      );

      const validTemplates = rawTemplates.filter(
        (template) =>
          !!template.id &&
          !!template.linked_asset_id &&
          landingAssetIds.has(template.linked_asset_id)
      );

      const nextTemplatesMap: Record<string, TemplateRow> = {};
      for (const template of validTemplates) {
        nextTemplatesMap[template.id] = template;
      }

      setTemplatesMap(nextTemplatesMap);

      const validTemplateIds = validTemplates.map((template) => template.id);

      if (validTemplateIds.length === 0) {
        setLinks([]);
        setEvents([]);
        setContactsMap({});
        setActiveLinkId(null);
        setLoading(false);
        return;
      }

      let linksQuery = supabase
        .from("whatsapp_campaign_links")
        .select("id, token, contact_id, template_id, whatsapp_number, created_at")
        .eq("organization_id", auth.organizationId)
        .in("template_id", validTemplateIds)
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

      const safeLinks = ((linksData ?? []) as CampaignLinkRow[]).filter(
        (item) => !!item.template_id && !!nextTemplatesMap[String(item.template_id)]
      );

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
              .select("id, first_name, last_name, phone_primary")
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
      setErrorMsg("Errore imprevisto nel caricamento analytics.");
      setLoading(false);
    }
  }

  const sendSummaries = useMemo<SendSummary[]>(() => {
    const eventsByLinkId = new Map<string, CampaignEventRow[]>();

    for (const event of events) {
      const key = String(event.link_id || "").trim();
      if (!key) continue;
      if (!eventsByLinkId.has(key)) eventsByLinkId.set(key, []);
      eventsByLinkId.get(key)!.push(event);
    }

    return links
      .map((link) => {
        const templateId = String(link.template_id || "").trim();
        const template = templatesMap[templateId];
        if (!template) return null;

        const contact = link.contact_id ? contactsMap[link.contact_id] : undefined;
        const relatedEvents = eventsByLinkId.get(link.id) ?? [];

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

        return {
          linkId: link.id,
          token: link.token,
          templateId,
          campaignName: String(template.title || "").trim() || "Template senza nome",
          contactId: link.contact_id,
          contactName: buildContactName(contact),
          contactPhone: String(contact?.phone_primary || "").trim() || "—",
          senderWhatsAppNumber: String(link.whatsapp_number || "").trim() || "—",
          sentAt: link.created_at,
          openedCount: openedEvents.length,
          clickedCount: clickedEvents.length,
          lastOpenedAt: openedEvents[0]?.created_at ?? null,
          lastClickedAt: clickedEvents[0]?.created_at ?? null,
          clickedButtons,
          status: getStatusFromCounts(openedEvents.length, clickedEvents.length),
        } satisfies SendSummary;
      })
      .filter(Boolean) as SendSummary[];
  }, [links, events, contactsMap, templatesMap]);

  const campaignOptions = useMemo(() => {
    const unique = new Map<string, string>();

    for (const item of sendSummaries) {
      if (!unique.has(item.templateId)) {
        unique.set(item.templateId, item.campaignName);
      }
    }

    return Array.from(unique.entries())
      .map(([templateId, campaignName]) => ({ templateId, campaignName }))
      .sort((a, b) => a.campaignName.localeCompare(b.campaignName, "it"));
  }, [sendSummaries]);

  const allButtonLabels = useMemo(() => {
    return Array.from(
      new Set(
        events
          .filter((event) => event.event_type === "button_clicked")
          .map((event) => String(event.button_label || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [events]);

  const campaignAggregates = useMemo<CampaignAggregate[]>(() => {
    const map = new Map<string, SendSummary[]>();

    for (const send of sendSummaries) {
      if (!map.has(send.templateId)) map.set(send.templateId, []);
      map.get(send.templateId)!.push(send);
    }

    const result: CampaignAggregate[] = [];

    for (const [templateId, items] of map.entries()) {
      const campaignName = items[0]?.campaignName || "Template senza nome";
      const totalSent = items.length;
      const totalOpened = items.filter((item) => item.openedCount > 0).length;
      const totalClicked = items.filter((item) => item.clickedCount > 0).length;
      const totalOpenEvents = items.reduce((sum, item) => sum + item.openedCount, 0);
      const totalClickEvents = items.reduce((sum, item) => sum + item.clickedCount, 0);

      const uniqueButtons = Array.from(
        new Set(items.flatMap((item) => item.clickedButtons))
      );

      const hotLeadCount = items.filter((item) =>
        item.clickedButtons.some((button) => isHotButton(button))
      ).length;

      const lastSentAt =
        [...items]
          .sort((a, b) => {
            const aTime = a.sentAt ? new Date(a.sentAt).getTime() : 0;
            const bTime = b.sentAt ? new Date(b.sentAt).getTime() : 0;
            return bTime - aTime;
          })[0]?.sentAt ?? null;

      result.push({
        templateId,
        campaignName,
        totalSent,
        totalOpened,
        totalClicked,
        totalOpenEvents,
        totalClickEvents,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        uniqueButtons,
        hotLeadCount,
        lastSentAt,
      });
    }

    return result.sort((a, b) => a.campaignName.localeCompare(b.campaignName, "it"));
  }, [sendSummaries]);

  const visibleCampaignAggregates = useMemo(() => {
    let result = [...campaignAggregates];

    if (selectedTemplateId !== "all") {
      result = result.filter((item) => item.templateId === selectedTemplateId);
    }

    if (buttonFilter !== "all") {
      result = result.filter((item) => item.uniqueButtons.includes(buttonFilter));
    }

    if (hotOnly) {
      result = result.filter((item) => item.hotLeadCount > 0);
    }

    return result;
  }, [campaignAggregates, selectedTemplateId, buttonFilter, hotOnly]);

  const visibleSendSummaries = useMemo(() => {
    let result = [...sendSummaries];

    if (selectedTemplateId !== "all") {
      result = result.filter((item) => item.templateId === selectedTemplateId);
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    if (buttonFilter !== "all") {
      result = result.filter((item) => item.clickedButtons.includes(buttonFilter));
    }

    if (hotOnly) {
      result = result.filter((item) =>
        item.clickedButtons.some((button) => isHotButton(button))
      );
    }

    return result;
  }, [sendSummaries, selectedTemplateId, statusFilter, buttonFilter, hotOnly]);

  const eventDetails = useMemo<EventDetail[]>(() => {
    const linksMap = new Map<string, CampaignLinkRow>();
    for (const link of links) linksMap.set(link.id, link);

    let filteredEvents = [...events];

    if (selectedTemplateId !== "all") {
      filteredEvents = filteredEvents.filter((event) => {
        const link = linksMap.get(String(event.link_id || ""));
        return String(link?.template_id || "") === selectedTemplateId;
      });
    }

    if (eventFilter !== "all") {
      filteredEvents = filteredEvents.filter(
        (event) => event.event_type === eventFilter
      );
    }

    if (buttonFilter !== "all") {
      filteredEvents = filteredEvents.filter(
        (event) => String(event.button_label || "").trim() === buttonFilter
      );
    }

    if (hotOnly) {
      filteredEvents = filteredEvents.filter((event) =>
        isHotButton(String(event.button_label || ""))
      );
    }

    return filteredEvents
      .map((event) => {
        const link = linksMap.get(String(event.link_id || ""));
        if (!link?.template_id) return null;

        const template = templatesMap[String(link.template_id)];
        if (!template) return null;

        const contact = event.contact_id ? contactsMap[event.contact_id] : undefined;

        return {
          id: event.id,
          linkId: String(event.link_id || ""),
          templateId: String(link.template_id),
          campaignName:
            String(template.title || "").trim() || "Template senza nome",
          contactId: event.contact_id,
          contactName: buildContactName(contact),
          contactPhone: String(contact?.phone_primary || "").trim() || "—",
          senderWhatsAppNumber: String(link.whatsapp_number || "").trim() || "—",
          eventType: event.event_type === "opened" ? "Apertura link" : "Click bottone",
          buttonLabel: String(event.button_label || "").trim() || "—",
          createdAt: event.created_at,
        } satisfies EventDetail;
      })
      .filter(Boolean) as EventDetail[];
  }, [
    events,
    links,
    contactsMap,
    templatesMap,
    selectedTemplateId,
    eventFilter,
    buttonFilter,
    hotOnly,
  ]);

  useEffect(() => {
    if (visibleSendSummaries.length === 0) {
      setActiveLinkId(null);
      return;
    }

    setActiveLinkId((current) => {
      if (current && visibleSendSummaries.some((item) => item.linkId === current)) {
        return current;
      }
      return visibleSendSummaries[0]?.linkId ?? null;
    });
  }, [visibleSendSummaries]);

  const activeSend = useMemo(() => {
    if (!activeLinkId) return null;
    return visibleSendSummaries.find((item) => item.linkId === activeLinkId) ?? null;
  }, [visibleSendSummaries, activeLinkId]);

  const activeSendEvents = useMemo(() => {
    if (!activeLinkId) return [];
    return eventDetails.filter((item) => item.linkId === activeLinkId);
  }, [eventDetails, activeLinkId]);

  const hotLeads = useMemo(() => {
    return visibleSendSummaries.filter((item) =>
      item.clickedButtons.some((button) => isHotButton(button))
    );
  }, [visibleSendSummaries]);

  const totals = useMemo(() => {
    const totalCampaigns = campaignAggregates.length;
    const totalSent = sendSummaries.length;
    const totalOpened = sendSummaries.filter((item) => item.openedCount > 0).length;
    const totalClicked = sendSummaries.filter((item) => item.clickedCount > 0).length;

    return {
      totalCampaigns,
      totalSent,
      totalOpened,
      totalClicked,
    };
  }, [campaignAggregates, sendSummaries]);

  return (
    <div style={{ padding: 24 }}>
      <div style={headerWrap}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>WhatsApp Analytics</h1>
          <p style={subText}>
            Mostra solo template WhatsApp con pulsanti reali.
          </p>
        </div>

        <button onClick={loadAnalytics} style={refreshButton}>
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
            <StatCard title="Campagne" value={totals.totalCampaigns} />
            <StatCard title="Invii totali" value={totals.totalSent} />
            <StatCard title="Invii aperti" value={totals.totalOpened} />
            <StatCard title="Invii con click" value={totals.totalClicked} />
          </div>

          <div style={sectionCard}>
            <div style={sectionHeader}>
              <h2 style={sectionTitleNoMargin}>Filtri</h2>
            </div>

            <div style={filtersGrid}>
              <div style={fieldWrap}>
                <label style={labelStyle}>Campagna</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="all">Tutte le campagne</option>
                  {campaignOptions.map((item) => (
                    <option key={item.templateId} value={item.templateId}>
                      {item.campaignName}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Stato invio</label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "all" | "inviato" | "aperto" | "cliccato"
                    )
                  }
                  style={selectStyle}
                >
                  <option value="all">Tutti</option>
                  <option value="inviato">Solo inviati</option>
                  <option value="aperto">Solo aperti</option>
                  <option value="cliccato">Solo cliccati</option>
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Tipo evento</label>
                <select
                  value={eventFilter}
                  onChange={(e) =>
                    setEventFilter(
                      e.target.value as "all" | "opened" | "button_clicked"
                    )
                  }
                  style={selectStyle}
                >
                  <option value="all">Tutti</option>
                  <option value="opened">Solo aperture link</option>
                  <option value="button_clicked">Solo click bottoni</option>
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Bottone</label>
                <select
                  value={buttonFilter}
                  onChange={(e) => setButtonFilter(e.target.value)}
                  style={selectStyle}
                >
                  <option value="all">Tutti i bottoni</option>
                  {allButtonLabels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label style={checkboxWrap}>
              <input
                type="checkbox"
                checked={hotOnly}
                onChange={(e) => setHotOnly(e.target.checked)}
              />
              <span>Mostra solo contatti caldi</span>
            </label>
          </div>

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Riepilogo campagne</h2>

            {visibleCampaignAggregates.length === 0 ? (
              <div>Nessuna campagna disponibile.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Campagna</th>
                      <th style={thStyle}>Invii</th>
                      <th style={thStyle}>Aperti</th>
                      <th style={thStyle}>Click</th>
                      <th style={thStyle}>Open rate</th>
                      <th style={thStyle}>Click rate</th>
                      <th style={thStyle}>Contatti caldi</th>
                      <th style={thStyle}>Bottoni usati</th>
                      <th style={thStyle}>Ultimo invio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCampaignAggregates.map((item) => (
                      <tr
                        key={item.templateId}
                        style={clickableRow}
                        onClick={() => setSelectedTemplateId(item.templateId)}
                      >
                        <td style={tdStyleStrong}>{item.campaignName}</td>
                        <td style={tdStyle}>{item.totalSent}</td>
                        <td style={tdStyle}>{item.totalOpened}</td>
                        <td style={tdStyle}>{item.totalClicked}</td>
                        <td style={tdStyle}>{formatPercent(item.openRate)}</td>
                        <td style={tdStyle}>{formatPercent(item.clickRate)}</td>
                        <td style={tdStyle}>{item.hotLeadCount}</td>
                        <td style={tdStyle}>
                          {item.uniqueButtons.length > 0
                            ? item.uniqueButtons.join(", ")
                            : "—"}
                        </td>
                        <td style={tdStyle}>{formatDateTime(item.lastSentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Contatti caldi</h2>

            {hotLeads.length === 0 ? (
              <div>Nessun contatto caldo rilevato.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Contatto</th>
                      <th style={thStyle}>Telefono</th>
                      <th style={thStyle}>Campagna</th>
                      <th style={thStyle}>Numero agente</th>
                      <th style={thStyle}>Bottoni premuti</th>
                      <th style={thStyle}>Ultimo click</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotLeads.map((item) => (
                      <tr
                        key={item.linkId}
                        style={clickableRow}
                        onClick={() => setActiveLinkId(item.linkId)}
                      >
                        <td style={tdStyle}>{item.contactName}</td>
                        <td style={tdStyle}>{item.contactPhone}</td>
                        <td style={tdStyle}>{item.campaignName}</td>
                        <td style={tdStyle}>{item.senderWhatsAppNumber}</td>
                        <td style={tdStyle}>{item.clickedButtons.join(", ")}</td>
                        <td style={tdStyle}>{formatDateTime(item.lastClickedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Invii della campagna</h2>

            {visibleSendSummaries.length === 0 ? (
              <div>Nessun invio disponibile.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Stato</th>
                      <th style={thStyle}>Campagna</th>
                      <th style={thStyle}>Contatto</th>
                      <th style={thStyle}>Telefono</th>
                      <th style={thStyle}>Numero agente</th>
                      <th style={thStyle}>Inviato</th>
                      <th style={thStyle}>Aperture</th>
                      <th style={thStyle}>Click</th>
                      <th style={thStyle}>Ultima apertura</th>
                      <th style={thStyle}>Ultimo click</th>
                      <th style={thStyle}>Bottoni premuti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSendSummaries.map((item) => (
                      <tr
                        key={item.linkId}
                        style={{
                          ...clickableRow,
                          ...(activeLinkId === item.linkId ? activeRow : {}),
                        }}
                        onClick={() => setActiveLinkId(item.linkId)}
                      >
                        <td style={tdStyle}>
                          <StatusBadge status={item.status} />
                        </td>
                        <td style={tdStyle}>{item.campaignName}</td>
                        <td style={tdStyle}>{item.contactName}</td>
                        <td style={tdStyle}>{item.contactPhone}</td>
                        <td style={tdStyle}>{item.senderWhatsAppNumber}</td>
                        <td style={tdStyle}>{formatDateTime(item.sentAt)}</td>
                        <td style={tdStyle}>{item.openedCount}</td>
                        <td style={tdStyle}>{item.clickedCount}</td>
                        <td style={tdStyle}>{formatDateTime(item.lastOpenedAt)}</td>
                        <td style={tdStyle}>{formatDateTime(item.lastClickedAt)}</td>
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
            <h2 style={sectionTitle}>Dettaglio invio</h2>

            {!activeSend ? (
              <div>Seleziona un invio dalla tabella sopra.</div>
            ) : (
              <>
                <div style={detailGrid}>
                  <DetailCard label="Campagna" value={activeSend.campaignName} />
                  <DetailCard label="Contatto" value={activeSend.contactName} />
                  <DetailCard label="Telefono" value={activeSend.contactPhone} />
                  <DetailCard
                    label="Numero agente"
                    value={activeSend.senderWhatsAppNumber}
                  />
                  <DetailCard
                    label="Stato"
                    valueNode={<StatusBadge status={activeSend.status} />}
                  />
                  <DetailCard
                    label="Inviato"
                    value={formatDateTime(activeSend.sentAt)}
                  />
                  <DetailCard
                    label="Ultima apertura"
                    value={formatDateTime(activeSend.lastOpenedAt)}
                  />
                  <DetailCard
                    label="Ultimo click"
                    value={formatDateTime(activeSend.lastClickedAt)}
                  />
                </div>

                <div style={actionRow}>
                  {activeSend.contactId ? (
                    <Link
                      href={`/contacts/${activeSend.contactId}`}
                      style={primaryLinkButton}
                    >
                      Apri contatto
                    </Link>
                  ) : null}
                </div>

                <div style={detailButtonsWrap}>
                  <div style={detailButtonsTitle}>Bottoni premuti</div>

                  {activeSend.clickedButtons.length === 0 ? (
                    <div style={mutedText}>Nessun bottone premuto.</div>
                  ) : (
                    <div style={chipsWrap}>
                      {activeSend.clickedButtons.map((button) => (
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
                  <h3 style={subSectionTitle}>Eventi di questo invio</h3>

                  {activeSendEvents.length === 0 ? (
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
                          {activeSendEvents.map((item) => (
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

          <div style={sectionCard}>
            <h2 style={sectionTitle}>Eventi della campagna</h2>

            {eventDetails.length === 0 ? (
              <div>Nessun evento disponibile.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Data</th>
                      <th style={thStyle}>Evento</th>
                      <th style={thStyle}>Bottone</th>
                      <th style={thStyle}>Campagna</th>
                      <th style={thStyle}>Contatto</th>
                      <th style={thStyle}>Telefono</th>
                      <th style={thStyle}>Numero agente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventDetails.map((item) => (
                      <tr
                        key={item.id}
                        style={clickableRow}
                        onClick={() => setActiveLinkId(item.linkId)}
                      >
                        <td style={tdStyle}>{formatDateTime(item.createdAt)}</td>
                        <td style={tdStyle}>{item.eventType}</td>
                        <td style={tdStyle}>{item.buttonLabel}</td>
                        <td style={tdStyle}>{item.campaignName}</td>
                        <td style={tdStyle}>{item.contactName}</td>
                        <td style={tdStyle}>{item.contactPhone}</td>
                        <td style={tdStyle}>{item.senderWhatsAppNumber}</td>
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

function StatusBadge({ status }: { status: SendStatus }) {
  const styleMap: Record<SendStatus, React.CSSProperties> = {
    inviato: {
      background: "#f1f5f9",
      color: "#334155",
      border: "1px solid #cbd5e1",
    },
    aperto: {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    },
    cliccato: {
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    },
  };

  return (
    <span
      style={{
        ...badgeBase,
        ...styleMap[status],
      }}
    >
      {status}
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