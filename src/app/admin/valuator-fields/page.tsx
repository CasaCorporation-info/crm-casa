"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ValuatorFieldSetting = {
  id: string;
  organization_id: string;
  field_key: string;
  field_label: string;
  section_key: string;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  input_type: string;
  input_options: string[];
  created_at: string;
  updated_at: string;
};

const ORGANIZATION_ID = "1573b4fa-eb4a-4fb2-9c7e-fba3ef58a580";

function slugifyFieldKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getSectionLabel(sectionKey: string) {
  switch (sectionKey) {
    case "contact":
      return "Contatto";
    case "property":
      return "Immobile";
    case "building":
      return "Edificio";
    case "features":
      return "Caratteristiche";
    case "pricing":
      return "Dati economici";
    case "notes":
      return "Note";
    default:
      return sectionKey;
  }
}

function getInputTypeLabel(inputType: string) {
  switch (inputType) {
    case "text":
      return "Testo";
    case "number":
      return "Numero";
    case "textarea":
      return "Testo lungo";
    case "select":
      return "Scelta da elenco";
    case "boolean":
      return "Sì / No";
    default:
      return inputType;
  }
}

export default function ValuatorFieldsPage() {
  const [fields, setFields] = useState<ValuatorFieldSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const [newField, setNewField] = useState({
    field_label: "",
    section_key: "property",
    is_active: true,
    is_required: false,
    sort_order: "",
    input_type: "text",
    input_options_text: "",
  });

  const generatedFieldKey = useMemo(
    () => slugifyFieldKey(newField.field_label),
    [newField.field_label]
  );

  async function loadFields() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("valuator_field_settings")
      .select("*")
      .eq("organization_id", ORGANIZATION_ID)
      .order("sort_order", { ascending: true });

    if (error) {
      setErrorMsg("Errore caricamento campi");
      setLoading(false);
      return;
    }

    setFields(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadFields();
  }, []);

  function resetForm() {
    setNewField({
      field_label: "",
      section_key: "property",
      is_active: true,
      is_required: false,
      sort_order: "",
      input_type: "text",
      input_options_text: "",
    });
    setEditingFieldId(null);
  }

  function handleNewFieldChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked =
      e.target instanceof HTMLInputElement ? e.target.checked : false;

    setNewField((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const fieldLabel = newField.field_label.trim();
    const fieldKey = slugifyFieldKey(fieldLabel);

    if (!fieldLabel) {
      alert("Compila il nome del campo");
      return;
    }

    if (!fieldKey) {
      alert("Non riesco a generare la chiave tecnica del campo");
      return;
    }

    let parsedOptions: string[] = [];

    if (newField.input_type === "select") {
      parsedOptions = newField.input_options_text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (parsedOptions.length === 0) {
        alert("Per un campo a scelta devi inserire almeno un'opzione");
        return;
      }
    }

    setSaving(true);

    if (editingFieldId) {
      const { error } = await supabase
        .from("valuator_field_settings")
        .update({
          field_key: fieldKey,
          field_label: fieldLabel,
          section_key: newField.section_key,
          is_active: newField.is_active,
          is_required: newField.is_required,
          sort_order: Number(newField.sort_order) || 0,
          input_type: newField.input_type,
          input_options: parsedOptions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingFieldId)
        .eq("organization_id", ORGANIZATION_ID);

      setSaving(false);

      if (error) {
        console.error(error);
        alert("Errore modifica campo");
        return;
      }

      resetForm();
      await loadFields();
      alert("Campo modificato");
      return;
    }

    const { error } = await supabase.from("valuator_field_settings").insert({
      organization_id: ORGANIZATION_ID,
      field_key: fieldKey,
      field_label: fieldLabel,
      section_key: newField.section_key,
      is_active: newField.is_active,
      is_required: newField.is_required,
      sort_order: Number(newField.sort_order) || 0,
      input_type: newField.input_type,
      input_options: parsedOptions,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Errore creazione campo");
      return;
    }

    resetForm();
    await loadFields();
    alert("Campo creato");
  }

  function handleEditField(field: ValuatorFieldSetting) {
    setEditingFieldId(field.id);
    setNewField({
      field_label: field.field_label,
      section_key: field.section_key,
      is_active: field.is_active,
      is_required: field.is_required,
      sort_order: String(field.sort_order ?? ""),
      input_type: field.input_type || "text",
      input_options_text:
        Array.isArray(field.input_options) && field.input_options.length > 0
          ? field.input_options.join(", ")
          : "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteField(field: ValuatorFieldSetting) {
    const confirmed = window.confirm(
      `Sicuro di voler cancellare questo campo?\n\n${field.field_label}`
    );

    if (!confirmed) {
      return;
    }

    setDeletingFieldId(field.id);

    const { error } = await supabase
      .from("valuator_field_settings")
      .delete()
      .eq("id", field.id)
      .eq("organization_id", ORGANIZATION_ID);

    setDeletingFieldId(null);

    if (error) {
      console.error(error);
      alert("Errore cancellazione campo");
      return;
    }

    if (editingFieldId === field.id) {
      resetForm();
    }

    await loadFields();
    alert("Campo cancellato");
  }

  return (
    <main style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "16px" }}>
        Configurazione campi valutatore
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "12px",
          maxWidth: "760px",
          marginBottom: "24px",
          padding: "16px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          background: "#fff",
        }}
      >
        <h2 style={{ margin: 0 }}>
          {editingFieldId ? "Modifica campo" : "Aggiungi nuovo campo"}
        </h2>

        <div style={{ display: "grid", gap: "6px" }}>
          <label htmlFor="field_label">Campo</label>
          <input
            id="field_label"
            name="field_label"
            placeholder="Es. Anno di costruzione"
            value={newField.field_label}
            onChange={handleNewFieldChange}
          />
        </div>

        <div
          style={{
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: "10px",
            background: "#f8f8f8",
          }}
        >
          <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: "4px" }}>
            Chiave tecnica generata automaticamente
          </div>
          <div style={{ fontWeight: 600 }}>{generatedFieldKey || "-"}</div>
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <label htmlFor="section_key">Sezione</label>
          <select
            id="section_key"
            name="section_key"
            value={newField.section_key}
            onChange={handleNewFieldChange}
          >
            <option value="contact">Contatto</option>
            <option value="property">Immobile</option>
            <option value="building">Edificio</option>
            <option value="features">Caratteristiche</option>
            <option value="pricing">Dati economici</option>
            <option value="notes">Note</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <label htmlFor="input_type">Tipo campo</label>
          <select
            id="input_type"
            name="input_type"
            value={newField.input_type}
            onChange={handleNewFieldChange}
          >
            <option value="text">Testo</option>
            <option value="number">Numero</option>
            <option value="textarea">Testo lungo</option>
            <option value="select">Scelta da elenco</option>
            <option value="boolean">Sì / No</option>
          </select>
        </div>

        {newField.input_type === "select" && (
          <div style={{ display: "grid", gap: "6px" }}>
            <label htmlFor="input_options_text">Opzioni</label>
            <textarea
              id="input_options_text"
              name="input_options_text"
              placeholder="Es. appartamento, villa, ufficio"
              value={newField.input_options_text}
              onChange={handleNewFieldChange}
              rows={4}
            />
          </div>
        )}

        <div style={{ display: "grid", gap: "6px" }}>
          <label htmlFor="sort_order">Posizione</label>
          <input
            id="sort_order"
            name="sort_order"
            placeholder="Es. 120"
            value={newField.sort_order}
            onChange={handleNewFieldChange}
          />
        </div>

        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="checkbox"
            name="is_active"
            checked={newField.is_active}
            onChange={handleNewFieldChange}
          />
          Attivo
        </label>

        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="checkbox"
            name="is_required"
            checked={newField.is_required}
            onChange={handleNewFieldChange}
          />
          Obbligatorio
        </label>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="submit" disabled={saving}>
            {saving
              ? "Salvataggio..."
              : editingFieldId
              ? "Salva modifiche"
              : "Crea campo"}
          </button>

          {editingFieldId && (
            <button type="button" onClick={resetForm}>
              Annulla modifica
            </button>
          )}
        </div>
      </form>

      {loading && <p>Caricamento...</p>}
      {errorMsg && <p>{errorMsg}</p>}

      {!loading && !errorMsg && (
        <div style={{ display: "grid", gap: "12px" }}>
          {fields.map((field) => (
            <div
              key={field.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "12px",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "grid", gap: "6px" }}>
                  <div><strong>Campo:</strong> {field.field_label}</div>
                  <div><strong>Chiave tecnica:</strong> {field.field_key}</div>
                  <div><strong>Sezione:</strong> {getSectionLabel(field.section_key)}</div>
                  <div><strong>Tipo:</strong> {getInputTypeLabel(field.input_type)}</div>
                  {field.input_type === "select" && (
                    <div>
                      <strong>Opzioni:</strong>{" "}
                      {Array.isArray(field.input_options) && field.input_options.length > 0
                        ? field.input_options.join(", ")
                        : "-"}
                    </div>
                  )}
                  <div><strong>Attivo:</strong> {field.is_active ? "Sì" : "No"}</div>
                  <div><strong>Obbligatorio:</strong> {field.is_required ? "Sì" : "No"}</div>
                  <div><strong>Posizione:</strong> {field.sort_order}</div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleEditField(field)}
                    style={{
                      minWidth: "84px",
                      height: "40px",
                      borderRadius: "10px",
                      border: "1px solid #111",
                      background: "#fff",
                      color: "#111",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Modifica
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteField(field)}
                    disabled={deletingFieldId === field.id}
                    style={{
                      minWidth: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      border: "1px solid #d00",
                      background: "#fff",
                      color: "#d00",
                      cursor: "pointer",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                    title="Cancella campo"
                  >
                    {deletingFieldId === field.id ? "..." : "X"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}