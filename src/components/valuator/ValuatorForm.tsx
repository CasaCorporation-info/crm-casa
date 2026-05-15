"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabaseClient";
import ValuationPreview, {
  type ValuationPreviewData,
} from "@/components/valuator/ValuationPreview";

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
  zonaOmi?: string | null;
  omiMin?: string | null;
  omiMax?: string | null;
};

type ValuationMode = "technical" | "free_text";

type PdfLinks = {
  reviewsUrl: string;
  whatsappAgentUrl: string;
  whatsappPromoUrl: string;
  incaricoPdfUrl: string;
  websiteUrl: string;
};

type PreparedUploadResponse = {
  success: boolean;
  mode: "prepare";
  valuation_pdf: {
    token: string;
    tracked_url: string;
  };
  reviews: {
    token: string;
    tracked_url: string;
  };
  whatsapp: {
    token: string;
    tracked_url: string;
  };
  website: {
    token: string;
    tracked_url: string;
  };
  incarico: {
    token: string;
    tracked_url: string;
  } | null;
};

type FinalizeUploadResponse = {
  success: boolean;
  mode: "finalize";
  storage_path: string;
  destination_url: string;
  tracked_url: string;
};

const ORGANIZATION_ID = "1573b4fa-eb4a-4fb2-9c7e-fba3ef58a580";

const COMPANY_INFO = {
  name: "Casa Corporation",
  tagline: "Valutazioni immobiliari professionali",
  address: "Via Davide Campari 205/207, Roma",
  phone: "",
  email: "",
  website: "www.holdingcasacorporation.it",
};

const PDF_LOGO_URL = "/logo-casa-corporation.png";
const DEFAULT_WEBSITE_URL = "https://www.holdingcasacorporation.it";

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
    form.zona || form.zona_immobile || form.quartiere || form.area || null;

  const microzona =
    form.microzona ||
    form.micro_zona ||
    form.sottozona ||
    form.localita ||
    null;

  const indirizzo =
    form.indirizzo_immobile || form.indirizzo || form.via || null;

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

function calculateSuggestedPrice(media: number) {
  if (!Number.isFinite(media) || media <= 0) return 0;
  const base = Math.floor(media / 10000) * 10000;
  return base + 9000;
}

function formatCurrency(value: number) {
  return `€ ${value.toLocaleString("it-IT")}`;
}

function formatCurrencyPlain(value: number) {
  return `€${value.toLocaleString("it-IT")}`;
}

function sanitizeFileNamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .slice(0, 40);
}

function getPdfFileName(
  preview: ValuationPreviewData | null,
  form: Record<string, any>,
  valuationName?: string
) {
  if (valuationName?.trim()) {
    return `${sanitizeFileNamePart(valuationName)}.pdf`;
  }
  const address =
    form.indirizzo_immobile || form.indirizzo || form.via || "valutazione";
  const suggested = preview?.pricing?.suggested
    ? String(preview.pricing.suggested)
    : "casa-corporation";

  return `valutazione-${sanitizeFileNamePart(address)}-${suggested}.pdf`;
}

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Impossibile leggere il logo"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Impossibile caricare il logo PDF"));
    img.src = url;
  });
}

function drawLuxuryBackground(pdf: jsPDF) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(9, 20, 52);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  pdf.setDrawColor(32, 48, 92);
  pdf.setLineWidth(0.2);

  for (let x = 0; x <= pageWidth; x += 8) {
    pdf.line(x, 0, x, pageHeight);
  }

  for (let y = 0; y <= pageHeight; y += 8) {
    pdf.line(0, y, pageWidth, y);
  }

  pdf.setDrawColor(189, 155, 96);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(7, 7, pageWidth - 14, pageHeight - 14, 4, 4);
}

function drawSectionTitle(pdf: jsPDF, title: string, y: number) {
  pdf.setTextColor(242, 231, 211);
  pdf.setFont("times", "bold");
  pdf.setFontSize(18);
  pdf.text(title, 105, y, { align: "center" });

  pdf.setDrawColor(189, 155, 96);
  pdf.setLineWidth(0.4);
  pdf.line(25, y + 3, 70, y + 3);
  pdf.line(140, y + 3, 185, y + 3);
}

function drawRoundedPanel(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: [number, number, number] = [14, 26, 60]
) {
  pdf.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  pdf.setDrawColor(189, 155, 96);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, w, h, 4, 4, "FD");
}

function addWrappedText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5.2
) {
  const lines = pdf.splitTextToSize(text, maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function normalizePhone(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

function buildPhoneSearchTerm(raw: string) {
  const normalized = normalizePhone(raw);
  if (!normalized) return "";
  return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ValuatorForm() {
  const searchParams = useSearchParams();
  const valuationId = searchParams.get("valuation_id");
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
  const [preview, setPreview] = useState<ValuationPreviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [valuationMode, setValuationMode] =
    useState<ValuationMode>("technical");
  const [freePrompt, setFreePrompt] = useState("");
  const [valuationName, setValuationName] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [generatedPdfTrackedUrl, setGeneratedPdfTrackedUrl] = useState("");
  const [generatedPdfStoragePath, setGeneratedPdfStoragePath] = useState("");
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  const [loadedValuationId, setLoadedValuationId] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadSavedValuation() {
      if (!valuationId) return;

      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("property_valuations")
        .select("id, contact_id, property_address, property_data")
        .eq("id", valuationId)
        .single();

      if (error || !data) {
        setErrorMessage("Valutazione salvata non trovata.");
        setLoading(false);
        return;
      }

      const propertyData = data.property_data as any;
      const savedPreview = propertyData?.preview;

      if (!savedPreview) {
        setErrorMessage("Preview valutazione non trovata nei dati salvati.");
        setLoading(false);
        return;
      }

      setPreview(savedPreview as ValuationPreviewData);
      setLinkedContactId(data.contact_id || null);
      setLoadedValuationId(data.id || null);
      setValuationMode("free_text");
      setValuationName(
        data.property_address ||
        propertyData?.extracted_title ||
        "Valutazione IA da annuncio"
      );

      setLoading(false);
    }

    loadSavedValuation();
  }, [valuationId]);

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

  function buildPreviewFromResult(apiResult: ValuationResult) {
    const zoneLabel =
      apiResult.zonaOmi ||
      form.zona ||
      form.zona_immobile ||
      form.quartiere ||
      form.area ||
      form.microzona ||
      form.localita ||
      "-";

    return {
      company: COMPANY_INFO,
      pricing: {
        min: apiResult.min,
        media: apiResult.media,
        max: apiResult.max,
        suggested: calculateSuggestedPrice(apiResult.media),
      },
      assignment: {
        duration: "",
        commission: "",
        tacitRenewal: "",
      },
      omi: {
        zone: zoneLabel,
        min: apiResult.omiMin || "",
        max: apiResult.omiMax || "",
      },
      ai: {
        comment: apiResult.commento,
      },
      toolsUsed: [
        "Esperienza ventennale dei ns agenti",
        "Chat GPT",
        "GEMINI",
        "OMI",
        "Compravenduto reale di zona",
        "Analisi professionale di mercato",
        "Immobili in vendita",
      ],
      benefits: {
        noExpenseRefund: true,
        reviewsLabel: "Leggi le recensioni",
        reviewsUrl: "https://recensioni.holdingcasacorporation.it/",
        advancedAiTools: true,
      },
    } satisfies ValuationPreviewData;
  }

  async function buildPdfDocument(
    previewData: ValuationPreviewData,
    links: PdfLinks
  ) {
    const pdf = new jsPDF("p", "mm", "a4");
    const logoDataUrl = await loadImageAsDataUrl(PDF_LOGO_URL);

    const gold: [number, number, number] = [205, 169, 106];
    const textLight: [number, number, number] = [245, 237, 221];
    const softText: [number, number, number] = [218, 207, 190];
    const panel: [number, number, number] = [14, 26, 60];

    drawLuxuryBackground(pdf);

    pdf.addImage(logoDataUrl, "PNG", 38, 14, 25, 17);

    pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
    pdf.setFont("times", "bold");
    pdf.setFontSize(20);
    pdf.text("Casa Corporation", 105, 22, { align: "center" });

    pdf.setTextColor(gold[0], gold[1], gold[2]);
    pdf.setFont("times", "normal");
    pdf.setFontSize(9.5);
    pdf.text("Valutazioni immobiliari professionali", 105, 28, {
      align: "center",
    });

    pdf.setTextColor(softText[0], softText[1], softText[2]);
    pdf.setFontSize(9);
    pdf.text("Via Davide Campari 205/207, Roma", 105, 34, {
      align: "center",
    });

    drawSectionTitle(pdf, "Valutazione Immobiliare", 48);

    // PREZZO CONSIGLIATO
    drawRoundedPanel(pdf, 28, 56, 154, 35, panel);

    pdf.setTextColor(gold[0], gold[1], gold[2]);
    pdf.setFont("times", "normal");
    pdf.setFontSize(13);
    pdf.text("Prezzo di Vendita Consigliato", 105, 68, {
      align: "center",
    });

    pdf.setFont("times", "bold");
    pdf.setFontSize(28);
    pdf.text(formatCurrencyPlain(previewData.pricing.suggested), 105, 82, {
      align: "center",
    });

    // CTA PROMO
    drawRoundedPanel(pdf, 28, 96, 154, 36, [17, 31, 69]);

    pdf.setTextColor(gold[0], gold[1], gold[2]);
    pdf.setFont("times", "bold");
    pdf.setFontSize(16);
    pdf.text("VUOI VENDERE A QUESTO PREZZO?", 105, 106, {
      align: "center",
    });

    pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.text("Approfitta della PROMO 0% lato venditore", 105, 114, {
      align: "center",
    });

    pdf.setFillColor(37, 99, 235);
    pdf.roundedRect(58, 119, 94, 10, 3, 3, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.text("SCRIVICI SU WHATSAPP", 105, 125.5, {
      align: "center",
    });

    pdf.link(58, 119, 94, 10, {
      url: links.whatsappPromoUrl,
    });

    // BOX PREZZI
    const priceBoxY = 139;
    const priceBoxW = 48;
    const priceBoxH = 22;
    const priceGap = 6;
    const startX = 27;

    const priceItems = [
      { label: "Prezzo minimo", value: previewData.pricing.min },
      { label: "Prezzo medio", value: previewData.pricing.media },
      { label: "Prezzo massimo", value: previewData.pricing.max },
    ];

    priceItems.forEach((item, index) => {
      const x = startX + index * (priceBoxW + priceGap);

      drawRoundedPanel(pdf, x, priceBoxY, priceBoxW, priceBoxH, [18, 30, 66]);

      pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
      pdf.setFont("times", "normal");
      pdf.setFontSize(10.5);
      pdf.text(item.label, x + priceBoxW / 2, priceBoxY + 8, {
        align: "center",
      });

      pdf.setTextColor(gold[0], gold[1], gold[2]);
      pdf.setFont("times", "bold");
      pdf.setFontSize(15);
      pdf.text(formatCurrencyPlain(item.value), x + priceBoxW / 2, priceBoxY + 17, {
        align: "center",
      });
    });

    // ANALISI IA
    drawRoundedPanel(pdf, 28, 166, 154, 40, panel);

    pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
    pdf.setFont("times", "bold");
    pdf.setFontSize(16);
    pdf.text("Analisi IA Casa Corporation", 105, 177, {
      align: "center",
    });

    pdf.setDrawColor(gold[0], gold[1], gold[2]);
    pdf.setLineWidth(0.3);
    pdf.line(45, 181, 165, 181);

    pdf.setTextColor(softText[0], softText[1], softText[2]);
    pdf.setFont("times", "normal");
    pdf.setFontSize(9.2);

    const commentLines = pdf.splitTextToSize(
      previewData.ai.comment || "-",
      134
    );

    pdf.text(commentLines.slice(0, 5), 38, 188);
    // MINI VANTAGGI
    drawRoundedPanel(pdf, 28, 211, 154, 27, [17, 31, 69]);

    pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
    pdf.setFont("times", "bold");
    pdf.setFontSize(11.5);
    pdf.text("Vantaggi di vendere con Casa Corporation", 105, 219, {
      align: "center",
    });

    pdf.setTextColor(softText[0], softText[1], softText[2]);
    pdf.setFont("times", "normal");
    pdf.setFontSize(6.8);
    pdf.setFontSize(7.2);

    pdf.text("Rinuncia rimborso spese", 105, 224, {
      align: "center",
    });

    pdf.text("Recensioni verificate", 105, 229, {
      align: "center",
    });

    pdf.text("Risorse IA all'avanguardia", 105, 234, {
      align: "center",
    });

    // CTA FINALI
    const cardY = 242;
    const cardW = 36;
    const cardH = 32;
    const cardGap = 4;
    const cardStartX = 27;

    const ctaCards = [
      {
        title: "LEGGI LE\nRECENSIONI",
        text: "Scopri cosa dicono\ndi noi i clienti",
        button: "CLICCA QUI",
        url: links.reviewsUrl,
      },
      {
        title: "VISUALIZZA\nINCARICO",
        text: "Guarda il nostro\nmodello operativo",
        button: "CLICCA QUI",
        url: links.incaricoPdfUrl,
      },
      {
        title: "CONTATTA\nL'AGENTE",
        text: "Parla direttamente\ncon un consulente",
        button: "SCRIVICI",
        url: links.whatsappAgentUrl,
      },
      {
        title: "VISITA IL\nNOSTRO SITO",
        text: "Scopri tutti i servizi\ndi Casa Corporation",
        button: "CLICCA QUI",
        url: links.websiteUrl,
      },
    ];

    ctaCards.forEach((card, index) => {
      const x = cardStartX + index * (cardW + cardGap);

      drawRoundedPanel(pdf, x, cardY, cardW, cardH, [16, 28, 64]);

      pdf.setTextColor(gold[0], gold[1], gold[2]);
      pdf.setFont("times", "bold");
      pdf.setFontSize(8.8);
      pdf.text(card.title.split("\n"), x + cardW / 2, cardY + 8, {
        align: "center",
      });

      pdf.setTextColor(softText[0], softText[1], softText[2]);
      pdf.setFont("times", "normal");
      pdf.setFontSize(6.8);
      pdf.text(card.text.split("\n"), x + cardW / 2, cardY + 19, {
        align: "center",
      });

      pdf.setFillColor(gold[0], gold[1], gold[2]);
      pdf.roundedRect(x + 7, cardY + 25, cardW - 14, 5.5, 2, 2, "F");

      pdf.setTextColor(9, 20, 52);
      pdf.setFont("times", "bold");
      pdf.setFontSize(7);
      pdf.text(card.button, x + cardW / 2, cardY + 28.8, {
        align: "center",
      });

      pdf.link(x, cardY, cardW, cardH, {
        url: card.url,
      });
    });

    // FOOTER
    pdf.setDrawColor(gold[0], gold[1], gold[2]);
    pdf.setLineWidth(0.4);
    pdf.line(35, 281, 175, 281);

    pdf.setTextColor(softText[0], softText[1], softText[2]);
    pdf.setFont("times", "normal");
    pdf.setFontSize(8.5);
    pdf.text("Via Davide Campari 205/207, Roma", 105, 285, {
      align: "center",
    });

    pdf.text("www.holdingcasacorporation.it", 105, 289, {
      align: "center",
    });

    pdf.link(70, 284, 70, 6, {
      url: "https://www.holdingcasacorporation.it",
    });

    return pdf;
  }

  async function findCurrentUserAndWhatsapp() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Utente non autenticato.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, whatsapp_number")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profilo utente non trovato.");
    }

    const fallbackWhatsappNumber = "3891641958";

    return {
      userId: user.id,
      whatsappNumber: String(profile.whatsapp_number || fallbackWhatsappNumber),
    };
  }

  async function findContactIdForPdf() {
    const rawPhone = String(form.recapito_telefonico || "").trim();
    const normalizedPhone = normalizePhone(rawPhone);

    if (!normalizedPhone) {
      throw new Error("Nessun recapito telefonico disponibile.");
    }

    const phoneSearchTerm = buildPhoneSearchTerm(rawPhone);

    const { data, error } = await supabase
      .from("contacts")
      .select("id, phone_primary, phone_secondary")
      .or(
        `phone_primary.ilike.%${phoneSearchTerm}%,phone_secondary.ilike.%${phoneSearchTerm}%`
      )
      .limit(20);

    if (error) {
      throw new Error("Errore nella ricerca del contatto CRM.");
    }

    const matched = (data || []).find((contact) => {
      const p1 = normalizePhone(String(contact.phone_primary || ""));
      const p2 = normalizePhone(String(contact.phone_secondary || ""));
      return p1 === normalizedPhone || p2 === normalizedPhone;
    });

    if (!matched?.id) {
      throw new Error("Contatto CRM non trovato.");
    }

    return String(matched.id);
  }

  async function handleCreatePdf() {
    if (!preview) {
      setErrorMessage("Genera prima una valutazione.");
      return;
    }
    if (!valuationName.trim()) {
      setErrorMessage("Inserisci il nome della valutazione prima di creare il PDF.");
      return;
    }

    try {
      setPdfLoading(true);
      setErrorMessage("");
      setGeneratedPdfTrackedUrl("");
      setGeneratedPdfStoragePath("");

      const runtimeWebsiteUrl = DEFAULT_WEBSITE_URL;

      const { userId, whatsappNumber } = await findCurrentUserAndWhatsapp();
      let contactId: string | null = linkedContactId;

      if (!contactId) {
        try {
          contactId = await findContactIdForPdf();
        } catch {
          contactId = null;
        }
      }

      const prepareFormData = new FormData();
      prepareFormData.append("mode", "prepare");
      prepareFormData.append("organization_id", ORGANIZATION_ID);
      prepareFormData.append("contact_id", contactId ?? "");
      prepareFormData.append("agent_id", userId);
      prepareFormData.append("source", "valuator");
      prepareFormData.append("valuation_name", valuationName.trim());
      prepareFormData.append(
        "reviews_url",
        "https://recensioni.holdingcasacorporation.it/"
      );
      prepareFormData.append("website_url", runtimeWebsiteUrl);
      prepareFormData.append("whatsapp_number", whatsappNumber);

      const prepareResponse = await fetch("/api/valuator/upload-pdf", {
        method: "POST",
        body: prepareFormData,
      });

      const prepareData =
        (await prepareResponse.json()) as PreparedUploadResponse & {
          error?: string;
        };

      if (!prepareResponse.ok || !prepareData?.success) {
        throw new Error(
          prepareData?.error || "Errore nella preparazione link PDF."
        );
      }

      const whatsappPromoMessage = encodeURIComponent(
        "Sono interessato alla PROMO 0% lato venditore"
      );

      const rawWhatsappNumber = whatsappNumber.replace(/[^\d]/g, "");

      const promoWhatsappUrl = `https://wa.me/${rawWhatsappNumber}?text=${whatsappPromoMessage}`;

      const links: PdfLinks = {
        reviewsUrl: prepareData.reviews.tracked_url,
        whatsappAgentUrl: prepareData.whatsapp.tracked_url,
        whatsappPromoUrl: promoWhatsappUrl,
        incaricoPdfUrl:
          prepareData.incarico?.tracked_url ||
          "https://holdingcasacorporation.it",
        websiteUrl: prepareData.website?.tracked_url || runtimeWebsiteUrl,
      };

      const pdf = await buildPdfDocument(preview, links);
      const pdfBlob = pdf.output("blob");
      const pdfFileName = getPdfFileName(
        preview,
        form,
        valuationName
      );
      const pdfFile = new File([pdfBlob], pdfFileName, {
        type: "application/pdf",
      });

      const finalizeFormData = new FormData();
      finalizeFormData.append("mode", "finalize");
      finalizeFormData.append("organization_id", ORGANIZATION_ID);
      finalizeFormData.append("contact_id", contactId ?? "");
      finalizeFormData.append("agent_id", userId);
      finalizeFormData.append("valuation_name", valuationName.trim());
      finalizeFormData.append(
        "valuation_pdf_token",
        prepareData.valuation_pdf.token
      );
      finalizeFormData.append("website_url", runtimeWebsiteUrl);
      finalizeFormData.append("file", pdfFile);

      const finalizeResponse = await fetch("/api/valuator/upload-pdf", {
        method: "POST",
        body: finalizeFormData,
      });

      const finalizeData =
        (await finalizeResponse.json()) as FinalizeUploadResponse & {
          error?: string;
        };

      if (!finalizeResponse.ok || !finalizeData?.success) {
        throw new Error(
          finalizeData?.error || "Errore nel caricamento finale PDF."
        );
      }

      downloadBlob(pdfBlob, pdfFileName);
      setGeneratedPdfTrackedUrl(finalizeData.tracked_url);
      setGeneratedPdfStoragePath(finalizeData.storage_path);
      if (loadedValuationId) {
        await supabase
          .from("property_valuations")
          .update({
            status: "pdf_created",
            property_data: {
              ...(form || {}),
              preview,
              pdf: {
                tracked_url: finalizeData.tracked_url,
                storage_path: finalizeData.storage_path,
              },
            },
          })
          .eq("id", loadedValuationId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Errore nella creazione del PDF"
      );
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleTechnicalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setPreview(null);
    setGeneratedPdfTrackedUrl("");
    setGeneratedPdfStoragePath("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: saveError } = await supabase
        .from("property_valuations")
        .insert({
          organization_id: ORGANIZATION_ID,
          created_by: user?.id ?? null,
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
        throw new Error(
          data?.error || "Errore nella generazione della valutazione"
        );
      }

      if (
        typeof data?.min !== "number" ||
        typeof data?.max !== "number" ||
        typeof data?.media !== "number" ||
        typeof data?.commento !== "string"
      ) {
        throw new Error("Risposta API non valida");
      }

      setPreview(buildPreviewFromResult(data));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Errore imprevisto"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleFreeTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setPreview(null);
    setGeneratedPdfTrackedUrl("");
    setGeneratedPdfStoragePath("");

    try {
      const trimmedPrompt = freePrompt.trim();

      if (!trimmedPrompt) {
        throw new Error("Inserisci un testo prima di generare la valutazione");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: saveError } = await supabase
        .from("property_valuations")
        .insert({
          organization_id: ORGANIZATION_ID,
          created_by: user?.id ?? null,
          contact_name: null,
          phone: null,
          email: null,
          property_address: null,
          property_data: {
            mode: "free_text",
            prompt: trimmedPrompt,
          },
          status: "draft",
        });

      if (saveError) {
        throw new Error("Errore salvataggio su Supabase");
      }

      const response = await fetch("/api/valuator/chatgpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "free_text",
          prompt: trimmedPrompt,
          organization_id: ORGANIZATION_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Errore nella generazione della valutazione"
        );
      }

      if (
        typeof data?.min !== "number" ||
        typeof data?.max !== "number" ||
        typeof data?.media !== "number" ||
        typeof data?.commento !== "string"
      ) {
        throw new Error("Risposta API non valida");
      }

      setPreview(buildPreviewFromResult(data));
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
    <div style={{ display: "grid", gap: "24px", maxWidth: "1100px" }}>
      <div
        style={{
          display: "grid",
          gap: "12px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Scegli modalità valutazione
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setValuationMode("technical");
              setErrorMessage("");
              setPreview(null);
              setGeneratedPdfTrackedUrl("");
              setGeneratedPdfStoragePath("");
            }}
            style={{
              padding: "16px",
              borderRadius: "14px",
              border:
                valuationMode === "technical"
                  ? "2px solid #111"
                  : "1px solid #d1d5db",
              background: valuationMode === "technical" ? "#f8fafc" : "#fff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "16px",
                marginBottom: "6px",
              }}
            >
              Valutazione con dati tecnici
            </div>
            <div
              style={{ color: "#6b7280", fontSize: "14px", lineHeight: 1.5 }}
            >
              Usa il form strutturato che hai già costruito.
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setValuationMode("free_text");
              setErrorMessage("");
              setPreview(null);
              setGeneratedPdfTrackedUrl("");
              setGeneratedPdfStoragePath("");
            }}
            style={{
              padding: "16px",
              borderRadius: "14px",
              border:
                valuationMode === "free_text"
                  ? "2px solid #111"
                  : "1px solid #d1d5db",
              background: valuationMode === "free_text" ? "#f8fafc" : "#fff",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "16px",
                marginBottom: "6px",
              }}
            >
              Valutazione con testo libero
            </div>
            <div
              style={{ color: "#6b7280", fontSize: "14px", lineHeight: 1.5 }}
            >
              Scrivi liberamente la descrizione dell’immobile e genera la stessa
              preview finale.
            </div>
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "14px",
          background: "#fff",
          padding: "16px",
          display: "grid",
          gap: "8px",
        }}
      >
        <label style={{ fontWeight: 800 }}>
          Nome valutazione *
        </label>

        <input
          type="text"
          value={valuationName}
          onChange={(e) => setValuationName(e.target.value)}
          placeholder="Es. Via Amatore Sciesa 86 - Marino"
          required
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid #d0d5dd",
          }}
        />

        <div style={{ fontSize: "13px", color: "#6b7280" }}>
          Questo nome sarà usato per il PDF e per riconoscere la valutazione nelle KPI.
        </div>
      </div>

      {valuationMode === "technical" ? (
        <form
          onSubmit={handleTechnicalSubmit}
          style={{ display: "grid", gap: "16px" }}
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
                  <div
                    style={{ padding: "16px", display: "grid", gap: "14px" }}
                  >
                    {sectionFields.map((field) => (
                      <div
                        key={field.id}
                        style={{ display: "grid", gap: "6px" }}
                      >
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
      ) : (
        <form
          onSubmit={handleFreeTextSubmit}
          style={{ display: "grid", gap: "16px" }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "14px",
              background: "#fff",
              padding: "16px",
              display: "grid",
              gap: "12px",
            }}
          >
            <label style={{ fontWeight: 700, fontSize: "16px" }}>
              Descrizione libera immobile
            </label>

            <textarea
              value={freePrompt}
              onChange={(e) => setFreePrompt(e.target.value)}
              rows={12}
              placeholder="Esempio: Appartamento in Roma zona Tuscolana, 95 mq, terzo piano senza ascensore, da ristrutturare, doppia esposizione, balcone, luminoso, richiesta 279.000 euro..."
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #d0d5dd",
                resize: "vertical",
              }}
            />

            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              Qui puoi scrivere liberamente il testo. La risposta andrà
              comunque a popolare la stessa preview finale della valutazione
              tecnica.
            </div>
          </div>

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
            {loading
              ? "Generazione in corso..."
              : "Genera valutazione da testo libero"}
          </button>
        </form>
      )}

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

      {preview && (
        <div style={{ display: "grid", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              Preview valutazione
            </h3>

            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              X = modificabile • XX = manuale
            </div>
          </div>

          <ValuationPreview data={preview} onChange={setPreview} />

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleCreatePdf}
              disabled={pdfLoading}
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                border: "none",
                background: pdfLoading ? "#60a5fa" : "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: pdfLoading ? "not-allowed" : "pointer",
                opacity: pdfLoading ? 0.85 : 1,
              }}
            >
              {pdfLoading ? "Creazione PDF..." : "Crea PDF tracciato"}
            </button>
          </div>

          {(generatedPdfTrackedUrl || generatedPdfStoragePath) && (
            <div
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: "16px",
                padding: "16px",
                background: "#eff6ff",
                color: "#1e3a8a",
                lineHeight: 1.6,
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ fontWeight: 800 }}>
                PDF tracciato creato correttamente
              </div>

              {generatedPdfTrackedUrl && (
                <div>
                  <strong>Link PDF online:</strong>{" "}
                  <a
                    href={generatedPdfTrackedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {generatedPdfTrackedUrl}
                  </a>
                </div>
              )}

              {generatedPdfStoragePath && (
                <div>
                  <strong>Storage path:</strong> {generatedPdfStoragePath}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: "16px",
              padding: "16px",
              background: "#fff",
              color: "#475569",
              lineHeight: 1.6,
            }}
          >
            <strong>Stato attuale:</strong> il bottone crea il PDF locale, lo
            carica su Supabase Storage, genera il link online tokenizzato e
            collega recensioni, WhatsApp agente e incarico PDF con tracking.
          </div>

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
                background: "#fff",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Prezzo minimo
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800 }}>
                {formatCurrency(preview.pricing.min)}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
                background: "#fff",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Prezzo medio
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800 }}>
                {formatCurrency(preview.pricing.media)}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
                background: "#fff",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Prezzo massimo
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800 }}>
                {formatCurrency(preview.pricing.max)}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
                background: "#fff",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Prezzo consigliato
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800 }}>
                {formatCurrency(preview.pricing.suggested)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}