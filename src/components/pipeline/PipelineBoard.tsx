"use client";

import { useMemo } from "react";
import PipelineColumn from "./PipelineColumn";
import type { PipelineBoardProps } from "./types";
import type { PipelineStatus } from "./constants";

export default function PipelineBoard({
  contacts,
  statuses,
  onMoveContact,
  movingContactId,
  totalsByStatus,
  showTotals,
}: PipelineBoardProps) {
  const contactsByStatus = useMemo(() => {
    const grouped: Record<PipelineStatus, PipelineBoardProps["contacts"]> =
      statuses.reduce((acc, status) => {
        acc[status] = [];
        return acc;
      }, {} as Record<PipelineStatus, PipelineBoardProps["contacts"]>);

    for (const contact of contacts) {
      const currentStatus = String(contact.lead_status || "nuovo")
        .trim()
        .toLowerCase() as PipelineStatus;

      if (statuses.includes(currentStatus)) {
        grouped[currentStatus].push(contact);
      } else {
        grouped.nuovo.push(contact);
      }
    }

    return grouped;
  }, [contacts, statuses]);

  return (
    <div
      style={{
        overflowX: "auto",
        paddingBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          minWidth: "max-content",
        }}
      >
        {statuses.map((status) => (
          <PipelineColumn
            key={status}
            title={status}
            contacts={contactsByStatus[status] ?? []}
            onDropContact={onMoveContact}
            movingContactId={movingContactId}
            totalCount={totalsByStatus[status] ?? 0}
            showTotals={showTotals}
          />
        ))}
      </div>
    </div>
  );
}