"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelineCardProps } from "./types";

export default function PipelineCard({ contact, isMoving }: PipelineCardProps) {
  const [hover, setHover] = useState(false);
  const router = useRouter();

  const name =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
    "Senza nome";

  const phone = contact.phone_primary || "—";
  const agent =
    (contact as any).assigned_agent_name ||
    (contact as any).assigned_agent ||
    "Non assegnato";

  const contactUrl = `/contacts/${contact.id}`;

  function openContact() {
    router.push(contactUrl);
  }

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", contact.id);
      }}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        openContact();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          window.open(contactUrl, "_blank", "noopener,noreferrer");
        }
      }}
      onMouseDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.button === 0) {
          window.open(contactUrl, "_blank", "noopener,noreferrer");
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Apri scheda contatto"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "6px 8px",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        opacity: isMoving ? 0.5 : 1,
        boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
        lineHeight: 1.2,
        userSelect: "none",
      }}
    >
      {name}

      {hover && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            fontWeight: 500,
            color: "#475569",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div>📱 {phone}</div>
          <div>👤 Referente: {agent}</div>
        </div>
      )}
    </div>
  );
}