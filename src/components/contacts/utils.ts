import type {
  Contact,
  ContactHealthStatus,
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