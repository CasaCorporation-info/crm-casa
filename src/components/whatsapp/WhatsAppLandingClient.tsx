"use client";

import { useEffect, useRef, useState } from "react";
import type { LandingButton } from "@/lib/whatsappLinks";

type Props = {
  token: string;
  title: string;
  body: string;
  footer: string | null;
  buttons: LandingButton[];
};

export default function WhatsAppLandingClient({
  token,
  title,
  body,
  footer,
  buttons,
}: Props) {
  const openedRef = useRef(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    fetch("/api/whatsapp-links/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [token]);

  async function handleClick(buttonKey: string) {
    try {
      setLoadingKey(buttonKey);

      const response = await fetch("/api/whatsapp-links/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          buttonKey,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.whatsappUrl) {
        alert("Errore nell'apertura di WhatsApp.");
        return;
      }

      window.location.href = data.whatsappUrl;
    } catch {
      alert("Errore nell'apertura di WhatsApp.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#efeae2",
        padding: "20px 12px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
        }}
      >
        <div
          style={{
            background: "#075e54",
            color: "#fff",
            borderRadius: 18,
            padding: "14px 16px",
            marginBottom: 12,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Modulo risposta rapida
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
            border: "1px solid #e6e6e6",
          }}
        >
          <div
            style={{
              background: "#dcf8c6",
              borderRadius: 14,
              padding: 14,
              whiteSpace: "pre-line",
              fontSize: 15,
              lineHeight: 1.5,
              color: "#111",
              marginBottom: 16,
            }}
          >
            {body}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {buttons.map((button) => (
              <button
                key={button.key}
                onClick={() => handleClick(button.key)}
                disabled={loadingKey !== null}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: "#128c7e",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: loadingKey && loadingKey !== button.key ? 0.7 : 1,
                }}
              >
                {loadingKey === button.key ? "Apertura..." : button.label}
              </button>
            ))}
          </div>

          {footer ? (
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                color: "#555",
                textAlign: "center",
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}