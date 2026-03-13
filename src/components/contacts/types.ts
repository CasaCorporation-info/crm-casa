export const LEAD_STATUS_OPTIONS = [
  "nuovo",
  "contattato",
  "non interessato",
  "informazione",
  "notizia",
  "valutazione fissata",
  "valutazione effettuata",
  "incarico preso",
  "venduto",
  "da eliminare",
] as const;

export type LeadStatus = (typeof LEAD_STATUS_OPTIONS)[number];

export const CONTACT_TYPE_OPTIONS = [
  "owner",
  "buyer",
  "investor",
  "tenant",
  "ex_client",
  "lead",
  "partner",
] as const;

export type ContactType = (typeof CONTACT_TYPE_OPTIONS)[number];

export const QUICK_ACTIVITY_TYPE_OPTIONS = [
  "Chiamata",
  "WhatsApp",
  "Email",
  "Incontro",
  "Note",
] as const;

export type QuickActivityUiType = (typeof QUICK_ACTIVITY_TYPE_OPTIONS)[number];

export type ActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "note"
  | "assignment"
  | "status_change"
  | "profile_update"
  | "system";

export type ActivityChannel = "whatsapp" | "email" | null;

export type ActivityMetadata = {
  source?: string;
  label?: string;
  template_title?: string | null;
  status?: string | null;
  phone?: string | null;
  email?: string | null;
  subject?: string | null;
  field_name?: string | null;
  field_label?: string | null;
  previous_value?: string | null;
  new_value?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  previous_assigned_agent_id?: string | null;
  previous_assigned_agent_name?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  [key: string]: unknown;
};

export type Contact = {
  id: string;
  organization_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  email_primary: string | null;
  city: string | null;
  contact_type: ContactType | string | null;
  lead_status: LeadStatus | string | null;
  source: string | null;
  assigned_agent_id: string | null;
  created_at: string | null;
  last_contact_at: string | null;
};

export type ContactFormValues = Pick<
  Contact,
  | "first_name"
  | "last_name"
  | "phone_primary"
  | "email_primary"
  | "city"
  | "contact_type"
  | "lead_status"
  | "source"
>;

export type UserProfile = {
  id: string;
  role: string | null;
  organization_id: string | null;
};

export type Agent = {
  id: string;
  full_name: string | null;
};

export type MessageTemplate = {
  id: string;
  organization_id: string;
  type: "whatsapp" | "email";
  title: string;
  subject: string | null;
  message: string;
  created_at: string;
  updated_at: string;
};

export type RecentChannelActivity = {
  contact_id: string;
  activity_type: "whatsapp" | "email";
  created_at: string;
  template_id: string | null;
  template_title: string | null;
};

export type RecentActivityMap = Record<
  string,
  {
    whatsapp: RecentChannelActivity | null;
    email: RecentChannelActivity | null;
  }
>;

export type ContactActivity = {
  id: string;
  organization_id?: string | null;
  contact_id: string;
  created_by: string | null;
  activity_type: ActivityType | string | null;
  channel?: ActivityChannel;
  template_id?: string | null;
  note: string | null;
  metadata?: ActivityMetadata | null;
  created_at: string | null;
};

export type ContactHealthStatus =
  | "never"
  | "red"
  | "orange"
  | "yellow"
  | "green";

export type SortField = "created_at" | "last_contact_at" | "name";
export type SortDirection = "asc" | "desc";

export type VisibleColumnKey =
  | "email"
  | "city"
  | "type"
  | "source"
  | "created_at";

export type VisibleColumnsState = Record<VisibleColumnKey, boolean>;