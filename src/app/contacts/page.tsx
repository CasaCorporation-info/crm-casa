"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";
import type {
  Agent,
  Contact,
  MessageTemplate,
  QuickActivityUiType,
  RecentActivityMap,
  SortDirection,
  SortField,
  VisibleColumnKey,
  VisibleColumnsState,
} from "@/components/contacts/types";
import {
  PAGE_SIZE,
  WARNING_DAYS,
  buildGmailComposeUrl,
  buildHealthFilterRange,
  buildRecentActivityWarningMessage,
  buildWhatsAppUrl,
  createContactActivityAndTouchContact,
  mapQuickActivityTypeToDbValue,
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

const DEFAULT_QUICK_ACTIVITY_TYPE: QuickActivityUiType = "Note";

type WhatsappOutcome =
  | "sent"
  | "not_sent"
  | "no_whatsapp"
  | "error"
  | "invalid_number";

type PendingWhatsappSend = {
  contact: Contact;
  template: MessageTemplate;
  finalMessage: string;
  targetUrl: string | null;
  metadata: Record<string, unknown>;
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
  const [contactType, setContactType] = useState("cliente generico");
  const [leadStatus, setLeadStatus] = useState("nuovo");
  const [source, setSource] = useState("manual");

  const currentUserId = auth.userId;
  const currentUserRole = auth.role;
  const currentOrganizationId = auth.organizationId;
  const authReady = !auth.loading;

  const [adminLeadView, setAdminLeadView] = useState<"assigned" | "unassigned">(
    "unassigned"
  );
  const [selectedAssignedAgentId, setSelectedAssignedAgentId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState("");
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);

  const [expandedNoteContactId, setExpandedNoteContactId] = useState<
    string | null
  >(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteTypeDrafts, setNoteTypeDrafts] = useState<Record<string, string>>(
    {}
  );
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [recentActivities, setRecentActivities] = useState<RecentActivityMap>(
    {}
  );

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalType, setTemplateModalType] = useState<
    "whatsapp" | "email" | null
  >(null);
  const [templateModalContact, setTemplateModalContact] = useState<Contact | null>(
    null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [pendingWhatsappSend, setPendingWhatsappSend] =
    useState<PendingWhatsappSend | null>(null);
  const [whatsappOutcomeLoading, setWhatsappOutcomeLoading] = useState(false);
  const [verifiedWhatsappContactIds, setVerifiedWhatsappContactIds] = useState<
    string[]
  >([]);
  const [whatsappSentContactIds, setWhatsappSentContactIds] = useState<string[]>(
    []
  );
  const [replyLoadingContactId, setReplyLoadingContactId] = useState<
    string | null
  >(null);

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

  const queryState = useMemo(
    () => ({
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      selectedAssignedAgentId,
      sortField,
      sortDirection,
    }),
    [
      page,
      search,
      filterType,
      filterStatus,
      filterSource,
      filterHealth,
      onlyWithPhone,
      adminLeadView,
      selectedAssignedAgentId,
      sortField,
      sortDirection,
    ]
  );

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

  useEffect(() => {
    setSelectedContactIds([]);
  }, [
    page,
    search,
    filterType,
    filterStatus,
    filterSource,
    filterHealth,
    onlyWithPhone,
    adminLeadView,
    selectedAssignedAgentId,
    sortField,
    sortDirection,
  ]);

  async function loadRecentActivitiesForContacts(nextContacts: Contact[]) {
    if (!nextContacts.length) {
      setRecentActivities({});
      setWhatsappSentContactIds([]);
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
      setWhatsappSentContactIds([]);
      return;
    }

    const map: RecentActivityMap = {};
    const sentIds = new Set<string>();

    for (const contact of nextContacts) {
      map[contact.id] = {
        whatsapp: null,
        email: null,
      };
    }

    for (const raw of data || []) {
      const row = raw as {
        contact_id: string | null;
        activity_type: string | null;
        created_at: string | null;
        template_id: string | null;
        metadata: Record<string, unknown> | null;
      };

      const contactId = String(row.contact_id || "");
      const activityType = String(row.activity_type || "") as
        | "whatsapp"
        | "email";
      const createdAt = row.created_at || "";
      const templateId = row.template_id || null;
      const metadata = row.metadata || {};
      const templateTitle =
        typeof metadata.template_title === "string"
          ? metadata.template_title
          : null;
      const direction =
        typeof metadata.direction === "string" ? metadata.direction : null;
      const outcome =
        typeof metadata.outcome === "string" ? metadata.outcome : null;

      if (!map[contactId]) {
        map[contactId] = {
          whatsapp: null,
          email: null,
        };
      }

      if (
        activityType === "whatsapp" &&
        direction === "outbound" &&
        outcome === "sent"
      ) {
        sentIds.add(contactId);
      }

      if (
        activityType === "whatsapp" &&
        !map[contactId].whatsapp &&
        (
          (direction === "outbound" && outcome === "sent") ||
          (direction === "inbound" && outcome === "replied") ||
          (!direction && !outcome)
        )
      ) {
        map[contactId].whatsapp = {
          contact_id: contactId,
          activity_type: "whatsapp",
          created_at: createdAt,
          template_id: templateId,
          template_title: templateTitle,
        };
      }

      if (activityType === "email" && !map[contactId].email) {
        map[contactId].email = {
          contact_id: contactId,
          activity_type: "email",
          created_at: createdAt,
          template_id: templateId,
          template_title: templateTitle,
        };
      }
    }

    setRecentActivities(map);
    setWhatsappSentContactIds(Array.from(sentIds));
  }

  async function loadContacts(opts?: Partial<typeof queryState>) {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    const nextPage = opts?.page ?? queryState.page;
    const nextSearch = opts?.search ?? queryState.search;
    const nextType = opts?.filterType ?? queryState.filterType;
    const nextStatus = opts?.filterStatus ?? queryState.filterStatus;
    const nextSource = opts?.filterSource ?? queryState.filterSource;
    const nextHealth = opts?.filterHealth ?? queryState.filterHealth;
    const nextOnlyWithPhone = opts?.onlyWithPhone ?? queryState.onlyWithPhone;
    const nextAdminLeadView = opts?.adminLeadView ?? queryState.adminLeadView;
    const nextSelectedAssignedAgentId =
      opts?.selectedAssignedAgentId ?? queryState.selectedAssignedAgentId;
    const nextSortField = opts?.sortField ?? queryState.sortField;
    const nextSortDirection = opts?.sortDirection ?? queryState.sortDirection;

    setLoading(true);
    setErrorMsg(null);

    let countQuery = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", currentOrganizationId);

    let dataQuery = supabase
      .from("contacts")
      .select(
        "id, organization_id, first_name, last_name, phone_primary, email_primary, city, contact_type, lead_status, source, assigned_agent_id, created_at, last_contact_at"
      )
      .eq("organization_id", currentOrganizationId);

    function applySharedFilters(query: any) {
      let q = query;

      if (isAgentOnly) {
        q = q.eq("assigned_agent_id", currentUserId);
      }

      if (isAdminLike) {
        if (nextAdminLeadView === "assigned") {
          q = q.not("assigned_agent_id", "is", null);

          if (nextSelectedAssignedAgentId) {
            q = q.eq("assigned_agent_id", nextSelectedAssignedAgentId);
          }
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

      const healthRange = buildHealthFilterRange(nextHealth);

      if (healthRange?.mode === "never") {
        q = q.is("last_contact_at", null);
      } else if (healthRange?.before) {
        q = q.lt("last_contact_at", healthRange.before);
      } else if (healthRange?.after) {
        q = q.gte("last_contact_at", healthRange.after);
      } else if (healthRange?.from && healthRange?.to) {
        q = q
          .gte("last_contact_at", healthRange.from)
          .lte("last_contact_at", healthRange.to);
      }

      return q;
    }

    countQuery = applySharedFilters(countQuery);
    dataQuery = applySharedFilters(dataQuery);

    if (nextSortField === "name") {
      dataQuery = dataQuery.order("first_name", {
        ascending: nextSortDirection === "asc",
      });
      dataQuery = dataQuery.order("last_name", {
        ascending: nextSortDirection === "asc",
      });
    } else {
      dataQuery = dataQuery.order(nextSortField, {
        ascending: nextSortDirection === "asc",
        nullsFirst:
          nextSortField === "last_contact_at"
            ? nextSortDirection === "asc"
            : false,
      });
    }

    const from = (nextPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    dataQuery = dataQuery.range(from, to);

    const [{ count, error: countError }, { data, error }] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countError || error) {
      setErrorMsg(
        countError?.message || error?.message || "Errore nel caricamento."
      );
      setContacts([]);
      setTotal(0);
      setRecentActivities({});
      setWhatsappSentContactIds([]);
      setLoading(false);
      return;
    }

    const nextContacts = (data || []) as Contact[];
    const computedTotal = typeof count === "number" ? count : 0;

    setContacts(nextContacts);
    setTotal(computedTotal);
    await loadRecentActivitiesForContacts(nextContacts);
    setLoading(false);
  }

  async function loadTemplates() {
    if (!currentOrganizationId) return;

    setLoadingTemplates(true);

    const { data, error } = await supabase
      .from("message_templates")
      .select(
        "id, organization_id, type, title, subject, message, linked_asset_id, created_at, updated_at"
      )
      .eq("organization_id", currentOrganizationId)
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
        rows.map(
          (a: { id: string; full_name?: string | null; email?: string | null }) => ({
            id: a.id,
            full_name: a.full_name || a.email || "Agente",
          })
        )
      );
    } catch {
      return;
    }
  }

  async function assignContact(contactId: string, agentId: string) {
    setErrorMsg(null);
    setAssignmentLoadingId(contactId);

    const currentContact =
      contacts.find((contact) => contact.id === contactId) || null;
    const previousAgentId = currentContact?.assigned_agent_id || null;
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

    if (currentContact?.organization_id && currentUserId) {
      const nextAgent = agents.find((agent) => agent.id === valueToSave) || null;
      const previousAgent =
        agents.find((agent) => agent.id === previousAgentId) || null;

      await supabase.from("contact_activities").insert({
        organization_id: currentContact.organization_id,
        contact_id: contactId,
        created_by: currentUserId,
        activity_type: "assignment",
        channel: null,
        template_id: null,
        note: `Lead assegnato: ${
          previousAgent?.full_name || "non assegnato"
        } → ${nextAgent?.full_name || "non assegnato"}`,
        metadata: {
          source: "contacts_table_assignment",
          previous_assigned_agent_id: previousAgentId,
          previous_assigned_agent_name: previousAgent?.full_name || null,
          assigned_agent_id: valueToSave,
          assigned_agent_name: nextAgent?.full_name || null,
        },
      });
    }

    await loadContacts();
    setAssignmentLoadingId(null);
  }

  async function assignContactsBulk(contactIds: string[], agentId: string) {
    if (!contactIds.length) {
      setErrorMsg("Seleziona almeno un contatto.");
      return;
    }

    if (!agentId) {
      setErrorMsg("Seleziona un agente.");
      return;
    }

    if (!currentUserId) {
      setErrorMsg("Utente non autenticato.");
      return;
    }

    setErrorMsg(null);
    setBulkAssignLoading(true);

    const contactsToAssign = contacts.filter((contact) =>
      contactIds.includes(contact.id)
    );

    const nextAgent = agents.find((agent) => agent.id === agentId) || null;

    const { error } = await supabase
      .from("contacts")
      .update({ assigned_agent_id: agentId })
      .in("id", contactIds);

    if (error) {
      setErrorMsg(error.message);
      setBulkAssignLoading(false);
      return;
    }

    const activityRows = contactsToAssign
      .filter((contact) => Boolean(contact.organization_id))
      .map((contact) => {
        const previousAgent =
          agents.find((agent) => agent.id === contact.assigned_agent_id) || null;

        return {
          organization_id: contact.organization_id,
          contact_id: contact.id,
          created_by: currentUserId,
          activity_type: "assignment",
          channel: null,
          template_id: null,
          note: `Lead assegnato: ${
            previousAgent?.full_name || "non assegnato"
          } → ${nextAgent?.full_name || "Agente"}`,
          metadata: {
            source: "contacts_table_bulk_assignment",
            previous_assigned_agent_id: contact.assigned_agent_id || null,
            previous_assigned_agent_name: previousAgent?.full_name || null,
            assigned_agent_id: agentId,
            assigned_agent_name: nextAgent?.full_name || null,
          },
        };
      });

    if (activityRows.length > 0) {
      await supabase.from("contact_activities").insert(activityRows);
    }

    setSelectedContactIds([]);
    setBulkAssignAgentId("");
    await loadContacts();
    setBulkAssignLoading(false);
  }

  function getQuickActivityType(contactId: string): QuickActivityUiType {
    const value = noteTypeDrafts[contactId];
    if (
      value === "Chiamata" ||
      value === "WhatsApp" ||
      value === "Email" ||
      value === "Incontro" ||
      value === "Note"
    ) {
      return value;
    }

    return DEFAULT_QUICK_ACTIVITY_TYPE;
  }

  async function saveQuickNote(contact: Contact) {
    const note = (noteDrafts[contact.id] || "").trim();
    const selectedType = getQuickActivityType(contact.id);
    const dbActivityType = mapQuickActivityTypeToDbValue(selectedType);

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

    try {
      const result = await createContactActivityAndTouchContact({
        organizationId: contact.organization_id,
        contactId: contact.id,
        createdBy: currentUserId,
        activityType: dbActivityType,
        note,
        currentLeadStatus: contact.lead_status,
        channel:
          dbActivityType === "whatsapp" || dbActivityType === "email"
            ? dbActivityType
            : null,
        metadata: {
          source: "quick_note",
          label: selectedType,
        },
      });

      setNoteDrafts((prev) => ({
        ...prev,
        [contact.id]: "",
      }));

      setNoteTypeDrafts((prev) => ({
        ...prev,
        [contact.id]: DEFAULT_QUICK_ACTIVITY_TYPE,
      }));

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? {
                ...c,
                last_contact_at: result.last_contact_at,
                lead_status: result.lead_status,
              }
            : c
        )
      );

      setExpandedNoteContactId(null);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Errore nel salvataggio."
      );
    } finally {
      setSavingNoteId(null);
    }
  }

  async function handleMarkWhatsappReplyReceived(contact: Contact) {
    if (!currentUserId) {
      setErrorMsg("Utente non autenticato.");
      return;
    }

    if (!contact.organization_id) {
      setErrorMsg("organization_id mancante sul contatto.");
      return;
    }

    setReplyLoadingContactId(contact.id);
    setErrorMsg(null);

    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("contact_activities").insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        created_by: currentUserId,
        activity_type: "whatsapp",
        channel: "whatsapp",
        template_id: null,
        note: "Risposta ricevuta su WhatsApp",
        metadata: {
          source: "contacts_table_reply_received",
          direction: "inbound",
          outcome: "replied",
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const { error: updateError } = await supabase
        .from("contacts")
        .update({ last_contact_at: nowIso })
        .eq("id", contact.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? {
                ...c,
                last_contact_at: nowIso,
              }
            : c
        )
      );

      setRecentActivities((prev) => ({
        ...prev,
        [contact.id]: {
          whatsapp: {
            contact_id: contact.id,
            activity_type: "whatsapp",
            created_at: nowIso,
            template_id: null,
            template_title: "Risposta ricevuta",
          },
          email: prev[contact.id]?.email || null,
        },
      }));
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore nel salvataggio risposta WhatsApp."
      );
    } finally {
      setReplyLoadingContactId(null);
    }
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

  function closeWhatsappOutcomeModal() {
    setPendingWhatsappSend(null);
    setWhatsappOutcomeLoading(false);
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

  async function insertWhatsappOutcomeActivity(
    pending: PendingWhatsappSend,
    outcome: WhatsappOutcome
  ) {
    if (!currentUserId) {
      throw new Error("Utente non autenticato.");
    }

    if (!pending.contact.organization_id) {
      throw new Error("organization_id mancante sul contatto.");
    }

    const nowIso = new Date().toISOString();

    const outcomeNoteMap: Record<WhatsappOutcome, string> = {
      sent: `WhatsApp inviato con template: ${pending.template.title}`,
      not_sent: `WhatsApp non inviato con template: ${pending.template.title}`,
      no_whatsapp: `Contatto senza WhatsApp per template: ${pending.template.title}`,
      error: `Errore invio WhatsApp con template: ${pending.template.title}`,
      invalid_number: `Numero non valido per template WhatsApp: ${pending.template.title}`,
    };

    const metadata: Record<string, unknown> = {
      ...pending.metadata,
      direction: "outbound",
      outcome,
      template_id: pending.template.id,
      campaign_name: pending.template.title,
      template_title: pending.template.title,
      source: "template_send_outcome_popup",
    };

    const { error: activityError } = await supabase
      .from("contact_activities")
      .insert({
        organization_id: pending.contact.organization_id,
        contact_id: pending.contact.id,
        created_by: currentUserId,
        activity_type: "whatsapp",
        channel: "whatsapp",
        template_id: pending.template.id,
        note: outcomeNoteMap[outcome],
        metadata,
      });

    if (activityError) {
      throw new Error(activityError.message);
    }

    const updatePayload: Record<string, unknown> = {
      last_contact_at: nowIso,
    };

    if (outcome === "sent") {
      updatePayload.lead_status = "contattato";
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", pending.contact.id);

    if (contactError) {
      throw new Error(contactError.message);
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === pending.contact.id
          ? {
              ...c,
              last_contact_at: nowIso,
              lead_status: outcome === "sent" ? "contattato" : c.lead_status,
            }
          : c
      )
    );

    if (outcome === "sent") {
      setVerifiedWhatsappContactIds((prev) =>
        prev.includes(pending.contact.id)
          ? prev
          : [...prev, pending.contact.id]
      );

      setWhatsappSentContactIds((prev) =>
        prev.includes(pending.contact.id)
          ? prev
          : [...prev, pending.contact.id]
      );

      setRecentActivities((prev) => ({
        ...prev,
        [pending.contact.id]: {
          whatsapp: {
            contact_id: pending.contact.id,
            activity_type: "whatsapp",
            created_at: nowIso,
            template_id: pending.template.id,
            template_title: pending.template.title,
          },
          email: prev[pending.contact.id]?.email || null,
        },
      }));
    }
  }

  async function handleWhatsappOutcome(outcome: WhatsappOutcome) {
    if (!pendingWhatsappSend) {
      setErrorMsg("Nessun invio WhatsApp in attesa.");
      return;
    }

    setWhatsappOutcomeLoading(true);
    setErrorMsg(null);

    try {
      await insertWhatsappOutcomeActivity(pendingWhatsappSend, outcome);
      closeWhatsappOutcomeModal();
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore nel salvataggio esito WhatsApp."
      );
      setWhatsappOutcomeLoading(false);
    }
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
    let metadata: Record<string, unknown> = {
      template_title: selectedTemplate.title,
    };

    let finalMessage = selectedTemplate.message;

    if (selectedTemplate.linked_asset_id) {
      const { data: asset, error: assetError } = await supabase
        .from("link_assets")
        .select("*")
        .eq("id", selectedTemplate.linked_asset_id)
        .single();

      if (assetError) {
        setErrorMsg(assetError.message);
        setActionLoading(false);
        return;
      }

      if (asset) {
        if (asset.link_type === "static" && asset.static_url) {
          finalMessage += `\n\n${asset.static_url}`;
          metadata = {
            ...metadata,
            link_type: "static",
            linked_asset_id: asset.id,
            linked_asset_name: asset.name || null,
            static_url: asset.static_url,
          };
        }

        if (asset.link_type === "whatsapp_landing") {
          const token = crypto.randomUUID();

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("whatsapp_number")
            .eq("id", currentUserId)
            .single();

          if (profileError || !profile?.whatsapp_number) {
            setErrorMsg("Numero WhatsApp utente non configurato.");
            setActionLoading(false);
            return;
          }

          const { error: insertLinkError } = await supabase
            .from("whatsapp_campaign_links")
            .insert({
              token,
              organization_id: templateModalContact.organization_id,
              contact_id: templateModalContact.id,
              template_id: selectedTemplate.id,
              campaign_name: selectedTemplate.title,
              whatsapp_number: profile.whatsapp_number,
              landing_title: asset.landing_title,
              landing_body: finalMessage,
              landing_footer: asset.landing_footer,
              button_1_label: asset.button_1_label,
              button_1_message: asset.button_1_message,
              button_2_label: asset.button_2_label,
              button_2_message: asset.button_2_message,
              button_3_label: asset.button_3_label,
              button_3_message: asset.button_3_message,
              button_4_label: asset.button_4_label,
              button_4_message: asset.button_4_message,
              is_active: true,
            });

          if (insertLinkError) {
            setErrorMsg(insertLinkError.message);
            setActionLoading(false);
            return;
          }

          const landingUrl = `https://whatsapp.holdingcasacorporation.it/w/${token}`;
          finalMessage += `\n\n${landingUrl}`;

          metadata = {
            ...metadata,
            link_type: "whatsapp_landing",
            linked_asset_id: asset.id,
            linked_asset_name: asset.name || null,
            campaign_name: selectedTemplate.title,
            whatsapp_sender_number: profile.whatsapp_number,
            landing_token: token,
            landing_url: landingUrl,
          };
        }
      }
    }

    if (templateModalType === "whatsapp") {
      const phone = templateModalContact.phone_primary?.trim() || "";
      targetUrl = buildWhatsAppUrl(phone, finalMessage);

      const pending: PendingWhatsappSend = {
        contact: templateModalContact,
        template: selectedTemplate,
        finalMessage,
        targetUrl,
        metadata: {
          ...metadata,
          phone,
        },
      };

      if (targetUrl) {
        window.open(targetUrl as string, "_blank", "noopener,noreferrer");
      }

      closeTemplateModal();
      setPendingWhatsappSend(pending);
      setActionLoading(false);
      return;
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
        finalMessage
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
        direction: "outbound",
        outcome: "opened",
      };
    }

    try {
      const result = await createContactActivityAndTouchContact({
        organizationId: templateModalContact.organization_id,
        contactId: templateModalContact.id,
        createdBy: currentUserId,
        activityType: templateModalType,
        note,
        currentLeadStatus: templateModalContact.lead_status,
        channel: templateModalType,
        templateId: selectedTemplate.id,
        metadata,
      });

      setContacts((prev) =>
        prev.map((c) =>
          c.id === templateModalContact.id
            ? {
                ...c,
                last_contact_at: result.last_contact_at,
                lead_status: result.lead_status,
              }
            : c
        )
      );

      setRecentActivities((prev) => ({
        ...prev,
        [templateModalContact.id]: {
          whatsapp: prev[templateModalContact.id]?.whatsapp || null,
          email: {
            contact_id: templateModalContact.id,
            activity_type: "email",
            created_at: result.last_contact_at,
            template_id: selectedTemplate.id,
            template_title: selectedTemplate.title,
          },
        },
      }));

      window.open(targetUrl as string, "_blank", "noopener,noreferrer");
      closeTemplateModal();
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Errore nell'apertura del template."
      );
      setActionLoading(false);
    }
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
  }, [
    authReady,
    auth.isAuthenticated,
    currentUserId,
    currentOrganizationId,
    router,
  ]);

  useEffect(() => {
    async function bootstrap() {
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

      await loadTemplates();
    }

    bootstrap();
  }, [authReady, currentUserRole, currentOrganizationId]);

  useEffect(() => {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    const timeout = setTimeout(() => {
      loadContacts(queryState);
    }, 250);

    return () => clearTimeout(timeout);
  }, [authReady, currentUserId, currentOrganizationId, queryState]);

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
    setContactType("cliente generico");
    setLeadStatus("nuovo");
    setSource("manual");
    setShowForm(false);

    setPage(1);
    await loadContacts({ ...queryState, page: 1 });
  }

  function handleRefresh() {
    loadContacts(queryState);
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
    setSelectedAssignedAgentId("");
    setSelectedContactIds([]);
    setBulkAssignAgentId("");
    setPage(1);
    setExpandedNoteContactId(null);
  }

  const computedWhatsappSentContactIds = Array.from(
    new Set([
      ...verifiedWhatsappContactIds,
      ...Object.entries(recentActivities)
        .filter(([, value]) => Boolean(value?.whatsapp))
        .map(([contactId]) => contactId),
    ])
  );

  return (
    <>
      <main className="crm-page">
        <div
          style={{
            width: "100%",
            maxWidth: 1700,
            margin: "0 auto",
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <h1 className="crm-page-title">Lead Gestion</h1>
            <div className="crm-page-subtitle">
              Database contatti Casa Corporation
            </div>
          </div>

          <ContactsFilters
            isAdminLike={isAdminLike}
            adminLeadView={adminLeadView}
            selectedAssignedAgentId={selectedAssignedAgentId}
            agents={agents}
            search={search}
            filterType={filterType}
            filterStatus={filterStatus}
            filterSource={filterSource}
            onlyWithPhone={onlyWithPhone}
            filterHealth={filterHealth}
            sortField={sortField}
            sortDirection={sortDirection}
            visibleColumns={visibleColumns}
            onAdminLeadViewChange={(value) => {
              setPage(1);
              setAdminLeadView(value);
              setSelectedContactIds([]);
              setBulkAssignAgentId("");
              if (value !== "assigned") {
                setSelectedAssignedAgentId("");
              }
            }}
            onSelectedAssignedAgentIdChange={(value) => {
              setPage(1);
              setSelectedAssignedAgentId(value);
            }}
            onSearchChange={(value) => {
              setPage(1);
              setSearch(value);
            }}
            onToggleShowForm={() => setShowForm((v) => !v)}
            onRefresh={handleRefresh}
            onFilterTypeChange={(value) => {
              setPage(1);
              setFilterType(value);
            }}
            onFilterStatusChange={(value) => {
              setPage(1);
              setFilterStatus(value);
            }}
            onFilterSourceChange={(value) => {
              setPage(1);
              setFilterSource(value);
            }}
            onOnlyWithPhoneChange={(value) => {
              setPage(1);
              setOnlyWithPhone(value);
            }}
            onFilterHealthChange={(value) => {
              setPage(1);
              setFilterHealth(value);
            }}
            onSortFieldChange={(value) => {
              setPage(1);
              setSortField(value);
            }}
            onSortDirectionChange={(value) => {
              setPage(1);
              setSortDirection(value);
            }}
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

          {verifiedWhatsappContactIds.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#ecfdf3",
                border: "1px solid #86efac",
                color: "#166534",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              WhatsApp verificato ✅ su {verifiedWhatsappContactIds.length} contatt
              {verifiedWhatsappContactIds.length === 1 ? "o" : "i"} in questa sessione
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
            noteTypeDrafts={noteTypeDrafts}
            savingNoteId={savingNoteId}
            assignmentLoadingId={assignmentLoadingId}
            selectedContactIds={selectedContactIds}
            bulkAssignAgentId={bulkAssignAgentId}
            bulkAssignLoading={bulkAssignLoading}
            verifiedWhatsappContactIds={verifiedWhatsappContactIds}
            whatsappSentContactIds={computedWhatsappSentContactIds}
            replyLoadingContactId={replyLoadingContactId}
            onToggleSelectedContact={(contactId) => {
              setSelectedContactIds((prev) =>
                prev.includes(contactId)
                  ? prev.filter((id) => id !== contactId)
                  : [...prev, contactId]
              );
            }}
            onToggleSelectAllCurrentPage={() => {
              const pageIds = contacts.map((contact) => contact.id);
              const areAllSelected =
                pageIds.length > 0 &&
                pageIds.every((id) => selectedContactIds.includes(id));

              setSelectedContactIds((prev) => {
                if (areAllSelected) {
                  return prev.filter((id) => !pageIds.includes(id));
                }

                return Array.from(new Set([...prev, ...pageIds]));
              });
            }}
            onBulkAssignAgentIdChange={setBulkAssignAgentId}
            onBulkAssign={() =>
              assignContactsBulk(selectedContactIds, bulkAssignAgentId)
            }
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
            onMarkWhatsappReplyReceived={handleMarkWhatsappReplyReceived}
            onAssignContact={assignContact}
            getAgentName={getAgentName}
            onNoteDraftChange={(contactId, value) =>
              setNoteDrafts((prev) => ({
                ...prev,
                [contactId]: value,
              }))
            }
            onNoteTypeDraftChange={(contactId, value) =>
              setNoteTypeDrafts((prev) => ({
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
              setNoteTypeDrafts((prev) => ({
                ...prev,
                [contactId]: DEFAULT_QUICK_ACTIVITY_TYPE,
              }));
            }}
            onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      </main>

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

      {pendingWhatsappSend && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#ffffff",
              borderRadius: 18,
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
              padding: 22,
            }}
          >
            <div style={{ marginBottom: 10, fontSize: 20, fontWeight: 700 }}>
              Esito invio WhatsApp
            </div>

            <div style={{ marginBottom: 18, color: "#475569", lineHeight: 1.5 }}>
              Contatto:{" "}
              <b>
                {pendingWhatsappSend.contact.first_name || ""}{" "}
                {pendingWhatsappSend.contact.last_name || ""}
              </b>
              <br />
              Template: <b>{pendingWhatsappSend.template.title}</b>
              <br />
              Numero: <b>{pendingWhatsappSend.contact.phone_primary || "-"}</b>
            </div>

            {!pendingWhatsappSend.targetUrl && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  color: "#9a3412",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Il link WhatsApp non è stato costruito correttamente. Puoi salvare
                direttamente “Numero non valido”.
              </div>
            )}

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <button
                type="button"
                disabled={whatsappOutcomeLoading}
                onClick={() => handleWhatsappOutcome("sent")}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  background: "#16a34a",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                WhatsApp inviato
              </button>

              <button
                type="button"
                disabled={whatsappOutcomeLoading}
                onClick={() => handleWhatsappOutcome("not_sent")}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  background: "#475569",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Non inviato
              </button>

              <button
                type="button"
                disabled={whatsappOutcomeLoading}
                onClick={() => handleWhatsappOutcome("no_whatsapp")}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  background: "#fff",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                Contatto senza WhatsApp
              </button>

              <button
                type="button"
                disabled={whatsappOutcomeLoading}
                onClick={() => handleWhatsappOutcome("error")}
                style={{
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  background: "#fff1f2",
                  color: "#b91c1c",
                  cursor: "pointer",
                }}
              >
                Errore
              </button>

              <button
                type="button"
                disabled={whatsappOutcomeLoading}
                onClick={() => handleWhatsappOutcome("invalid_number")}
                style={{
                  gridColumn: "1 / -1",
                  border: "1px solid #fde68a",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 700,
                  background: "#fffbeb",
                  color: "#92400e",
                  cursor: "pointer",
                }}
              >
                Numero non valido
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                disabled={whatsappOutcomeLoading}
                onClick={closeWhatsappOutcomeModal}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#0f172a",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}