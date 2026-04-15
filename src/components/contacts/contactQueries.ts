import type {
  Agent,
  Contact,
  MessageTemplate,
  RecentActivityMap,
  SortDirection,
  SortField,
} from "@/components/contacts/types";
import {
  PAGE_SIZE,
  WARNING_DAYS,
  buildHealthFilterRange,
  subtractDays,
} from "@/components/contacts/utils";

type LoadContactsParams = {
  supabase: any;
  organizationId: string;
  currentUserId: string;
  isAdminLike: boolean;
  isAgentOnly: boolean;
  queryState: {
    page: number;
    search: string;
    filterType: string;
    filterStatus: string;
    filterSource: string;
    filterHealth: string;
    onlyWithPhone: boolean;
    adminLeadView: "assigned" | "unassigned";
    selectedAssignedAgentId: string;
    sortField: SortField;
    sortDirection: SortDirection;
  };
};

type LoadContactsSuccess = {
  ok: true;
  contacts: Contact[];
  total: number;
  recentActivities: RecentActivityMap;
  whatsappSentContactIds: string[];
};

type LoadContactsError = {
  ok: false;
  errorMessage: string;
};

type LoadContactsResult = LoadContactsSuccess | LoadContactsError;

export async function loadAgents({
  supabase,
}: {
  supabase: any;
}): Promise<Agent[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return [];

    const res = await fetch("/api/admin/agents/list", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) return [];

    const json = await res.json();
    const rows = Array.isArray(json) ? json : json?.agents || json?.data || [];

    return rows.map(
      (a: {
        id: string;
        full_name?: string | null;
        email?: string | null;
        role?: string | null;
      }) => ({
        id: a.id,
        full_name: a.full_name || a.email || "Agente",
        role:
          a.role === "admin" || a.role === "manager" || a.role === "agent"
            ? a.role
            : undefined,
      })
    );
  } catch {
    return [];
  }
}

export async function loadTemplates({
  supabase,
  organizationId,
  currentUserId,
  isAdminLike,
}: {
  supabase: any;
  organizationId: string;
  currentUserId: string;
  isAdminLike: boolean;
}): Promise<MessageTemplate[]> {
  let query = supabase
    .from("message_templates")
    .select(
      "id, organization_id, type, title, subject, message, linked_asset_id, created_at, updated_at, assigned_user_id"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (!isAdminLike) {
    query = query.eq("assigned_user_id", currentUserId);
  }

  const { data, error } = await query;

  if (error) return [];

  return (data || []) as MessageTemplate[];
}

async function loadRecentActivitiesForContacts({
  supabase,
  nextContacts,
}: {
  supabase: any;
  nextContacts: Contact[];
}): Promise<{
  recentActivities: RecentActivityMap;
  whatsappSentContactIds: string[];
}> {
  if (!nextContacts.length) {
    return {
      recentActivities: {},
      whatsappSentContactIds: [],
    };
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
    return {
      recentActivities: {},
      whatsappSentContactIds: [],
    };
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

  return {
    recentActivities: map,
    whatsappSentContactIds: Array.from(sentIds),
  };
}

export async function loadContacts({
  supabase,
  organizationId,
  currentUserId,
  isAdminLike,
  isAgentOnly,
  queryState,
}: LoadContactsParams): Promise<LoadContactsResult> {
  const nextPage = queryState.page;
  const nextSearch = queryState.search;
  const nextType = queryState.filterType;
  const nextStatus = queryState.filterStatus;
  const nextSource = queryState.filterSource;
  const nextHealth = queryState.filterHealth;
  const nextOnlyWithPhone = queryState.onlyWithPhone;
  const nextAdminLeadView = queryState.adminLeadView;
  const nextSelectedAssignedAgentId = queryState.selectedAssignedAgentId;
  const nextSortField = queryState.sortField;
  const nextSortDirection = queryState.sortDirection;

  let countQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  let dataQuery = supabase
    .from("contacts")
    .select(
      "id, organization_id, first_name, last_name, phone_primary, email_primary, city, contact_type, lead_status, source, assigned_agent_id, created_at, last_contact_at"
    )
    .eq("organization_id", organizationId);

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
    return {
      ok: false,
      errorMessage:
        countError?.message || error?.message || "Errore nel caricamento.",
    };
  }

  const nextContacts = (data || []) as Contact[];
  const computedTotal = typeof count === "number" ? count : 0;

  const { recentActivities, whatsappSentContactIds } =
    await loadRecentActivitiesForContacts({
      supabase,
      nextContacts,
    });

  return {
    ok: true,
    contacts: nextContacts,
    total: computedTotal,
    recentActivities,
    whatsappSentContactIds,
  };
}