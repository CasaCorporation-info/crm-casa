"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  assigned_agent_id: string | null;
  created_at: string | null;
  last_contact_at: string | null;
};

type UserProfile = {
  id: string;
  role: string | null;
};

type Agent = {
  id: string;
  full_name: string | null;
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

type RecentChannelActivity = {
  contact_id: string;
  activity_type: "whatsapp" | "email";
  created_at: string;
  template_id: string | null;
  template_title: string | null;
};

type RecentActivityMap = Record<
  string,
  {
    whatsapp: RecentChannelActivity | null;
    email: RecentChannelActivity | null;
  }
>;

const PAGE_SIZE = 50;
const WARNING_DAYS = 30;

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

function getFullName(contact: Contact) {
  return `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "-";
}

function normalizePhoneForWhatsApp(phone: string | null) {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  return trimmed.replace(/\D/g, "");
}

function buildWhatsAppUrl(phone: string, text: string) {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;

  const waPhone = normalized.replace(/^\+/, "");
  if (!waPhone) return null;

  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

function normalizeEmail(email: string | null) {
  if (!email) return null;
  const cleaned = email.trim();
  if (!cleaned) return null;
  return cleaned;
}

function buildGmailComposeUrl(email: string, subject: string, body: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: normalizedEmail,
    su: subject || "",
    body: body || "",
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function getDaysAgoLabel(value: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (days === 0) return "oggi";
  if (days === 1) return "1 giorno fa";
  return `${days} giorni fa`;
}

export default function Home() {
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assignmentLoadingId, setAssignmentLoadingId] = useState<string | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [contactType, setContactType] = useState("owner");
  const [leadStatus, setLeadStatus] = useState("new");
  const [source, setSource] = useState("manual");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [adminLeadView, setAdminLeadView] = useState<"assigned" | "unassigned">(
    "unassigned"
  );

  const [expandedNoteContactId, setExpandedNoteContactId] = useState<
    string | null
  >(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [recentActivities, setRecentActivities] = useState<RecentActivityMap>({});

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalType, setTemplateModalType] = useState<
    "whatsapp" | "email" | null
  >(null);
  const [templateModalContact, setTemplateModalContact] = useState<Contact | null>(
    null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const normalizedRole = String(currentUserRole || "").trim().toLowerCase();
  const isAdminLike =
    normalizedRole === "admin" || normalizedRole === "manager";
  const isAgentOnly = normalizedRole === "agent";

  const availableTemplates = useMemo(() => {
    if (!templateModalType) return [];
    return templates.filter((t) => t.type === templateModalType);
  }, [templates, templateModalType]);

  const selectedTemplate =
    availableTemplates.find((t) => t.id === selectedTemplateId) || null;

  async function loadContacts(opts?: {
    page?: number;
    search?: string;
    filterType?: string;
    filterStatus?: string;
    filterSource?: string;
    onlyWithPhone?: boolean;
    adminLeadView?: "assigned" | "unassigned";
  }) {
    if (!authReady || !currentUserId) return;

    const nextPage = opts?.page ?? page;
    const nextSearch = opts?.search ?? search;
    const nextType = opts?.filterType ?? filterType;
    const nextStatus = opts?.filterStatus ?? filterStatus;
    const nextSource = opts?.filterSource ?? filterSource;
    const nextOnlyWithPhone = opts?.onlyWithPhone ?? onlyWithPhone;
    const nextAdminLeadView = opts?.adminLeadView ?? adminLeadView;

    setLoading(true);
    setErrorMsg(null);

    const from = (nextPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("contacts")
      .select(
        "id, organization_id, first_name, last_name, phone_primary, email_primary, city, contact_type, lead_status, source, assigned_agent_id, created_at, last_contact_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (isAgentOnly) {
      q = q.eq("assigned_agent_id", currentUserId);
    }

    if (isAdminLike) {
      if (nextAdminLeadView === "assigned") {
        q = q.not("assigned_agent_id", "is", null);
      } else {
        q = q.is("assigned_agent_id", null);
      }
    }

    if (nextType) q = q.eq("contact_type", nextType);
    if (nextStatus) q = q.eq("lead_status", nextStatus);
    if (nextSource.trim()) q = q.ilike("source", `%${nextSource.trim()}%`);
    if (nextOnlyWithPhone) q = q.not("phone_primary", "is", null);

    const s = nextSearch.trim();
    if (s) {
      q = q.or(
        [
          `first_name.ilike.%${s}%`,
          `last_name.ilike.%${s}%`,
          `phone_primary.ilike.%${s}%`,
          `email_primary.ilike.%${s}%`,
          `city.ilike.%${s}%`,
          `contact_type.ilike.%${s}%`,
          `source.ilike.%${s}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await q;

    if (error) {
      setErrorMsg(error.message);
      setContacts([]);
      setTotal(0);
      setRecentActivities({});
    } else {
      const nextContacts = (data || []) as Contact[];
      setContacts(nextContacts);
      setTotal(typeof count === "number" ? count : 0);
      await loadRecentActivitiesForContacts(nextContacts);
    }

    setLoading(false);
  }

  async function loadRecentActivitiesForContacts(nextContacts: Contact[]) {
    if (!nextContacts.length) {
      setRecentActivities({});
      return;
    }

    const contactIds = nextContacts.map((c) => c.id);
    const sinceIso = subtractDays(new Date(), WARNING_DAYS).toISOString();

    const { data, error } = await supabase
      .from("contact_activities")
      .select("contact_id, activity_type, created_at, template_id, metadata")
      .in("contact_id", contactIds)
      .in("activity_type", ["whatsapp", "email"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false });

    if (error) {
      setRecentActivities({});
      return;
    }

    const map: RecentActivityMap = {};

    for (const contact of nextContacts) {
      map[contact.id] = {
        whatsapp: null,
        email: null,
      };
    }

    for (const raw of data || []) {
      const row = raw as any;
      const contactId = String(row.contact_id || "");
      const activityType = String(row.activity_type || "") as "whatsapp" | "email";
      const createdAt = (row.created_at as string) || null;
      const templateId = (row.template_id as string | null) || null;
      const metadata = (row.metadata as Record<string, any> | null) || {};
      const templateTitle =
        typeof metadata.template_title === "string"
          ? metadata.template_title
          : null;

      if (!map[contactId]) {
        map[contactId] = {
          whatsapp: null,
          email: null,
        };
      }

      if (activityType === "whatsapp" && !map[contactId].whatsapp) {
        map[contactId].whatsapp = {
          contact_id: contactId,
          activity_type: "whatsapp",
          created_at: createdAt || "",
          template_id: templateId,
          template_title: templateTitle,
        };
      }

      if (activityType === "email" && !map[contactId].email) {
        map[contactId].email = {
          contact_id: contactId,
          activity_type: "email",
          created_at: createdAt || "",
          template_id: templateId,
          template_title: templateTitle,
        };
      }
    }

    setRecentActivities(map);
  }

  async function loadTemplates(orgId?: string | null) {
    const organizationId =
      orgId || contacts.find((c) => c.organization_id)?.organization_id || null;

    if (!organizationId) return;

    setLoadingTemplates(true);

    const { data, error } = await supabase
      .from("message_templates")
      .select(
        "id, organization_id, type, title, subject, message, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (!error) {
      setTemplates((data || []) as MessageTemplate[]);
    }

    setLoadingTemplates(false);
  }

  async function loadAgents() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const res = await fetch("/api/admin/agents/list", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) return;

      const json = await res.json();
      const rows = Array.isArray(json) ? json : json?.agents || json?.data || [];

      setAgents(
        rows.map((a: any) => ({
          id: a.id,
          full_name: a.full_name || a.email || "Agente",
        }))
      );
    } catch {
      return;
    }
  }

  async function assignContact(contactId: string, agentId: string) {
    setErrorMsg(null);
    setAssignmentLoadingId(contactId);

    const valueToSave = agentId || null;

    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: valueToSave })
      .eq("id", contactId);

    if (error) {
      setErrorMsg(error.message);
      setAssignmentLoadingId(null);
      return;
    }

    await loadContacts({
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      onlyWithPhone,
      adminLeadView,
    });

    setAssignmentLoadingId(null);
  }

  async function saveQuickNote(contact: Contact) {
    const note = (noteDrafts[contact.id] || "").trim();

    if (!note) {
      setErrorMsg("Scrivi un esito prima di salvare.");
      return;
    }

    if (!contact.organization_id) {
      setErrorMsg("organization_id mancante sul contatto.");
      return;
    }

    if (!currentUserId) {
      setErrorMsg("Utente non autenticato.");
      return;
    }

    setSavingNoteId(contact.id);
    setErrorMsg(null);

    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("contact_activities")
      .insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        created_by: currentUserId,
        activity_type: "note",
        note,
        channel: null,
        template_id: null,
        metadata: {},
      });

    if (insertError) {
      setErrorMsg(insertError.message);
      setSavingNoteId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ last_contact_at: nowIso })
      .eq("id", contact.id);

    if (updateError) {
      setErrorMsg(updateError.message);
      setSavingNoteId(null);
      return;
    }

    setNoteDrafts((prev) => ({
      ...prev,
      [contact.id]: "",
    }));

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id ? { ...c, last_contact_at: nowIso } : c
      )
    );

    setExpandedNoteContactId(null);
    setSavingNoteId(null);
  }

  function getAgentName(agentId: string | null) {
    if (!agentId) return "-";
    const found = agents.find((a) => String(a.id) === String(agentId));
    return found?.full_name?.trim() || "Agente";
  }

  function closeTemplateModal() {
    setTemplateModalOpen(false);
    setTemplateModalType(null);
    setTemplateModalContact(null);
    setSelectedTemplateId("");
    setActionLoading(false);
  }

  function buildRecentActivityWarningMessage(
    recent: RecentChannelActivity,
    channel: "whatsapp" | "email"
  ) {
    const titlePart = recent.template_title
      ? ` il template "${recent.template_title}"`
      : " un template";
    const whenPart = getDaysAgoLabel(recent.created_at) || "recentemente";
    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "Email";

    return `Questo contatto ha già ricevuto${titlePart} tramite ${channelLabel} ${whenPart}.\n\nVuoi procedere comunque con un altro template?`;
  }

  function tryOpenTemplateModal(contact: Contact, type: "whatsapp" | "email") {
    if (type === "whatsapp" && !contact.phone_primary?.trim()) {
      setErrorMsg("Questo contatto non ha un numero di telefono.");
      return;
    }

    if (type === "email" && !contact.email_primary?.trim()) {
      setErrorMsg("Questo contatto non ha un'email.");
      return;
    }

    const recent =
      type === "whatsapp"
        ? recentActivities[contact.id]?.whatsapp || null
        : recentActivities[contact.id]?.email || null;

    if (recent) {
      const confirmed = window.confirm(
        buildRecentActivityWarningMessage(recent, type)
      );

      if (!confirmed) return;
    }

    setTemplateModalContact(contact);
    setTemplateModalType(type);
    setSelectedTemplateId("");
    setTemplateModalOpen(true);
    setErrorMsg(null);
  }

  async function handleSendFromTemplate() {
    if (!templateModalContact || !templateModalType) {
      setErrorMsg("Contatto o tipo azione non validi.");
      return;
    }

    if (!selectedTemplate) {
      setErrorMsg("Seleziona un template.");
      return;
    }

    if (!templateModalContact.organization_id) {
      setErrorMsg("organization_id mancante sul contatto.");
      return;
    }

    if (!currentUserId) {
      setErrorMsg("Utente non autenticato.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);

    let targetUrl: string | null = null;
    let note = "";
    let metadata: Record<string, any> = {
      template_title: selectedTemplate.title,
      status: "opened",
    };

    if (templateModalType === "whatsapp") {
      const phone = templateModalContact.phone_primary?.trim() || "";
      targetUrl = buildWhatsAppUrl(phone, selectedTemplate.message);

      if (!targetUrl) {
        setErrorMsg("Numero WhatsApp non valido.");
        setActionLoading(false);
        return;
      }

      note = `Aperto WhatsApp con template: ${selectedTemplate.title}`;
      metadata = {
        ...metadata,
        phone,
      };
    }

    if (templateModalType === "email") {
      const email = templateModalContact.email_primary?.trim() || "";
      if (!email) {
        setErrorMsg("Email non valida.");
        setActionLoading(false);
        return;
      }

      targetUrl = buildGmailComposeUrl(
        email,
        selectedTemplate.subject || "",
        selectedTemplate.message
      );

      if (!targetUrl) {
        setErrorMsg("Impossibile costruire il link Gmail.");
        setActionLoading(false);
        return;
      }

      note = `Aperta email Gmail web con template: ${selectedTemplate.title}`;
      metadata = {
        ...metadata,
        email,
        subject: selectedTemplate.subject || "",
      };
    }

    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("contact_activities")
      .insert({
        organization_id: templateModalContact.organization_id,
        contact_id: templateModalContact.id,
        created_by: currentUserId,
        activity_type: templateModalType,
        channel: templateModalType,
        template_id: selectedTemplate.id,
        note,
        metadata,
      });

    if (insertError) {
      setErrorMsg(insertError.message);
      setActionLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update({ last_contact_at: nowIso })
      .eq("id", templateModalContact.id);

    if (updateError) {
      setErrorMsg(updateError.message);
      setActionLoading(false);
      return;
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === templateModalContact.id ? { ...c, last_contact_at: nowIso } : c
      )
    );

    setRecentActivities((prev) => ({
      ...prev,
      [templateModalContact.id]: {
        whatsapp:
          templateModalType === "whatsapp"
            ? {
                contact_id: templateModalContact.id,
                activity_type: "whatsapp",
                created_at: nowIso,
                template_id: selectedTemplate.id,
                template_title: selectedTemplate.title,
              }
            : prev[templateModalContact.id]?.whatsapp || null,
        email:
          templateModalType === "email"
            ? {
                contact_id: templateModalContact.id,
                activity_type: "email",
                created_at: nowIso,
                template_id: selectedTemplate.id,
                template_title: selectedTemplate.title,
              }
            : prev[templateModalContact.id]?.email || null,
      },
    }));

    if (!targetUrl) {
      setErrorMsg("Impossibile aprire il link del messaggio.");
      setActionLoading(false);
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    closeTemplateModal();
  }

  useEffect(() => {
    async function bootstrapAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;
      setCurrentUserId(userId);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .single();

      if (error || !profile) {
        setErrorMsg("Profilo utente non trovato.");
        setAuthReady(true);
        setLoading(false);
        return;
      }

      const typedProfile = profile as UserProfile;
      const normalizedBootstrapRole = String(typedProfile.role || "")
        .trim()
        .toLowerCase();

      setCurrentUserRole(typedProfile.role);
      setAuthReady(true);

      if (
        normalizedBootstrapRole === "admin" ||
        normalizedBootstrapRole === "manager"
      ) {
        await loadAgents();
      }
    }

    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authReady) return;

    loadContacts({
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      onlyWithPhone,
      adminLeadView,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, authReady]);

  useEffect(() => {
    if (!authReady) return;

    const t = setTimeout(() => {
      setPage(1);
      loadContacts({
        page: 1,
        search,
        filterType,
        filterStatus,
        filterSource,
        onlyWithPhone,
        adminLeadView,
      });
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, authReady]);

  useEffect(() => {
    if (!authReady) return;

    setPage(1);
    loadContacts({
      page: 1,
      search,
      filterType,
      filterStatus,
      filterSource,
      onlyWithPhone,
      adminLeadView,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus, filterSource, onlyWithPhone, authReady]);

  useEffect(() => {
    if (!authReady || !isAdminLike) return;

    setPage(1);
    loadContacts({
      page: 1,
      search,
      filterType,
      filterStatus,
      filterSource,
      onlyWithPhone,
      adminLeadView,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLeadView, authReady, currentUserRole]);

  useEffect(() => {
    const orgId = contacts.find((c) => c.organization_id)?.organization_id || null;
    if (!authReady || !orgId) return;
    loadTemplates(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, contacts.length]);

  async function createContact() {
    setErrorMsg(null);

    const payload = {
      first_name: firstName || null,
      last_name: lastName || null,
      phone_primary: phone || null,
      city: city || null,
      contact_type: contactType || null,
      lead_status: leadStatus || null,
      source: source || null,
      assigned_agent_id: isAgentOnly ? currentUserId : null,
    };

    const { error } = await supabase.from("contacts").insert(payload);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setFirstName("");
    setLastName("");
    setPhone("");
    setCity("");
    setContactType("owner");
    setLeadStatus("new");
    setSource("manual");
    setShowForm(false);

    setPage(1);
    await loadContacts({
      page: 1,
      search,
      filterType,
      filterStatus,
      filterSource,
      onlyWithPhone,
      adminLeadView,
    });
  }

  function handleRefresh() {
    loadContacts({
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      onlyWithPhone,
      adminLeadView,
    });
  }

  function handleResetFilters() {
    setSearch("");
    setFilterType("");
    setFilterStatus("");
    setFilterSource("");
    setOnlyWithPhone(false);
    setPage(1);
    setExpandedNoteContactId(null);

    loadContacts({
      page: 1,
      search: "",
      filterType: "",
      filterStatus: "",
      filterSource: "",
      onlyWithPhone: false,
      adminLeadView,
    });
  }

  const tableColSpan = isAdminLike ? 11 : 10;

  return (
    <main style={{ padding: 32 }}>
      <div style={{ maxWidth: 1700 }}>
        <h1 style={{ marginBottom: 6 }}>Lead Gestion</h1>
        <div style={{ opacity: 0.7, marginBottom: 18 }}>
          Database contatti Casa Corporation
        </div>

        {isAdminLike && (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setAdminLeadView("unassigned")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border:
                  adminLeadView === "unassigned"
                    ? "1px solid #111"
                    : "1px solid #ddd",
                background: adminLeadView === "unassigned" ? "#111" : "#fff",
                color: adminLeadView === "unassigned" ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Da assegnare
            </button>

            <button
              onClick={() => setAdminLeadView("assigned")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border:
                  adminLeadView === "assigned"
                    ? "1px solid #111"
                    : "1px solid #ddd",
                background: adminLeadView === "assigned" ? "#111" : "#fff",
                color: adminLeadView === "assigned" ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Assegnati
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, telefono, email, città, tipo, fonte..."
            style={{
              flex: 1,
              minWidth: 280,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          />

          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            + Nuovo contatto
          </button>

          <button
            onClick={handleRefresh}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Aggiorna
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            <option value="">Tutti i tipi</option>
            <option value="owner">owner</option>
            <option value="buyer">buyer</option>
            <option value="investor">investor</option>
            <option value="tenant">tenant</option>
            <option value="ex_client">ex_client</option>
            <option value="lead">lead</option>
            <option value="partner">partner</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            <option value="">Tutti gli stati</option>
            <option value="new">new</option>
            <option value="contacted">contacted</option>
            <option value="meeting">meeting</option>
            <option value="valuation">valuation</option>
            <option value="negotiation">negotiation</option>
            <option value="client">client</option>
            <option value="lost">lost</option>
          </select>

          <input
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            placeholder="Filtra fonte (es: idealista, whatsapp, xls...)"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 260,
              background: "#fff",
            }}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
            }}
          >
            <input
              type="checkbox"
              checked={onlyWithPhone}
              onChange={(e) => setOnlyWithPhone(e.target.checked)}
            />
            Solo con telefono
          </label>

          <button
            onClick={handleResetFilters}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Reset filtri
          </button>
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

        {showForm && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              marginBottom: 18,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              Nuovo contatto
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nome"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Cognome"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefono"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Città"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />

              <select
                value={contactType}
                onChange={(e) => setContactType(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              >
                <option value="owner">owner (proprietario)</option>
                <option value="buyer">buyer (acquirente)</option>
                <option value="investor">investor</option>
                <option value="tenant">tenant</option>
                <option value="ex_client">ex_client</option>
                <option value="lead">lead</option>
                <option value="partner">partner</option>
              </select>

              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              >
                <option value="new">new</option>
                <option value="contacted">contacted</option>
                <option value="meeting">meeting</option>
                <option value="valuation">valuation</option>
                <option value="negotiation">negotiation</option>
                <option value="client">client</option>
                <option value="lost">lost</option>
              </select>

              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
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
                onClick={createContact}
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
                onClick={() => setShowForm(false)}
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
        )}

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            overflowX: "auto",
            background: "#fff",
          }}
        >
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid #ddd",
              background: "#fafafa",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div>
              {loading ? "Caricamento..." : `Totale contatti: ${total}`}
              {loadingTemplates && (
                <span style={{ marginLeft: 10, opacity: 0.6 }}>
                  · Caricamento template...
                </span>
              )}
            </div>
            <div style={{ opacity: 0.7 }}>
              Pagina <b>{page}</b> / <b>{totalPages}</b>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1750 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#fff" }}>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Nome
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Telefono
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Email
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Città
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Tipo
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Stato
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Fonte
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Creato il
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Ultimo contatto
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                  Attività
                </th>

                {isAdminLike && (
                  <th style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    Agente
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {contacts.map((c) => {
                const recentWhatsapp = recentActivities[c.id]?.whatsapp || null;
                const recentEmail = recentActivities[c.id]?.email || null;

                return (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #f2f2f2",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <a
                          href={`/contacts/${c.id}`}
                          style={{
                            fontWeight: 700,
                            color: "#111",
                            textDecoration: "none",
                          }}
                        >
                          {getFullName(c)}
                        </a>
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        {c.phone_primary ?? "-"}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        {c.email_primary ?? "-"}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        {c.city ?? "-"}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        {c.contact_type ?? "-"}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        {c.lead_status ?? "-"}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        {c.source ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #f2f2f2",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDateTime(c.created_at)}
                      </td>

                      <td
                        style={{
                          padding: 12,
                          borderBottom: "1px solid #f2f2f2",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDateTime(c.last_contact_at)}
                      </td>

                      <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() =>
                              setExpandedNoteContactId((prev) =>
                                prev === c.id ? null : c.id
                              )
                            }
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #111",
                              background:
                                expandedNoteContactId === c.id ? "#111" : "#fff",
                              color:
                                expandedNoteContactId === c.id ? "#fff" : "#111",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {expandedNoteContactId === c.id
                              ? "Chiudi esito"
                              : "Aggiungi esito"}
                          </button>

                          <button
                            onClick={() => router.push(`/contacts/${c.id}`)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "#fff",
                              color: "#111",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Vedi attività
                          </button>

                          <button
                            onClick={() => tryOpenTemplateModal(c, "whatsapp")}
                            disabled={!c.phone_primary?.trim()}
                            title={
                              !c.phone_primary?.trim()
                                ? "Telefono mancante"
                                : "Invia WhatsApp"
                            }
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "#fff",
                              color: "#111",
                              cursor: !c.phone_primary?.trim()
                                ? "not-allowed"
                                : "pointer",
                              whiteSpace: "nowrap",
                              opacity: !c.phone_primary?.trim() ? 0.5 : 1,
                            }}
                          >
                            WhatsApp
                          </button>

                          <button
                            onClick={() => tryOpenTemplateModal(c, "email")}
                            disabled={!c.email_primary?.trim()}
                            title={
                              !c.email_primary?.trim()
                                ? "Email mancante"
                                : "Invia Email"
                            }
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "#fff",
                              color: "#111",
                              cursor: !c.email_primary?.trim()
                                ? "not-allowed"
                                : "pointer",
                              whiteSpace: "nowrap",
                              opacity: !c.email_primary?.trim() ? 0.5 : 1,
                            }}
                          >
                            Email
                          </button>

                          {(recentWhatsapp || recentEmail) && (
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.7,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {recentWhatsapp && (
                                <span>
                                  WA: {getDaysAgoLabel(recentWhatsapp.created_at)}
                                </span>
                              )}
                              {recentEmail && (
                                <span>
                                  Mail: {getDaysAgoLabel(recentEmail.created_at)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {isAdminLike && (
                        <td style={{ padding: 12, borderBottom: "1px solid #f2f2f2" }}>
                          <select
                            value={c.assigned_agent_id ?? ""}
                            onChange={(e) => assignContact(c.id, e.target.value)}
                            disabled={assignmentLoadingId === c.id}
                            style={{
                              minWidth: 180,
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "#fff",
                              cursor:
                                assignmentLoadingId === c.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: assignmentLoadingId === c.id ? 0.6 : 1,
                            }}
                          >
                            <option value="">
                              {c.assigned_agent_id
                                ? "Rimuovi assegnazione"
                                : "Seleziona agente"}
                            </option>

                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.full_name?.trim() || "Agente"}
                              </option>
                            ))}
                          </select>

                          {assignmentLoadingId === c.id && (
                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                              Salvataggio...
                            </div>
                          )}

                          {assignmentLoadingId !== c.id && c.assigned_agent_id && (
                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                              Attuale: {getAgentName(c.assigned_agent_id)}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>

                    {expandedNoteContactId === c.id && (
                      <tr>
                        <td
                          colSpan={tableColSpan}
                          style={{
                            padding: 16,
                            background: "#fafafa",
                            borderBottom: "1px solid #f2f2f2",
                          }}
                        >
                          <div style={{ maxWidth: 900 }}>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>
                              Aggiungi esito rapido
                            </div>

                            <textarea
                              value={noteDrafts[c.id] || ""}
                              onChange={(e) =>
                                setNoteDrafts((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value,
                                }))
                              }
                              placeholder="Scrivi qui l'esito del contatto..."
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

                            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                              <button
                                onClick={() => saveQuickNote(c)}
                                disabled={savingNoteId === c.id}
                                style={{
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  border: "1px solid #111",
                                  background: "#111",
                                  color: "#fff",
                                  cursor:
                                    savingNoteId === c.id
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity: savingNoteId === c.id ? 0.7 : 1,
                                }}
                              >
                                {savingNoteId === c.id
                                  ? "Salvataggio..."
                                  : "Salva esito"}
                              </button>

                              <button
                                onClick={() => {
                                  setExpandedNoteContactId(null);
                                  setNoteDrafts((prev) => ({
                                    ...prev,
                                    [c.id]: "",
                                  }));
                                }}
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
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {!loading && contacts.length === 0 && (
                <tr>
                  <td colSpan={tableColSpan} style={{ padding: 14, opacity: 0.7 }}>
                    Nessun contatto trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 12,
              borderTop: "1px solid #ddd",
              background: "#fff",
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: page === 1 || loading ? "not-allowed" : "pointer",
                opacity: page === 1 || loading ? 0.5 : 1,
              }}
            >
              ← Precedente
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor:
                  page >= totalPages || loading ? "not-allowed" : "pointer",
                opacity: page >= totalPages || loading ? 0.5 : 1,
              }}
            >
              Successivo →
            </button>

            <div style={{ marginLeft: "auto", opacity: 0.7 }}>
              Mostrati: {contacts.length} su {total}
            </div>
          </div>
        </div>
      </div>

      {templateModalOpen && templateModalContact && templateModalType && (
        <div
          onClick={closeTemplateModal}
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
                {templateModalType === "whatsapp"
                  ? "Invia WhatsApp"
                  : "Invia Email"}
              </div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                Contatto: <b>{getFullName(templateModalContact)}</b>
              </div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                {templateModalType === "whatsapp"
                  ? `Telefono: ${templateModalContact.phone_primary || "-"}`
                  : `Email: ${templateModalContact.email_primary || "-"}`}
              </div>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>Template</div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
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

                  {templateModalType === "email" && (
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
                  onClick={closeTemplateModal}
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
                  onClick={handleSendFromTemplate}
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
                    : templateModalType === "whatsapp"
                    ? "Apri WhatsApp"
                    : "Apri Gmail"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}