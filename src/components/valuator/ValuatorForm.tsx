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

    const { error } = await supabase.from("property_valuations").insert({
      organization_id: ORGANIZATION_ID,
      contact_name: form.nominativo_venditori,
      phone: form.recapito_telefonico,
      email: form.email,
      property_address: form.indirizzo_immobile,
      property_data: form,
      status: "draft",
    });

    if (error) {
      alert("Errore salvataggio");
      return;
    }

    alert("Valutazione salvata");
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
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: "16px", maxWidth: "900px" }}
    >
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
        style={{
          padding: "14px 18px",
          borderRadius: "12px",
          border: "none",
          background: "#111",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Genera valutazione
      </button>
    </form>
  );
}