import { supabase } from "@/lib/supabaseClient";
import type {
  ActivityChannel,
  ActivityMetadata,
  ActivityType,
  Contact,
  ContactActivity,
  ContactFormValues,
  ContactHealthStatus,
  LeadStatus,
  QuickActivityUiType,
  RecentChannelActivity,
} from "./types";

export const PAGE_SIZE = 50;
export const WARNING_DAYS = 30;

export function formatDateTime(value: string | null) {
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

export function formatDateShort(value: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });
}

export function formatTime(value: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFullName(contact: Contact) {
  return `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "-";
}

export function normalizePhoneForWhatsApp(phone: string | null) {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  return trimmed.replace(/\D/g, "");
}

export function buildWhatsAppUrl(phone: string, text: string) {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;

  const waPhone = normalized.replace(/^\+/, "");
  if (!waPhone) return null;

  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

export function normalizeEmail(email: string | null) {
  if (!email) return null;
  const cleaned = email.trim();
  if (!cleaned) return null;
  return cleaned;
}

export function buildGmailComposeUrl(email: string, subject: string, body: string) {
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

export function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

export function getDaysAgoLabel(value: string | null) {
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

export function buildRecentActivityWarningMessage(
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

export function getDaysSinceDate(value: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getContactHealthStatus(
  lastContactAt: string | null
): ContactHealthStatus {
  const days = getDaysSinceDate(lastContactAt);

  if (days === null) return "never";
  if (days > 90) return "red";
  if (days >= 45) return "orange";
  if (days >= 16) return "yellow";
  return "green";
}

export function getContactHealthLabel(status: ContactHealthStatus) {
  if (status === "never") return "Mai contattato";
  if (status === "red") return "Oltre 90 giorni";
  if (status === "orange") return "45-89 giorni";
  if (status === "yellow") return "16-44 giorni";
  return "Meno di 16 giorni";
}

export function getContactHealthColor(status: ContactHealthStatus) {
  if (status === "never") return "#111111";
  if (status === "red") return "#dc2626";
  if (status === "orange") return "#f97316";
  if (status === "yellow") return "#eab308";
  return "#16a34a";
}

export function formatActivityTypeLabel(value: string | null) {
  const normalized = String(value || "").trim().toLowerCase();

  switch (normalized) {
    case "call":
    case "chiamata":
      return "Chiamata";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    case "meeting":
    case "incontro":
      return "Incontro";
    case "assignment":
      return "Assegnazione";
    case "status_change":
      return "Cambio stato";
    case "profile_update":
      return "Modifica anagrafica";
    case "system":
      return "Sistema";
    case "note":
    case "nota":
    default:
      return "Note";
  }
}

export function mapQuickActivityTypeToDbValue(value: string): ActivityType {
  const normalized = String(value || "").trim().toLowerCase();

  switch (normalized) {
    case "chiamata":
      return "call";
    case "whatsapp":
      return "whatsapp";
    case "email":
      return "email";
    case "incontro":
      return "meeting";
    case "note":
    default:
      return "note";
  }
}

export function mapDbActivityTypeToQuickType(
  value: ActivityType | string | null
): QuickActivityUiType {
  const normalized = String(value || "").trim().toLowerCase();

  switch (normalized) {
    case "call":
      return "Chiamata";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    case "meeting":
      return "Incontro";
    case "note":
    default:
      return "Note";
  }
}

export function getActivityAccentColor(value: string | null) {
  const normalized = String(value || "").trim().toLowerCase();

  switch (normalized) {
    case "call":
      return "#2563eb";
    case "whatsapp":
      return "#16a34a";
    case "email":
      return "#7c3aed";
    case "meeting":
      return "#ea580c";
    case "assignment":
      return "#0f766e";
    case "status_change":
      return "#b45309";
    case "profile_update":
      return "#dc2626";
    case "system":
      return "#475569";
    case "note":
    default:
      return "#111827";
  }
}

export function getActivityTimelineDotStyle(value: string | null) {
  const color = getActivityAccentColor(value);

  return {
    background: color,
    boxShadow: `0 0 0 4px ${color}22`,
  };
}

export function getActivityDisplayNote(activity: ContactActivity) {
  const metadata = activity.metadata || {};
  const fieldLabel = String(metadata.field_label || metadata.field_name || "").trim();
  const previousValue = stringifyMetadataValue(metadata.previous_value);
  const newValue = stringifyMetadataValue(metadata.new_value);

  if (activity.activity_type === "profile_update" && fieldLabel) {
    return `MODIFICA ANAGRAFICA · ${fieldLabel}: ${previousValue} → ${newValue}`;
  }

  if (activity.activity_type === "status_change") {
    const fromStatus = stringifyMetadataValue(metadata.from_status);
    const toStatus = stringifyMetadataValue(metadata.to_status);
    return `Cambio stato lead: ${fromStatus} → ${toStatus}`;
  }

  if (activity.activity_type === "assignment") {
    const previousAgent = stringifyMetadataValue(
      metadata.previous_assigned_agent_name || metadata.previous_assigned_agent_id
    );
    const newAgent = stringifyMetadataValue(
      metadata.assigned_agent_name || metadata.assigned_agent_id
    );
    return `Lead assegnato: ${previousAgent} → ${newAgent}`;
  }

  return activity.note?.trim() || "-";
}

function stringifyMetadataValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "vuoto";
}

export function normalizeTextInput(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function toComparableValue(value: string | null | undefined) {
  return normalizeTextInput(value)?.toLowerCase() || "";
}

export function shouldAutoSetContacted(leadStatus: string | null | undefined) {
  return !String(leadStatus || "").trim() || toComparableValue(leadStatus) === "nuovo";
}

export async function updateContactAfterActivity(
  contactId: string,
  leadStatus: string | null | undefined,
  nowIso = new Date().toISOString()
) {
  const payload: Record<string, string> = {
    last_contact_at: nowIso,
  };

  if (shouldAutoSetContacted(leadStatus)) {
    payload.lead_status = "contattato";
  }

  const { error } = await supabase.from("contacts").update(payload).eq("id", contactId);

  if (error) {
    throw error;
  }

  return {
    last_contact_at: nowIso,
    lead_status: (payload.lead_status as LeadStatus | undefined) ?? leadStatus ?? null,
  };
}

export async function createContactActivity(params: {
  organizationId: string;
  contactId: string;
  createdBy: string | null;
  activityType: ActivityType;
  note: string;
  channel?: ActivityChannel;
  templateId?: string | null;
  metadata?: ActivityMetadata | null;
}) {
  const { error } = await supabase.from("contact_activities").insert({
    organization_id: params.organizationId,
    contact_id: params.contactId,
    created_by: params.createdBy,
    activity_type: params.activityType,
    channel:
      params.channel ??
      (params.activityType === "whatsapp" || params.activityType === "email"
        ? params.activityType
        : null),
    template_id: params.templateId ?? null,
    note: params.note,
    metadata: params.metadata ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function createContactActivityAndTouchContact(params: {
  organizationId: string;
  contactId: string;
  createdBy: string | null;
  activityType: ActivityType;
  note: string;
  currentLeadStatus: string | null | undefined;
  channel?: ActivityChannel;
  templateId?: string | null;
  metadata?: ActivityMetadata | null;
}) {
  await createContactActivity({
    organizationId: params.organizationId,
    contactId: params.contactId,
    createdBy: params.createdBy,
    activityType: params.activityType,
    note: params.note,
    channel: params.channel,
    templateId: params.templateId,
    metadata: params.metadata,
  });

  return await updateContactAfterActivity(
    params.contactId,
    params.currentLeadStatus
  );
}

export type ContactFieldChange = {
  field: keyof ContactFormValues;
  label: string;
  previousValue: string | null;
  nextValue: string | null;
};

export function diffContactEditableFields(
  previousContact: ContactFormValues,
  nextContact: ContactFormValues
): ContactFieldChange[] {
  const definitions: Array<{ field: keyof ContactFormValues; label: string }> = [
    { field: "first_name", label: "Nome" },
    { field: "last_name", label: "Cognome" },
    { field: "phone_primary", label: "Telefono" },
    { field: "email_primary", label: "Email" },
    { field: "city", label: "Città" },
    { field: "contact_type", label: "Tipo contatto" },
    { field: "lead_status", label: "Stato lead" },
    { field: "source", label: "Fonte" },
  ];

  return definitions
    .map(({ field, label }) => {
      const previousValue = normalizeTextInput(previousContact[field] as string | null);
      const nextValue = normalizeTextInput(nextContact[field] as string | null);

      if (toComparableValue(previousValue) === toComparableValue(nextValue)) {
        return null;
      }

      return {
        field,
        label,
        previousValue,
        nextValue,
      } satisfies ContactFieldChange;
    })
    .filter((value): value is ContactFieldChange => Boolean(value));
}

export function buildContactUpdatePayload(values: ContactFormValues) {
  return {
    first_name: normalizeTextInput(values.first_name),
    last_name: normalizeTextInput(values.last_name),
    phone_primary: normalizeTextInput(values.phone_primary),
    email_primary: normalizeTextInput(values.email_primary),
    city: normalizeTextInput(values.city),
    contact_type: normalizeTextInput(values.contact_type) as Contact["contact_type"],
    lead_status: normalizeTextInput(values.lead_status) as Contact["lead_status"],
    source: normalizeTextInput(values.source),
  };
}

export function buildHealthFilterRange(filterHealth: string) {
  const now = new Date();

  if (filterHealth === "never") {
    return { mode: "never" as const };
  }

  if (filterHealth === "red") {
    return { before: subtractDays(now, 90).toISOString() };
  }

  if (filterHealth === "orange") {
    return {
      from: subtractDays(now, 89).toISOString(),
      to: subtractDays(now, 45).toISOString(),
    };
  }

  if (filterHealth === "yellow") {
    return {
      from: subtractDays(now, 44).toISOString(),
      to: subtractDays(now, 16).toISOString(),
    };
  }

  if (filterHealth === "green") {
    return { after: subtractDays(now, 15).toISOString() };
  }

  return null;
}