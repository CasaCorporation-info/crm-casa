"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";
import type {
  Agent,
  Contact,
  MessageTemplate,
  RecentActivityMap,
  SortDirection,
  SortField,
  UserProfile,
  VisibleColumnKey,
  VisibleColumnsState,
} from "@/components/contacts/types";
import {
  PAGE_SIZE,
  WARNING_DAYS,
  buildGmailComposeUrl,
  buildRecentActivityWarningMessage,
  buildWhatsAppUrl,
  getContactHealthStatus,
  subtractDays,
} from "@/components/contacts/utils";
import CreateContactForm from "@/components/contacts/CreateContactForm";
import ContactsFilters from "@/components/contacts/ContactsFilters";
import TemplateModal from "@/components/contacts/TemplateModal";
import ContactsTable from "@/components/contacts/ContactsTable";

const VISIBLE_COLUMNS_STORAGE_KEY = "contacts_visible_columns";

const DEFAULT_VISIBLE_COLUMNS: VisibleColumnsState = {
  email: true,
  city: true,
  type: true,
  source: true,
  created_at: true,
};

export default function Home() {
  const router = useRouter();
  const auth = useAuthContext();

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
  const [filterHealth, setFilterHealth] = useState<string>("");
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);

  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>(
    DEFAULT_VISIBLE_COLUMNS
  );

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [contactType, setContactType] = useState("owner");
  const [leadStatus, setLeadStatus] = useState("nuovo");
  const [source, setSource] = useState("manual");

  const currentUserId = auth.userId;
  const currentUserRole = auth.role;
  const currentOrganizationId = auth.organizationId;
  const authReady = !auth.loading;

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<VisibleColumnsState>;
      setVisibleColumns({
        email:
          typeof parsed.email === "boolean"
            ? parsed.email
            : DEFAULT_VISIBLE_COLUMNS.email,
        city:
          typeof parsed.city === "boolean"
            ? parsed.city
            : DEFAULT_VISIBLE_COLUMNS.city,
        type:
          typeof parsed.type === "boolean"
            ? parsed.type
            : DEFAULT_VISIBLE_COLUMNS.type,
        source:
          typeof parsed.source === "boolean"
            ? parsed.source
            : DEFAULT_VISIBLE_COLUMNS.source,
        created_at:
          typeof parsed.created_at === "boolean"
            ? parsed.created_at
            : DEFAULT_VISIBLE_COLUMNS.created_at,
      });
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      VISIBLE_COLUMNS_STORAGE_KEY,
      JSON.stringify(visibleColumns)
    );
  }, [visibleColumns]);

  async function loadContacts(opts?: {
    page?: number;
    search?: string;
    filterType?: string;
    filterStatus?: string;
    filterSource?: string;
    filterHealth?: string;
    onlyWithPhone?: boolean;
    adminLeadView?: "assigned" | "unassigned";
    sortField?: SortField;
    sortDirection?: SortDirection;
  }) {
    if (!authReady || !currentUserId) return;

    const nextPage = opts?.page ?? page;
    const nextSearch = opts?.search ?? search;
    const nextType = opts?.filterType ?? filterType;
    const nextStatus = opts?.filterStatus ?? filterStatus;
    const nextSource = opts?.filterSource ?? filterSource;
    const nextHealth = opts?.filterHealth ?? filterHealth;
    const nextOnlyWithPhone = opts?.onlyWithPhone ?? onlyWithPhone;
    const nextAdminLeadView = opts?.adminLeadView ?? adminLeadView;
    const nextSortField = opts?.sortField ?? sortField;
    const nextSortDirection = opts?.sortDirection ?? sortDirection;

    setLoading(true);
    setErrorMsg(null);

    let q = supabase
      .from("contacts")
      .select(
        "id, organization_id, first_name, last_name, phone_primary, email_primary, city, contact_type, lead_status, source, assigned_agent_id, created_at, last_contact_at",
        { count: "exact" }
      );

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

    if (nextSortField === "name") {
      q = q.order("first_name", { ascending: nextSortDirection === "asc" });
      q = q.order("last_name", { ascending: nextSortDirection === "asc" });
    } else {
      q = q.order(nextSortField, {
        ascending: nextSortDirection === "asc",
        nullsFirst:
          nextSortField === "last_contact_at"
            ? nextSortDirection === "asc"
            : false,
      });
    }

    const { data, error, count } = await q;

    if (error) {
      setErrorMsg(error.message);
      setContacts([]);
      setTotal(0);
      setRecentActivities({});
      setLoading(false);
      return;
    }

    let nextContacts = ((data || []) as Contact[]).filter((contact) => {
      if (!nextHealth) return true;
      return getContactHealthStatus(contact.last_contact_at) === nextHealth;
    });

    const computedTotal = nextHealth
      ? nextContacts.length
      : typeof count === "number"
      ? count
      : 0;

    const from = (nextPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    nextContacts = nextContacts.slice(from, to);

    setContacts(nextContacts);
    setTotal(computedTotal);
    await loadRecentActivitiesForContacts(nextContacts);
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
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      sortField,
      sortDirection,
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
    const shouldSetContacted =
      !contact.lead_status || contact.lead_status.trim().toLowerCase() === "nuovo";

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

    const updatePayload: Record<string, any> = {
      last_contact_at: nowIso,
    };

    if (shouldSetContacted) {
      updatePayload.lead_status = "contattato";
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update(updatePayload)
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
        c.id === contact.id
          ? {
              ...c,
              last_contact_at: nowIso,
              lead_status: shouldSetContacted ? "contattato" : c.lead_status,
            }
          : c
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
    const shouldSetContacted =
      !templateModalContact.lead_status ||
      templateModalContact.lead_status.trim().toLowerCase() === "nuovo";

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

    const updatePayload: Record<string, any> = {
      last_contact_at: nowIso,
    };

    if (shouldSetContacted) {
      updatePayload.lead_status = "contattato";
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", templateModalContact.id);

    if (updateError) {
      setErrorMsg(updateError.message);
      setActionLoading(false);
      return;
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === templateModalContact.id
          ? {
              ...c,
              last_contact_at: nowIso,
              lead_status: shouldSetContacted ? "contattato" : c.lead_status,
            }
          : c
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

  function handleToggleVisibleColumn(key: VisibleColumnKey) {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  useEffect(() => {
    if (!authReady) return;

    if (!auth.isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!currentUserId) {
      setLoading(false);
      setErrorMsg("Utente non autenticato.");
      return;
    }

    if (!currentOrganizationId) {
      setLoading(false);
      setErrorMsg("organization_id utente mancante.");
      return;
    }

    setErrorMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, auth.isAuthenticated, currentUserId, currentOrganizationId]);

  useEffect(() => {
    async function run() {
      if (!authReady || !currentUserRole) return;

      const normalizedBootstrapRole = String(currentUserRole || "")
        .trim()
        .toLowerCase();

      if (
        normalizedBootstrapRole === "admin" ||
        normalizedBootstrapRole === "manager"
      ) {
        await loadAgents();
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, currentUserRole]);

  useEffect(() => {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    loadContacts({
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      sortField,
      sortDirection,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, authReady, currentUserId, currentOrganizationId]);

  useEffect(() => {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    const t = setTimeout(() => {
      setPage(1);
      loadContacts({
        page: 1,
        search,
        filterType,
        filterStatus,
        filterSource,
        filterHealth,
        onlyWithPhone,
        adminLeadView,
        sortField,
        sortDirection,
      });
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, authReady, currentUserId, currentOrganizationId]);

  useEffect(() => {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    setPage(1);
    loadContacts({
      page: 1,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      sortField,
      sortDirection,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterType,
    filterStatus,
    filterSource,
    filterHealth,
    onlyWithPhone,
    sortField,
    sortDirection,
    authReady,
    currentUserId,
    currentOrganizationId,
  ]);

  useEffect(() => {
    if (!authReady || !isAdminLike || !currentUserId || !currentOrganizationId)
      return;

    setPage(1);
    loadContacts({
      page: 1,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      sortField,
      sortDirection,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLeadView, authReady, currentUserRole, currentUserId, currentOrganizationId]);

  useEffect(() => {
    const orgId = contacts.find((c) => c.organization_id)?.organization_id || null;
    if (!authReady || !orgId) return;
    loadTemplates(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, contacts.length]);

  async function createContact() {
    setErrorMsg(null);

    if (!currentUserId) {
      setErrorMsg("Utente non autenticato.");
      return;
    }

    if (!currentOrganizationId) {
      setErrorMsg("organization_id utente mancante.");
      return;
    }

    const payload = {
      organization_id: currentOrganizationId,
      created_by: currentUserId,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone_primary: phone.trim() || null,
      city: city.trim() || null,
      contact_type: contactType || null,
      lead_status: leadStatus || "nuovo",
      source: source.trim() || null,
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
    setLeadStatus("nuovo");
    setSource("manual");
    setShowForm(false);

    setPage(1);
    await loadContacts({
      page: 1,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      sortField,
      sortDirection,
    });
  }

  function handleRefresh() {
    loadContacts({
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      sortField,
      sortDirection,
    });
  }

  function handleResetFilters() {
    setSearch("");
    setFilterType("");
    setFilterStatus("");
    setFilterSource("");
    setFilterHealth("");
    setOnlyWithPhone(false);
    setSortField("created_at");
    setSortDirection("desc");
    setPage(1);
    setExpandedNoteContactId(null);

    loadContacts({
      page: 1,
      search: "",
      filterType: "",
      filterStatus: "",
      filterSource: "",
      filterHealth: "",
      onlyWithPhone: false,
      adminLeadView,
      sortField: "created_at",
      sortDirection: "desc",
    });
  }

  return (
    <main style={{ padding: 32 }}>
      <div style={{ maxWidth: 1700 }}>
        <h1 style={{ marginBottom: 6 }}>Lead Gestion</h1>
        <div style={{ opacity: 0.7, marginBottom: 18 }}>
          Database contatti Casa Corporation
        </div>

        <ContactsFilters
          isAdminLike={isAdminLike}
          adminLeadView={adminLeadView}
          search={search}
          filterType={filterType}
          filterStatus={filterStatus}
          filterSource={filterSource}
          onlyWithPhone={onlyWithPhone}
          filterHealth={filterHealth}
          sortField={sortField}
          sortDirection={sortDirection}
          visibleColumns={visibleColumns}
          onAdminLeadViewChange={setAdminLeadView}
          onSearchChange={setSearch}
          onToggleShowForm={() => setShowForm((v) => !v)}
          onRefresh={handleRefresh}
          onFilterTypeChange={setFilterType}
          onFilterStatusChange={setFilterStatus}
          onFilterSourceChange={setFilterSource}
          onOnlyWithPhoneChange={setOnlyWithPhone}
          onFilterHealthChange={setFilterHealth}
          onSortFieldChange={setSortField}
          onSortDirectionChange={setSortDirection}
          onToggleVisibleColumn={handleToggleVisibleColumn}
          onResetFilters={handleResetFilters}
        />

        <CreateContactForm
          show={showForm}
          firstName={firstName}
          lastName={lastName}
          phone={phone}
          city={city}
          contactType={contactType}
          leadStatus={leadStatus}
          source={source}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onPhoneChange={setPhone}
          onCityChange={setCity}
          onContactTypeChange={setContactType}
          onLeadStatusChange={setLeadStatus}
          onSourceChange={setSource}
          onSave={createContact}
          onCancel={() => setShowForm(false)}
        />

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

        <ContactsTable
          contacts={contacts}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          loadingTemplates={loadingTemplates}
          isAdminLike={isAdminLike}
          agents={agents}
          recentActivities={recentActivities}
          visibleColumns={visibleColumns}
          expandedNoteContactId={expandedNoteContactId}
          noteDrafts={noteDrafts}
          savingNoteId={savingNoteId}
          assignmentLoadingId={assignmentLoadingId}
          onToggleExpandedNote={(contactId) =>
            setExpandedNoteContactId((prev) =>
              prev === contactId ? null : contactId
            )
          }
          onViewActivities={(contactId) => router.push(`/contacts/${contactId}`)}
          onOpenWhatsappTemplate={(contact) =>
            tryOpenTemplateModal(contact, "whatsapp")
          }
          onOpenEmailTemplate={(contact) =>
            tryOpenTemplateModal(contact, "email")
          }
          onAssignContact={assignContact}
          getAgentName={getAgentName}
          onNoteDraftChange={(contactId, value) =>
            setNoteDrafts((prev) => ({
              ...prev,
              [contactId]: value,
            }))
          }
          onSaveQuickNote={saveQuickNote}
          onCancelQuickNote={(contactId) => {
            setExpandedNoteContactId(null);
            setNoteDrafts((prev) => ({
              ...prev,
              [contactId]: "",
            }));
          }}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>

      <TemplateModal
        open={templateModalOpen}
        contact={templateModalContact}
        type={templateModalType}
        selectedTemplateId={selectedTemplateId}
        availableTemplates={availableTemplates}
        selectedTemplate={selectedTemplate}
        actionLoading={actionLoading}
        onClose={closeTemplateModal}
        onSelectedTemplateIdChange={setSelectedTemplateId}
        onConfirm={handleSendFromTemplate}
      />
    </main>
  );
}