export type Contact = {
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