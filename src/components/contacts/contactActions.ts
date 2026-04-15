import type { Agent, Contact, QuickActivityUiType } from "@/components/contacts/types";
import {
  createContactActivityAndTouchContact,
  mapQuickActivityTypeToDbValue,
} from "@/components/contacts/utils";

type CreateContactParams = {
  supabase: any;
  currentUserId: string | null;
  currentOrganizationId: string | null;
  isAgentOnly: boolean;
  payload: {
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    contactType: string;
    leadStatus: string;
    source: string;
  };
};

type CreateContactResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export async function createContact({
  supabase,
  currentUserId,
  currentOrganizationId,
  isAgentOnly,
  payload,
}: CreateContactParams): Promise<CreateContactResult> {
  if (!currentUserId) {
    return {
      ok: false,
      errorMessage: "Utente non autenticato.",
    };
  }

  if (!currentOrganizationId) {
    return {
      ok: false,
      errorMessage: "organization_id utente mancante.",
    };
  }

  const insertPayload = {
    organization_id: currentOrganizationId,
    created_by: currentUserId,
    first_name: payload.firstName.trim() || null,
    last_name: payload.lastName.trim() || null,
    phone_primary: payload.phone.trim() || null,
    city: payload.city.trim() || null,
    contact_type: payload.contactType || null,
    lead_status: payload.leadStatus || "nuovo",
    source: payload.source.trim() || null,
    assigned_agent_id: isAgentOnly ? currentUserId : null,
  };

  const { error } = await supabase.from("contacts").insert(insertPayload);

  if (error) {
    return {
      ok: false,
      errorMessage: error.message,
    };
  }

  return { ok: true };
}

type AssignContactParams = {
  supabase: any;
  contacts: Contact[];
  agents: Agent[];
  contactId: string;
  agentId: string;
  currentUserId: string | null;
};

type AssignContactResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export async function assignContact({
  supabase,
  contacts,
  agents,
  contactId,
  agentId,
  currentUserId,
}: AssignContactParams): Promise<AssignContactResult> {
  const currentContact =
    contacts.find((contact) => contact.id === contactId) || null;
  const previousAgentId = currentContact?.assigned_agent_id || null;
  const valueToSave = agentId || null;

  const { error } = await supabase
    .from("contacts")
    .update({ assigned_agent_id: valueToSave })
    .eq("id", contactId);

  if (error) {
    return {
      ok: false,
      errorMessage: error.message,
    };
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

  return { ok: true };
}

type AssignContactsBulkParams = {
  supabase: any;
  contacts: Contact[];
  agents: Agent[];
  contactIds: string[];
  agentId: string;
  currentUserId: string | null;
};

type AssignContactsBulkResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export async function assignContactsBulk({
  supabase,
  contacts,
  agents,
  contactIds,
  agentId,
  currentUserId,
}: AssignContactsBulkParams): Promise<AssignContactsBulkResult> {
  if (!contactIds.length) {
    return {
      ok: false,
      errorMessage: "Seleziona almeno un contatto.",
    };
  }

  if (!agentId) {
    return {
      ok: false,
      errorMessage: "Seleziona un agente.",
    };
  }

  if (!currentUserId) {
    return {
      ok: false,
      errorMessage: "Utente non autenticato.",
    };
  }

  const contactsToAssign = contacts.filter((contact) =>
    contactIds.includes(contact.id)
  );

  const nextAgent = agents.find((agent) => agent.id === agentId) || null;

  const { error } = await supabase
    .from("contacts")
    .update({ assigned_agent_id: agentId })
    .in("id", contactIds);

  if (error) {
    return {
      ok: false,
      errorMessage: error.message,
    };
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

  return { ok: true };
}

type SaveQuickNoteParams = {
  supabase: any;
  contact: Contact;
  note: string;
  selectedType: QuickActivityUiType;
  currentUserId: string | null;
};

type SaveQuickNoteResult =
  | {
      ok: true;
      lastContactAt: string | null;
      leadStatus: string | null;
    }
  | {
      ok: false;
      errorMessage: string;
    };

export async function saveQuickNote({
  supabase,
  contact,
  note,
  selectedType,
  currentUserId,
}: SaveQuickNoteParams): Promise<SaveQuickNoteResult> {
  const trimmedNote = note.trim();
  const dbActivityType = mapQuickActivityTypeToDbValue(selectedType);

  if (!trimmedNote) {
    return {
      ok: false,
      errorMessage: "Scrivi un esito prima di salvare.",
    };
  }

  if (!contact.organization_id) {
    return {
      ok: false,
      errorMessage: "organization_id mancante sul contatto.",
    };
  }

  if (!currentUserId) {
    return {
      ok: false,
      errorMessage: "Utente non autenticato.",
    };
  }

  try {
    const result = await createContactActivityAndTouchContact({
      organizationId: contact.organization_id,
      contactId: contact.id,
      createdBy: currentUserId,
      activityType: dbActivityType,
      note: trimmedNote,
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

    return {
      ok: true,
      lastContactAt: result.last_contact_at,
      leadStatus: result.lead_status,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage:
        error instanceof Error ? error.message : "Errore nel salvataggio.",
    };
  }
}

type MarkWhatsappReplyReceivedParams = {
  supabase: any;
  contact: Contact;
  currentUserId: string | null;
};

type MarkWhatsappReplyReceivedResult =
  | {
      ok: true;
      nowIso: string;
    }
  | {
      ok: false;
      errorMessage: string;
    };

export async function markWhatsappReplyReceived({
  supabase,
  contact,
  currentUserId,
}: MarkWhatsappReplyReceivedParams): Promise<MarkWhatsappReplyReceivedResult> {
  if (!currentUserId) {
    return {
      ok: false,
      errorMessage: "Utente non autenticato.",
    };
  }

  if (!contact.organization_id) {
    return {
      ok: false,
      errorMessage: "organization_id mancante sul contatto.",
    };
  }

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

    return {
      ok: true,
      nowIso,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Errore nel salvataggio risposta WhatsApp.",
    };
  }
}