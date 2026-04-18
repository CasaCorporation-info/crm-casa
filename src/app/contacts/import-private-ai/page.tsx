"use client";

import { ChangeEvent, ClipboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

type ImportSuccessResponse = {
  ok: true;
  import_id: string;
  contact: {
    id: string;
    display_name: string | null;
    phone_primary: string | null;
    source: string | null;
    notes: string | null;
  };
  ai: {
    portal_source: string | null;
    listing_url: string | null;
    extracted_phone: string | null;
    extracted_name: string | null;
    extracted_price: string | null;
    extracted_address: string | null;
    extracted_title: string | null;
    extracted_description: string | null;
    suggested_first_message: string | null;
  };
};

type DuplicateResponse = {
  error: string;
  duplicate: true;
  duplicate_reason: "phone" | "listing_url";
  contact: {
    id: string;
    display_name: string | null;
    phone_primary: string | null;
    source: string | null;
    source_detail: string | null;
    notes: string | null;
  };
};

type ImportErrorResponse = {
  error: string;
  contact_id?: string;
};

export default function ImportPrivateAiPage() {
  const router = useRouter();
  const auth = useAuthContext();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [portalSource, setPortalSource] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<ImportSuccessResponse | null>(
    null
  );
  const [duplicateData, setDuplicateData] = useState<DuplicateResponse | null>(
    null
  );

  const normalizedRole = String(auth.role || "").trim().toLowerCase();
  const canUsePage = ["admin", "manager", "agent"].includes(normalizedRole);

  const detectedPortalLabel = useMemo(() => {
    const value = listingUrl.trim().toLowerCase();

    if (value.includes("immobiliare.it")) return "Immobiliare.it";
    if (value.includes("idealista.it")) return "Idealista";
    if (value.includes("casa.it")) return "Casa.it";
    if (value.includes("wikicasa.it")) return "Wikicasa";
    return "";
  }, [listingUrl]);

  function clearPreviewUrl() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
  }

  function applyImageFile(nextFile: File | null) {
    setErrorMsg(null);
    setSuccessData(null);
    setDuplicateData(null);
    setImageFile(nextFile);

    clearPreviewUrl();

    if (!nextFile) {
      setImagePreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    setImagePreviewUrl(nextPreviewUrl);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    applyImageFile(nextFile);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items;
    if (!items?.length) return;

    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;

      const file = item.getAsFile();
      if (!file) continue;

      const pastedFile = new File([file], `pasted-${Date.now()}.png`, {
        type: file.type || "image/png",
      });

      applyImageFile(pastedFile);
      event.preventDefault();
      return;
    }
  }

  function resetForm() {
    setSuccessData(null);
    setDuplicateData(null);
    setErrorMsg(null);
    setImageFile(null);
    clearPreviewUrl();
    setImagePreviewUrl(null);
    setPortalSource("");
    setListingUrl("");
  }

  async function handleSubmit() {
    setErrorMsg(null);
    setSuccessData(null);
    setDuplicateData(null);

    if (!imageFile) {
      setErrorMsg("Seleziona prima uno screenshot.");
      return;
    }

    if (!auth.isAuthenticated) {
      setErrorMsg("Sessione non valida. Fai login di nuovo.");
      return;
    }

    if (!canUsePage) {
      setErrorMsg("Non hai i permessi per usare questa funzione.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setErrorMsg("Sessione non valida. Fai login di nuovo.");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("image", imageFile);

      const finalPortalSource = portalSource.trim() || detectedPortalLabel || "";

      if (finalPortalSource) {
        formData.append("portal_source", finalPortalSource);
      }

      if (listingUrl.trim()) {
        formData.append("listing_url", listingUrl.trim());
      }

      const response = await fetch("/api/contacts/import-private-ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const result = (await response.json()) as
        | ImportSuccessResponse
        | DuplicateResponse
        | ImportErrorResponse;

      if (response.status === 409) {
        setDuplicateData(result as DuplicateResponse);
        setErrorMsg(null);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const err = result as ImportErrorResponse;
        setErrorMsg(err.error || "Errore durante l'import.");
        setLoading(false);
        return;
      }

      setSuccessData(result as ImportSuccessResponse);
      setLoading(false);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Errore durante l'import."
      );
      setLoading(false);
    }
  }

  if (auth.loading) {
    return <div style={{ padding: 40 }}>Caricamento...</div>;
  }

  if (!auth.isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (!canUsePage) {
    return (
      <div style={{ padding: 40 }}>
        <button
          onClick={() => router.push("/contacts")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            marginBottom: 16,
          }}
        >
          ← Torna ai lead
        </button>

        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <b>Errore:</b> Non hai i permessi per usare questa funzione.
        </div>
      </div>
    );
  }

  return (
    <main className="crm-page">
      <div
        onPaste={handlePaste}
        style={{
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 className="crm-page-title">Aggiungi privati IA</h1>
            <div className="crm-page-subtitle">
              Carica uno screenshot di un annuncio e crea automaticamente il lead
            </div>
          </div>

          <button
            onClick={() => router.push("/contacts")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ← Torna ai lead
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "#ffecec",
              border: "1px solid #ffb3b3",
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <b>Errore:</b> {errorMsg}
          </div>
        )}

        {duplicateData && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              padding: 16,
              borderRadius: 14,
              marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              È già presente questo contatto
            </div>

            <div style={{ marginBottom: 6 }}>
              <b>Motivo blocco:</b>{" "}
              {duplicateData.duplicate_reason === "phone"
                ? "stesso numero di telefono"
                : "stesso link annuncio"}
            </div>

            <div style={{ marginBottom: 6 }}>
              <b>Contatto:</b> {duplicateData.contact.display_name || "-"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Telefono:</b> {duplicateData.contact.phone_primary || "-"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Fonte:</b> {duplicateData.contact.source || "-"}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => router.push(`/contacts/${duplicateData.contact.id}`)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Apri contatto esistente
              </button>

              <button
                onClick={resetForm}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Nuovo import
              </button>
            </div>
          </div>
        )}

        {successData && (
          <div
            style={{
              background: "#ecfdf3",
              border: "1px solid #86efac",
              padding: 16,
              borderRadius: 14,
              marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Lead creato correttamente
            </div>

            <div style={{ marginBottom: 6 }}>
              <b>Contatto:</b> {successData.contact.display_name || "-"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Telefono:</b> {successData.contact.phone_primary || "-"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Fonte:</b> {successData.contact.source || "-"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Prezzo estratto:</b> {successData.ai.extracted_price || "-"}
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Indirizzo estratto:</b> {successData.ai.extracted_address || "-"}
            </div>

            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid #d1fadf",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Primo messaggio consigliato
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {successData.ai.suggested_first_message || "-"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 14,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => router.push(`/contacts/${successData.contact.id}`)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Apri contatto
              </button>

              <button
                onClick={resetForm}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Nuovo import
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 18,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Dati input</div>

            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>Screenshot annuncio</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#fff",
                  }}
                />
              </label>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px dashed #ccc",
                  background: "#fafafa",
                  color: "#555",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Puoi anche fare <b>Ctrl+V</b> direttamente in questa pagina dopo
                aver copiato uno screenshot.
              </div>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>
                  Portale origine (opzionale)
                </span>
                <input
                  value={portalSource}
                  onChange={(e) => setPortalSource(e.target.value)}
                  placeholder="Es. Immobiliare.it"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>
                  Link annuncio (opzionale ma utile)
                </span>
                <input
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="https://www.immobiliare.it/annunci/..."
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                  }}
                />
              </label>

              {detectedPortalLabel && !portalSource.trim() && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#555",
                    marginTop: -4,
                  }}
                >
                  Portale rilevato dal link: <b>{detectedPortalLabel}</b>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !imageFile}
                style={{
                  marginTop: 4,
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1px solid #111",
                  background: loading || !imageFile ? "#444" : "#111",
                  color: "#fff",
                  cursor: loading || !imageFile ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 15,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                }}
              >
                {loading ? "Importazione in corso..." : "Aggiungi privati IA"}
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 18,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 14 }}>
              Anteprima screenshot
            </div>

            <div
              style={{
                minHeight: 420,
                borderRadius: 14,
                border: "1px dashed #ccc",
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Anteprima screenshot annuncio"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "#666",
                    lineHeight: 1.5,
                  }}
                >
                  Carica uno screenshot di Immobiliare, Idealista o altro portale,
                  oppure copia l'immagine e fai Ctrl+V qui dentro.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}