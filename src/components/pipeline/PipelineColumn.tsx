"use client";

import { useMemo, useState } from "react";
import PipelineCard from "./PipelineCard";
import type { PipelineColumnProps } from "./types";

function getColumnColors(title: string) {
  const key = title.trim().toLowerCase();

  switch (key) {
    case "nuovo":
      return {
        accent: "#2563eb",
        badgeBg: "#dbeafe",
        badgeColor: "#1d4ed8",
      };
    case "contattato":
      return {
        accent: "#0f766e",
        badgeBg: "#ccfbf1",
        badgeColor: "#0f766e",
      };
    case "informazione":
      return {
        accent: "#7c3aed",
        badgeBg: "#ede9fe",
        badgeColor: "#6d28d9",
      };
    case "notizia":
      return {
        accent: "#0891b2",
        badgeBg: "#cffafe",
        badgeColor: "#0e7490",
      };
    case "valutazione fissata":
      return {
        accent: "#d97706",
        badgeBg: "#fef3c7",
        badgeColor: "#b45309",
      };
    case "valutazione effettuata":
      return {
        accent: "#ea580c",
        badgeBg: "#ffedd5",
        badgeColor: "#c2410c",
      };
    case "incarico preso":
      return {
        accent: "#16a34a",
        badgeBg: "#dcfce7",
        badgeColor: "#15803d",
      };
    case "venduto":
      return {
        accent: "#15803d",
        badgeBg: "#dcfce7",
        badgeColor: "#166534",
      };
    case "non interessato":
      return {
        accent: "#64748b",
        badgeBg: "#e2e8f0",
        badgeColor: "#475569",
      };
    case "da eliminare":
      return {
        accent: "#dc2626",
        badgeBg: "#fee2e2",
        badgeColor: "#b91c1c",
      };
    default:
      return {
        accent: "#334155",
        badgeBg: "#e2e8f0",
        badgeColor: "#334155",
      };
  }
}

export default function PipelineColumn({
  title,
  contacts,
  onDropContact,
  movingContactId,
  totalCount,
  showTotals,
}: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const aName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim().toLowerCase();
      const bName = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim().toLowerCase();
      return aName.localeCompare(bName, "it");
    });
  }, [contacts]);

  const colors = getColumnColors(title);
  const visibleCount = sortedContacts.length;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setIsOver(false);

        const contactId = event.dataTransfer.getData("text/plain");
        if (!contactId) return;

        await onDropContact(contactId, title);
      }}
      style={{
        minWidth: 145,
        width: 145,
        background: isOver ? "#eff6ff" : "#f8fafc",
        border: isOver ? `1px solid ${colors.accent}` : "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 420,
        boxShadow: isOver
          ? "0 6px 18px rgba(37, 99, 235, 0.10)"
          : "0 2px 10px rgba(15, 23, 42, 0.04)",
        transition:
          "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div
        style={{
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          padding: "8px 8px 7px 8px",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: colors.accent,
            marginBottom: 8,
          }}
        />

        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.2,
            wordBreak: "break-word",
            marginBottom: 6,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 26,
              height: 22,
              padding: "0 8px",
              borderRadius: 999,
              background: colors.badgeBg,
              color: colors.badgeColor,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {showTotals ? visibleCount : totalCount}
          </div>

          {showTotals ? (
            <>
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.2,
                  color: "#64748b",
                }}
              >
                visibili: {visibleCount}
              </div>

              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.2,
                  color: "#0f172a",
                  fontWeight: 700,
                }}
              >
                totali: {totalCount}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: 20,
        }}
      >
        {sortedContacts.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "#94a3b8",
              padding: "8px 3px",
              lineHeight: 1.25,
            }}
          >
            Nessun contatto
          </div>
        ) : (
          sortedContacts.map((contact) => (
            <PipelineCard
              key={contact.id}
              contact={contact}
              isMoving={movingContactId === contact.id}
            />
          ))
        )}
      </div>
    </div>
  );
}