"use client";

type CompanyInfo = {
  name: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
};

export type ValuationPreviewData = {
  company: CompanyInfo;
  pricing: {
    min: number;
    media: number;
    max: number;
    suggested: number;
  };
  assignment: {
    duration: string;
    commission: string;
    tacitRenewal: string;
  };
  omi: {
    zone: string;
    min: string;
    max: string;
  };
  ai: {
    comment: string;
  };
  toolsUsed: string[];
  benefits: {
    noExpenseRefund: boolean;
    reviewsLabel: string;
    reviewsUrl: string;
    advancedAiTools: boolean;
  };
};

type Props = {
  data: ValuationPreviewData;
  onChange: (next: ValuationPreviewData) => void;
};

function formatCurrency(value: number) {
  return `€ ${value.toLocaleString("it-IT")}`;
}

function parseEditableNumber(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  if (!normalized) return 0;
  return Number(normalized);
}

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
  fontFamily: "inherit",
};

function EditableMoneyCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "16px",
        background: "#fff",
        display: "grid",
        gap: "8px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#64748b",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label} · X
      </div>
      <input
        type="text"
        value={value ? value.toLocaleString("it-IT") : ""}
        onChange={(e) => onChange(parseEditableNumber(e.target.value))}
        style={{
          ...baseInputStyle,
          fontSize: "22px",
          fontWeight: 800,
        }}
      />
      <div style={{ fontSize: "12px", color: "#64748b" }}>
        Valore attuale: {formatCurrency(value)}
      </div>
    </div>
  );
}

function EditableTextField({
  label,
  value,
  onChange,
  placeholder,
  marker = "XX",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  marker?: "X" | "XX";
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "16px",
        background: "#fff",
        display: "grid",
        gap: "8px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#64748b",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label} · {marker}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={baseInputStyle}
      />
    </div>
  );
}

export default function ValuationPreview({ data, onChange }: Props) {
  return (
    <div
      id="valuation-preview"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "22px",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        padding: "24px",
        display: "grid",
        gap: "20px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "18px",
          display: "grid",
          gap: "6px",
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a" }}>
          {data.company.name}
        </div>
        {data.company.tagline && (
          <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 600 }}>
            {data.company.tagline}
          </div>
        )}
        <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
          {[
            data.company.address,
            data.company.phone,
            data.company.email,
            data.company.website,
          ]
            .filter(Boolean)
            .join(" • ")}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "24px",
          background: "#fff",
          display: "grid",
          gap: "12px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            color: "#64748b",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Prezzo di Vendita Consigliato · X
        </div>
        <input
          type="text"
          value={
            data.pricing.suggested
              ? data.pricing.suggested.toLocaleString("it-IT")
              : ""
          }
          onChange={(e) =>
            onChange({
              ...data,
              pricing: {
                ...data.pricing,
                suggested: parseEditableNumber(e.target.value),
              },
            })
          }
          style={{
            ...baseInputStyle,
            textAlign: "center",
            fontSize: "40px",
            fontWeight: 900,
            color: "#0f172a",
            maxWidth: "340px",
            margin: "0 auto",
          }}
        />
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Valore attuale: {formatCurrency(data.pricing.suggested)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <EditableTextField
          label="Durata incarico"
          value={data.assignment.duration}
          onChange={(value) =>
            onChange({
              ...data,
              assignment: { ...data.assignment, duration: value },
            })
          }
          placeholder="Es. 6 mesi"
          marker="XX"
        />

        <EditableTextField
          label="Provvigione"
          value={data.assignment.commission}
          onChange={(value) =>
            onChange({
              ...data,
              assignment: { ...data.assignment, commission: value },
            })
          }
          placeholder="Es. 3% + IVA"
          marker="XX"
        />

        <EditableTextField
          label="Tacito rinnovo"
          value={data.assignment.tacitRenewal}
          onChange={(value) =>
            onChange({
              ...data,
              assignment: { ...data.assignment, tacitRenewal: value },
            })
          }
          placeholder="Es. 45 giorni"
          marker="XX"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <EditableMoneyCard
          label="Prezzo minimo"
          value={data.pricing.min}
          onChange={(value) =>
            onChange({
              ...data,
              pricing: { ...data.pricing, min: value },
            })
          }
        />
        <EditableMoneyCard
          label="Prezzo medio"
          value={data.pricing.media}
          onChange={(value) =>
            onChange({
              ...data,
              pricing: { ...data.pricing, media: value },
            })
          }
        />
        <EditableMoneyCard
          label="Prezzo massimo"
          value={data.pricing.max}
          onChange={(value) =>
            onChange({
              ...data,
              pricing: { ...data.pricing, max: value },
            })
          }
        />
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "18px",
          padding: "18px",
          background: "#fff",
          display: "grid",
          gap: "14px",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Dati OMI
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "16px",
              background: "#f8fafc",
              display: "grid",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Zona
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>
              {data.omi.zone || "-"}
            </div>
          </div>

          <EditableTextField
            label="OMI minimo"
            value={data.omi.min}
            onChange={(value) =>
              onChange({
                ...data,
                omi: { ...data.omi, min: value },
              })
            }
            placeholder="Es. 2.100 €/mq"
            marker="X"
          />

          <EditableTextField
            label="OMI massimo"
            value={data.omi.max}
            onChange={(value) =>
              onChange({
                ...data,
                omi: { ...data.omi, max: value },
              })
            }
            placeholder="Es. 2.700 €/mq"
            marker="X"
          />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "18px",
          padding: "18px",
          background: "#fff",
          display: "grid",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Commento di ChatGPT
        </div>
        <div
          style={{
            whiteSpace: "pre-line",
            lineHeight: 1.6,
            color: "#334155",
          }}
        >
          {data.ai.comment}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "18px",
          padding: "18px",
          background: "#fff",
          display: "grid",
          gap: "14px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: "18px",
            fontWeight: 900,
            color: "#0f172a",
          }}
        >
          Strumenti usati
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "center",
          }}
        >
          {data.toolsUsed.map((item) => (
            <div
              key={item}
              style={{
                padding: "10px 14px",
                borderRadius: "999px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: "13px",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "18px",
          padding: "18px",
          background: "#fff",
          display: "grid",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: 900,
            color: "#0f172a",
          }}
        >
          Vantaggi di vendere con Casa Corporation
        </div>

        <div style={{ display: "grid", gap: "8px", color: "#334155" }}>
          {data.benefits.noExpenseRefund && (
            <div>[V] Rinuncia al rimborso spese</div>
          )}
          <div>
            [V] Affidabilità -{" "}
            <a
              href={data.benefits.reviewsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#0f172a",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              {data.benefits.reviewsLabel}
            </a>
          </div>
          {data.benefits.advancedAiTools && (
            <div>[V] Risorse IA all'avanguardia</div>
          )}
        </div>
      </div>
    </div>
  );
}