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
import { PAGE_SIZE } from "@/components/contacts/utils";
import {
  DEFAULT_QUICK_ACTIVITY_TYPE,
  DEFAULT_VISIBLE_COLUMNS,
  VISIBLE_COLUMNS_STORAGE_KEY,
} from "@/components/contacts/constants";
import CreateContactForm from "@/components/contacts/CreateContactForm";
import ContactsFilters from "@/components/contacts/ContactsFilters";
import TemplateModal from "@/components/contacts/TemplateModal";
import ContactsTable from "@/components/contacts/ContactsTable";
import WhatsappOutcomeModal from "@/components/contacts/WhatsappOutcomeModal";
import {
  loadAgents,
  loadContacts,
  loadTemplates,
} from "@/components/contacts/contactQueries";
import {
  assignContact,
  assignContactsBulk,
  createContact,
  markWhatsappReplyReceived,
  saveQuickNote,
} from "@/components/contacts/contactActions";
import {
  closeTemplateModalState,
  closeWhatsappOutcomeModalState,
  handleSendFromTemplate,
  insertWhatsappOutcomeActivity,
  tryOpenTemplateModal,
} from "@/components/contacts/templateActions";

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
      if (
        !authReady ||
        !currentOrganizationId ||
        !currentUserRole ||
        !currentUserId
      ) {
        return;
      }

      const normalizedBootstrapRole = String(currentUserRole || "")
        .trim()
        .toLowerCase();

      if (
        normalizedBootstrapRole === "admin" ||
        normalizedBootstrapRole === "manager"
      ) {
        const loadedAgents = await loadAgents({ supabase });
        setAgents(loadedAgents);
      }

      setLoadingTemplates(true);
      const loadedTemplates = await loadTemplates({
        supabase,
        organizationId: currentOrganizationId,
        currentUserId,
        isAdminLike,
      });
      setTemplates(loadedTemplates);
      setLoadingTemplates(false);
    }

    bootstrap();
  }, [authReady, currentUserRole, currentOrganizationId, currentUserId, isAdminLike]);

  useEffect(() => {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      setErrorMsg(null);

      const result = await loadContacts({
        supabase,
        organizationId: currentOrganizationId,
        currentUserId,
        isAdminLike,
        isAgentOnly,
        queryState,
      });

      if (!result.ok) {
        setErrorMsg(result.errorMessage);
        setContacts([]);
        setTotal(0);
        setRecentActivities({});
        setWhatsappSentContactIds([]);
        setLoading(false);
        return;
      }

      setContacts(result.contacts);
      setTotal(result.total);
      setRecentActivities(result.recentActivities);
      setWhatsappSentContactIds(result.whatsappSentContactIds);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [
    authReady,
    currentUserId,
    currentOrganizationId,
    isAdminLike,
    isAgentOnly,
    queryState,
  ]);

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

  function getAgentName(agentId: string | null) {
    if (!agentId) return "-";
    const found = agents.find((a) => String(a.id) === String(agentId));
    return found?.full_name?.trim() || "Agente";
  }

  function closeTemplateModal() {
    closeTemplateModalState({
      setTemplateModalOpen,
      setTemplateModalType,
      setTemplateModalContact,
      setSelectedTemplateId,
      setActionLoading,
    });
  }

  function closeWhatsappOutcomeModal() {
    closeWhatsappOutcomeModalState({
      setPendingWhatsappSend,
      setWhatsappOutcomeLoading,
    });
  }

  async function handleRefresh() {
    if (!authReady || !currentUserId || !currentOrganizationId) return;

    setLoading(true);
    setErrorMsg(null);

    const result = await loadContacts({
      supabase,
      organizationId: currentOrganizationId,
      currentUserId,
      isAdminLike,
      isAgentOnly,
      queryState,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      setContacts([]);
      setTotal(0);
      setRecentActivities({});
      setWhatsappSentContactIds([]);
      setLoading(false);
      return;
    }

    setContacts(result.contacts);
    setTotal(result.total);
    setRecentActivities(result.recentActivities);
    setWhatsappSentContactIds(result.whatsappSentContactIds);
    setLoading(false);
  }

  async function handleCreateContact() {
    setErrorMsg(null);

    const result = await createContact({
      supabase,
      currentUserId,
      currentOrganizationId,
      isAgentOnly,
      payload: {
        firstName,
        lastName,
        phone,
        city,
        contactType,
        leadStatus,
        source,
      },
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
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
    await handleRefresh();
  }

  async function handleAssignContact(contactId: string, agentId: string) {
    setErrorMsg(null);
    setAssignmentLoadingId(contactId);

    const result = await assignContact({
      supabase,
      contacts,
      agents,
      contactId,
      agentId,
      currentUserId,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      setAssignmentLoadingId(null);
      return;
    }

    await handleRefresh();
    setAssignmentLoadingId(null);
  }

  async function handleAssignContactsBulk(
    contactIds: string[],
    agentId: string
  ) {
    setErrorMsg(null);
    setBulkAssignLoading(true);

    const result = await assignContactsBulk({
      supabase,
      contacts,
      agents,
      contactIds,
      agentId,
      currentUserId,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      setBulkAssignLoading(false);
      return;
    }

    setSelectedContactIds([]);
    setBulkAssignAgentId("");
    await handleRefresh();
    setBulkAssignLoading(false);
  }

  async function handleSaveQuickNote(contact: Contact) {
    const note = (noteDrafts[contact.id] || "").trim();
    const selectedType = getQuickActivityType(contact.id);

    setSavingNoteId(contact.id);
    setErrorMsg(null);

    const result = await saveQuickNote({
      supabase,
      contact,
      note,
      selectedType,
      currentUserId,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      setSavingNoteId(null);
      return;
    }

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
            last_contact_at: result.lastContactAt,
            lead_status: result.leadStatus,
          }
          : c
      )
    );

    setExpandedNoteContactId(null);
    setSavingNoteId(null);
  }

  async function handleMarkWhatsappReplyReceived(contact: Contact) {
    setReplyLoadingContactId(contact.id);
    setErrorMsg(null);

    const result = await markWhatsappReplyReceived({
      supabase,
      contact,
      currentUserId,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      setReplyLoadingContactId(null);
      return;
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id
          ? {
            ...c,
            last_contact_at: result.nowIso,
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
          created_at: result.nowIso,
          template_id: null,
          template_title: "Risposta ricevuta",
        },
        email: prev[contact.id]?.email || null,
      },
    }));

    setReplyLoadingContactId(null);
  }

  function handleTryOpenTemplateModal(
    contact: Contact,
    type: "whatsapp" | "email"
  ) {
    const result = tryOpenTemplateModal({
      contact,
      type,
      recentActivities,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      return;
    }

    if (!result.shouldOpen) return;

    setTemplateModalContact(contact);
    setTemplateModalType(type);
    setSelectedTemplateId("");
    setTemplateModalOpen(true);
    setErrorMsg(null);
  }

  async function handleWhatsappOutcome(outcome: WhatsappOutcome) {
    if (!pendingWhatsappSend) {
      setErrorMsg("Nessun invio WhatsApp in attesa.");
      return;
    }

    setWhatsappOutcomeLoading(true);
    setErrorMsg(null);

    const result = await insertWhatsappOutcomeActivity({
      supabase,
      pending: pendingWhatsappSend,
      outcome,
      currentUserId,
    });

    if (!result.ok) {
      setErrorMsg(result.errorMessage);
      setWhatsappOutcomeLoading(false);
      return;
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === pendingWhatsappSend.contact.id
          ? {
            ...c,
            last_contact_at: result.nowIso,
            lead_status: outcome === "sent" ? "contattato" : c.lead_status,
          }
          : c
      )
    );

    if (outcome === "sent") {
      setVerifiedWhatsappContactIds((prev) =>
        prev.includes(pendingWhatsappSend.contact.id)
          ? prev
          : [...prev, pendingWhatsappSend.contact.id]
      );

      setWhatsappSentContactIds((prev) =>
        prev.includes(pendingWhatsappSend.contact.id)
          ? prev
          : [...prev, pendingWhatsappSend.contact.id]
      );

      setRecentActivities((prev) => ({
        ...prev,
        [pendingWhatsappSend.contact.id]: {
          whatsapp: {
            contact_id: pendingWhatsappSend.contact.id,
            activity_type: "whatsapp",
            created_at: result.nowIso,
            template_id: pendingWhatsappSend.template.id,
            template_title: pendingWhatsappSend.template.title,
          },
          email: prev[pendingWhatsappSend.contact.id]?.email || null,
        },
      }));
    }

    closeWhatsappOutcomeModal();
  }

  async function onHandleSendFromTemplate() {
    const result = await handleSendFromTemplate({
      supabase,
      templateModalContact,
      templateModalType,
      selectedTemplate,
      currentUserId,
      setErrorMsg,
      setActionLoading,
    });

    if (!result.ok) return;

    if (result.mode === "whatsapp_pending") {
      closeTemplateModal();
      setPendingWhatsappSend(result.pendingWhatsappSend);
      setActionLoading(false);
      return;
    }

    if (result.mode === "email_done") {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === result.contactId
            ? {
              ...c,
              last_contact_at: result.lastContactAt,
              lead_status: result.leadStatus,
            }
            : c
        )
      );

      setRecentActivities((prev) => ({
        ...prev,
        [result.contactId]: {
          whatsapp: prev[result.contactId]?.whatsapp || null,
          email: {
            contact_id: result.contactId,
            activity_type: "email",
            created_at: result.lastContactAt || new Date().toISOString(),
            template_id: result.templateId,
            template_title: result.templateTitle,
          },
        },
      }));

      closeTemplateModal();
    }
  }

  function handleToggleVisibleColumn(key: VisibleColumnKey) {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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
      ...whatsappSentContactIds,
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
          <div
            style={{
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 className="crm-page-title">Lead Gestion</h1>
              <div className="crm-page-subtitle">
                Database contatti Casa Corporation
              </div>
            </div>

            <button
              onClick={() => router.push("/contacts/import-private-ai")}
              style={{
                padding: "12px 16px",
                borderRadius: 14,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
              }}
            >
              ✨ Aggiungi privati IA
            </button>
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
            onSave={handleCreateContact}
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
              {verifiedWhatsappContactIds.length === 1 ? "o" : "i"} in questa
              sessione
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
              handleAssignContactsBulk(selectedContactIds, bulkAssignAgentId)
            }
            onToggleExpandedNote={(contactId) =>
              setExpandedNoteContactId((prev) =>
                prev === contactId ? null : contactId
              )
            }
            onViewActivities={(contactId) => router.push(`/contacts/${contactId}`)}
            onOpenWhatsappTemplate={(contact) =>
              handleTryOpenTemplateModal(contact, "whatsapp")
            }
            onOpenEmailTemplate={(contact) =>
              handleTryOpenTemplateModal(contact, "email")
            }
            onMarkWhatsappReplyReceived={handleMarkWhatsappReplyReceived}
            onAssignContact={handleAssignContact}
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
            onSaveQuickNote={handleSaveQuickNote}
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
        onConfirm={onHandleSendFromTemplate}
      />

      <WhatsappOutcomeModal
        pendingWhatsappSend={pendingWhatsappSend}
        whatsappOutcomeLoading={whatsappOutcomeLoading}
        onClose={closeWhatsappOutcomeModal}
        onOutcome={handleWhatsappOutcome}
      />
    </>
  );
}