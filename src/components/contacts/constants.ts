import type { QuickActivityUiType, VisibleColumnsState } from "@/components/contacts/types";

export const VISIBLE_COLUMNS_STORAGE_KEY = "contacts_visible_columns";

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumnsState = {
  email: true,
  city: true,
  type: true,
  source: true,
  created_at: true,
};

export const DEFAULT_QUICK_ACTIVITY_TYPE: QuickActivityUiType = "Note";