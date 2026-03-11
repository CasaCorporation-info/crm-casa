import type { PipelineStatus } from "./constants";

export type PipelineContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  lead_status: string | null;
  assigned_agent_id?: string | null;
};

export type PipelineBoardProps = {
  contacts: PipelineContact[];
  statuses: readonly PipelineStatus[];
  onMoveContact: (contactId: string, newStatus: PipelineStatus) => Promise<void>;
  movingContactId: string | null;
  totalsByStatus: Record<PipelineStatus, number>;
  showTotals: boolean;
};

export type PipelineColumnProps = {
  title: PipelineStatus;
  contacts: PipelineContact[];
  onDropContact: (contactId: string, newStatus: PipelineStatus) => Promise<void>;
  movingContactId: string | null;
  totalCount: number;
  showTotals: boolean;
};

export type PipelineCardProps = {
  contact: PipelineContact;
  isMoving: boolean;
};