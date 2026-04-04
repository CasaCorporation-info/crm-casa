"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Field = {
  id: string;
  field_key: string;
  field_label: string;
  section_key: string;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  input_type: string;
  input_options: string[];
};

type ValuationResult = {
  min: number;
  max: number;
  media: number;
  commento: string;
};

const ORGANIZATION_ID = "1573b4fa-eb4a-4fb2-9c7e-fba3ef58a580";

function getSectionTitle(section: string) {
  switch (section) {
    case "contact":
      return "Dati contatto";
    case "property":
      return "Dati immobile";
    case "building":
      return "Edificio";
    case "features":
      return "Caratteristiche";
    case "pricing":
      return "Dati economici";
    case "notes":
      return "Note";
    default:
      return section;
  }
}

const SECTION_ORDER = [
  "contact",
  "property",
  "building",
  "features",
  "pricing",
  "notes",
];

function formatBoolean(value: boolean) {
  return value ? "Sì" : "No";
}

function normalizeAiValue(field: Field, rawValue: any) {
  if (rawValue === null || rawValue === undefined) return null;

  if (field.input_type === "boolean") {
    return formatBoolean(!!rawValue);
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    return trimmed;
  }

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  return rawValue;
}

function buildAiPayload(fields: Field[], form: Record<string, any>) {
  const aiSections: Record<string, Record<string, any>> = {};

  for (const field of fields) {
    const rawValue = form[field.field_key];
    const normalizedValue = normalizeAiValue(field, rawValue);

    if (normalizedValue === null) continue;

    const sectionTitle = getSectionTitle(field.section_key);

    if (!aiSections[sectionTitle]) {
      aiSections[sectionTitle] = {};
    }

    aiSections[sectionTitle][field.field_label] = normalizedValue;
  }

  const comune =
    form.comune ||
    form.citta ||
    form.city ||
    form.comune_immobile ||
    form.comune_appartenenza ||
    null;

  const zona =
    form.zona ||
    form.zona_immobile ||
    form.quartiere ||
    form.area ||
    null;

  const microzona =
    form.microzona ||
    form.micro_zona ||
    form.sottozona ||
    form.localita ||
    null;

  const indirizzo =
    form.indirizzo_immobile ||
    form.indirizzo ||
    form.via ||
    null;

  const civico = form.civico || form.numero_civico || null;

  return {
    organization_id: ORGANIZATION_ID,
    contesto_localizzazione: {
      comune,
      zona,
      microzona,
      indirizzo,
      civico,
    },
    dati_immobiliari: aiSections,
  };
}

export default function ValuatorForm() {
  const [fields, setFields] = useState<Field[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    contact: false,
    property: false,
    building: false,
    features: false,
    pricing: false,
    notes: false,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    async function loadFields() {
      const { data } = await supabase
        .from("valuator_field_settings")
        .select("*")
        .eq("organization_id", ORGANIZATION_ID)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (data) {
        setFields(data);

        const initial: Record<string, any> = {};
        data.forEach((f) => {
          initial[f.field_key] = f.input_type === "boolean" ? false : "";
        });
        setForm(initial);
      }
    }

    loadFields();
  }, []);

  function toggleSection(sectionKey: string) {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const { error: saveError } = await supabase
        .from("property_valuations")
        .insert({
          organization_id: ORGANIZATION_ID,
          contact_name: form.nominativo_venditori || null,
          phone: form.recapito_telefonico || null,
          email: form.email || null,
          property_address: form.indirizzo_immobile || null,
          property_data: form,
          status: "draft",
        });

      if (saveError) {
        throw new Error("Errore salvataggio su Supabase");
      }

      const aiPayload = buildAiPayload(fields, form);

      const response = await fetch("/api/valuator/chatgpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Errore nella generazione della valutazione");
      }

      if (
        typeof data?.min !== "number" ||
        typeof data?.max !== "number" ||
        typeof data?.media !== "number" ||
        typeof data?.commento !== "string"
      ) {
        throw new Error("Risposta API non valida");
      }

      setResult({
        min: data.min,
        max: data.max,
        media: data.media,
        commento: data.commento,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Errore imprevisto"
      );
    } finally {
      setLoading(false);
    }
  }

  function renderField(field: Field) {
    const value = form[field.field_key] ?? "";

    switch (field.input_type) {
      case "textarea":
        return (
          <textarea
            name={field.field_key}
            value={value}
            onChange={handleChange}
            required={field.is_required}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d0d5dd",
            }}
          />
        );

      case "number":
        return (
          <input
            type="number"
            name={field.field_key}
            value={value}
            onChange={handleChange}
            required={field.is_required}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d0d5dd",
            }}
          />
        );

      case "select":
        return (
          <select
            name={field.field_key}
            value={value}
            onChange={handleChange}
            required={field.is_required}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d0d5dd",
            }}
          >
            <option value="">Seleziona</option>
            {field.input_options?.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minHeight: "44px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d0d5dd",
              background: "#fff",
            }}
          >
            <input
              type="checkbox"
              name={field.field_key}
              checked={!!value}
              onChange={handleChange}
              style={{
                width: "18px",
                height: "18px",
                margin: 0,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 500 }}>{value ? "Sì" : "No"}</span>
          </div>
        );

      default:
        return (
          <input
            type="text"
            name={field.field_key}
            value={value}
            onChange={handleChange}
            required={field.is_required}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d0d5dd",
            }}
          />
        );
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, Field[]> = {};

    fields.forEach((field) => {
      if (!map[field.section_key]) {
        map[field.section_key] = [];
      }
      map[field.section_key].push(field);
    });

    return map;
  }, [fields]);

  const visibleSections = SECTION_ORDER.filter(
    (sectionKey) => grouped[sectionKey]?.length
  );

  return (
    <div style={{ display: "grid", gap: "20px", maxWidth: "900px" }}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        {visibleSections.map((sectionKey) => {
          const sectionFields = grouped[sectionKey];
          const isOpen = !!openSections[sectionKey];

          return (
            <div
              key={sectionKey}
              style={{
                border: "1px solid #ddd",
                borderRadius: "14px",
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection(sectionKey)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "none",
                  background: "#f8f8f8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "18px",
                  fontWeight: 700,
                  textAlign: "left",
                }}
              >
                <span>{getSectionTitle(sectionKey)}</span>
                <span style={{ fontSize: "20px" }}>{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div style={{ padding: "16px", display: "grid", gap: "14px" }}>
                  {sectionFields.map((field) => (
                    <div key={field.id} style={{ display: "grid", gap: "6px" }}>
                      <label style={{ fontWeight: 600 }}>
                        {field.field_label}
                        {field.is_required ? " *" : ""}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "14px 18px",
            borderRadius: "12px",
            border: "none",
            background: loading ? "#666" : "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? "Generazione in corso..." : "Genera valutazione"}
        </button>
      </form>

      {errorMessage && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      )}

      {result && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "16px",
            background: "#fff",
            padding: "20px",
            display: "grid",
            gap: "16px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
            }}
          >
            Valutazione stimata
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Valore minimo
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                € {result.min.toLocaleString("it-IT")}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Valore medio
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                € {result.media.toLocaleString("it-IT")}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Valore massimo
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                € {result.max.toLocaleString("it-IT")}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "8px",
                fontWeight: 700,
              }}
            >
              Commento professionale
            </div>
            <div
              style={{
                whiteSpace: "pre-line",
                lineHeight: 1.5,
              }}
            >
              {result.commento}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}