import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STORAGE_BUCKET = "contact-ai-imports";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5.4";

type ExtractedListing = {
  portal_source: string | null;
  listing_url: string | null;
  phone: string | null;
  name: string | null;
  price: string | null;
  address: string | null;
  title: string | null;
  description: string | null;
  city: string | null;
  suggested_first_message: string | null;
};

type ExistingContactRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  source: string | null;
  source_detail: string | null;
  notes: string | null;
};

function getBearerToken(req: Request) {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");

  if (!digits || digits.length < 7) return null;

  return hasPlus ? `+${digits}` : digits;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeListingUrl(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^[\w.-]+\.[a-z]{2,}\/?/i.test(text)) {
    return `https://${text}`;
  }

  return null;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  const direct = safeJsonParse<ExtractedListing>(trimmed);
  if (direct) return direct;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return safeJsonParse<ExtractedListing>(trimmed.slice(start, end + 1));
}

function buildDisplayName(data: {
  extractedName: string | null;
  extractedPrice: string | null;
  extractedAddress: string | null;
}) {
  if (data.extractedName) return data.extractedName;

  const parts = [
    "PRIVATO",
    data.extractedPrice || null,
    data.extractedAddress || null,
  ].filter(Boolean);

  return parts.join(" - ") || "PRIVATO";
}

function buildSourceLabel(portalSource: string | null) {
  const source = portalSource?.trim() || "Portale sconosciuto";
  return `Privato - ${source}`;
}

function buildContactNotes(input: {
  portalSource: string | null;
  listingUrl: string | null;
  price: string | null;
  address: string | null;
  title: string | null;
  description: string | null;
}) {
  const rows = [
    "CONTATTO CREATO DA SCREENSHOT ANNUNCIO VIA IA",
    "",
    `Portale: ${input.portalSource || "-"}`,
    `Prezzo: ${input.price || "-"}`,
    `Indirizzo: ${input.address || "-"}`,
    `Titolo annuncio: ${input.title || "-"}`,
    `Link annuncio: ${input.listingUrl || "-"}`,
    "",
    "Descrizione:",
    input.description || "-",
  ];

  return rows.join("\n");
}

function getExistingContactName(contact: ExistingContactRow) {
  const displayName = normalizeText(contact.display_name);
  if (displayName) return displayName;

  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  if (fullName) return fullName;

  return "Contatto esistente";
}

async function findExistingContact(params: {
  organizationId: string;
  phone: string | null;
  listingUrl: string | null;
}) {
  if (params.phone) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select(
        "id, display_name, first_name, last_name, phone_primary, source, source_detail, notes"
      )
      .eq("organization_id", params.organizationId)
      .eq("phone_primary", params.phone)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        reason: "phone" as const,
        contact: data as ExistingContactRow,
      };
    }
  }

  if (params.listingUrl) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select(
        "id, display_name, first_name, last_name, phone_primary, source, source_detail, notes"
      )
      .eq("organization_id", params.organizationId)
      .eq("source_detail", params.listingUrl)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        reason: "listing_url" as const,
        contact: data as ExistingContactRow,
      };
    }
  }

  return null;
}

async function callOpenAIForListingExtraction(
  base64Image: string,
  mimeType: string
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY mancante.");
  }

  const prompt = `
Leggi questo screenshot di un annuncio immobiliare e restituisci SOLO un JSON valido.
Ignora banner pubblicitari, pulsanti promozionali, navigazione del sito, badge, annunci sponsorizzati e qualsiasi testo non utile.

Obiettivo:
estrarre i dati utili per creare un lead privato in un CRM immobiliare.

Regole:
- Se il numero di telefono non è visibile, usa null.
- Se il nome del privato non è visibile, usa null.
- Se il portale è riconoscibile, valorizza portal_source con il nome del portale.
- listing_url va valorizzato SOLO se l'URL completo è chiaramente leggibile nello screenshot.
- Se il link è parziale, ambiguo o non completo, usa null.
- Mantieni prezzo e indirizzo come testo leggibile, senza inventare.
- suggested_first_message deve essere breve, professionale, diretto, in italiano, pensato per un primo contatto WhatsApp o telefonico con un privato che vende o affitta.
- Non inventare dati non presenti.
- Se un campo non è leggibile, usa null.

Schema JSON richiesto:
{
  "portal_source": string | null,
  "listing_url": string | null,
  "phone": string | null,
  "name": string | null,
  "price": string | null,
  "address": string | null,
  "title": string | null,
  "description": string | null,
  "city": string | null,
  "suggested_first_message": string | null
}
`.trim();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Sei un estrattore dati per annunci immobiliari. Devi restituire solo JSON valido.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.json();

  if (!response.ok) {
    throw new Error(raw?.error?.message || "Errore OpenAI.");
  }

  const content = raw?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Risposta OpenAI vuota o non valida.");
  }

  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error("Impossibile parsare il JSON restituito da OpenAI.");
  }

  return {
    parsed,
    raw,
  };
}

export async function POST(req: Request) {
  let importId: string | null = null;
  let imagePath: string | null = null;

  try {
    const token = getBearerToken(req);

    if (!token) {
      return NextResponse.json(
        { error: "Missing bearer token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: me, error: meError } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id, role, full_name")
      .eq("id", user.id)
      .single();

    if (meError || !me?.organization_id) {
      return NextResponse.json(
        { error: "Profilo utente non trovato o organization_id mancante." },
        { status: 400 }
      );
    }

    const myRole = String(me.role || "").trim().toLowerCase();

    if (!["admin", "manager", "agent"].includes(myRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const image = formData.get("image");
    const portalSourceInput = normalizeText(formData.get("portal_source"));
    const listingUrlInput = normalizeText(formData.get("listing_url"));

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Immagine mancante." },
        { status: 400 }
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Il file deve essere un'immagine." },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      return NextResponse.json(
        { error: "Immagine vuota o non valida." },
        { status: 400 }
      );
    }

    const safeName = sanitizeFileName(image.name || "upload-image");
    imagePath = `${me.organization_id}/${user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(imagePath, buffer, {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload immagine fallito: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: importRow, error: importInsertError } = await supabaseAdmin
      .from("contact_ai_imports")
      .insert({
        organization_id: me.organization_id,
        created_by: user.id,
        source_portal: portalSourceInput,
        source_label: portalSourceInput
          ? buildSourceLabel(portalSourceInput)
          : null,
        image_path: imagePath,
        image_url: null,
        listing_url: normalizeListingUrl(listingUrlInput),
        import_status: "pending",
      })
      .select("id")
      .single();

    if (importInsertError || !importRow?.id) {
      return NextResponse.json(
        {
          error: importInsertError?.message || "Errore creazione import.",
        },
        { status: 500 }
      );
    }

    importId = importRow.id;

    const base64Image = buffer.toString("base64");

    const { parsed, raw } = await callOpenAIForListingExtraction(
      base64Image,
      image.type
    );

    const extractedPhone = normalizePhone(parsed.phone);
    const extractedName = normalizeText(parsed.name);
    const extractedPrice = normalizeText(parsed.price);
    const extractedAddress = normalizeText(parsed.address);
    const extractedTitle = normalizeText(parsed.title);
    const extractedDescription = normalizeText(parsed.description);
    const extractedCity = normalizeText(parsed.city);
    const suggestedFirstMessage = normalizeText(
      parsed.suggested_first_message
    );

    const portalSource =
      normalizeText(parsed.portal_source) ||
      portalSourceInput ||
      "Portale sconosciuto";

    const listingUrl =
      normalizeListingUrl(listingUrlInput) ||
      normalizeListingUrl(parsed.listing_url);

    const existingContactMatch = await findExistingContact({
      organizationId: me.organization_id,
      phone: extractedPhone,
      listingUrl,
    });

    if (existingContactMatch) {
      await supabaseAdmin
        .from("contact_ai_imports")
        .update({
          source_portal: portalSource,
          source_label: buildSourceLabel(portalSource),
          listing_url: listingUrl,
          extracted_phone: extractedPhone,
          extracted_name: extractedName,
          extracted_price: extractedPrice,
          extracted_address: extractedAddress,
          extracted_title: extractedTitle,
          extracted_description: extractedDescription,
          suggested_first_message: suggestedFirstMessage,
          raw_ai_response: raw,
          import_status: "failed",
          error_message:
            existingContactMatch.reason === "phone"
              ? "Contatto già presente con lo stesso numero di telefono."
              : "Contatto già presente con lo stesso link annuncio.",
          contact_id: existingContactMatch.contact.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId);

      return NextResponse.json(
        {
          error:
            existingContactMatch.reason === "phone"
              ? "È già presente un contatto con questo numero di telefono."
              : "È già presente un contatto con questo link annuncio.",
          duplicate: true,
          duplicate_reason: existingContactMatch.reason,
          contact: {
            id: existingContactMatch.contact.id,
            display_name: getExistingContactName(existingContactMatch.contact),
            phone_primary: existingContactMatch.contact.phone_primary,
            source: existingContactMatch.contact.source,
            source_detail: existingContactMatch.contact.source_detail,
            notes: existingContactMatch.contact.notes,
          },
        },
        { status: 409 }
      );
    }

    const displayName = buildDisplayName({
      extractedName,
      extractedPrice,
      extractedAddress,
    });

    const contactNotes = buildContactNotes({
      portalSource,
      listingUrl,
      price: extractedPrice,
      address: extractedAddress,
      title: extractedTitle,
      description: extractedDescription,
    });

    const contactMetadata = {
      source: "contact_ai_import",
      import_id: importId,
      portal_source: portalSource,
      listing_url: listingUrl,
      extracted_price: extractedPrice,
      extracted_address: extractedAddress,
      extracted_title: extractedTitle,
      image_path: imagePath,
    };

    const { data: createdContact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .insert({
        organization_id: me.organization_id,
        created_by: user.id,
        updated_by: user.id,
        display_name: displayName,
        first_name: extractedName,
        phone_primary: extractedPhone,
        city: extractedCity,
        contact_type: "cliente_generico",
        lead_status: "nuovo",
        source: buildSourceLabel(portalSource),
        source_detail: listingUrl,
        notes: contactNotes,
        metadata: contactMetadata,
        assigned_agent_id: myRole === "agent" ? user.id : null,
        assigned_to: myRole === "agent" ? user.id : null,
      })
      .select("id, display_name, phone_primary, source, notes")
      .single();

    if (contactError || !createdContact?.id) {
      await supabaseAdmin
        .from("contact_ai_imports")
        .update({
          source_portal: portalSource,
          source_label: buildSourceLabel(portalSource),
          listing_url: listingUrl,
          extracted_phone: extractedPhone,
          extracted_name: extractedName,
          extracted_price: extractedPrice,
          extracted_address: extractedAddress,
          extracted_title: extractedTitle,
          extracted_description: extractedDescription,
          suggested_first_message: suggestedFirstMessage,
          raw_ai_response: raw,
          import_status: "failed",
          error_message:
            contactError?.message || "Errore creazione contatto.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId);

      return NextResponse.json(
        {
          error: contactError?.message || "Errore creazione contatto.",
        },
        { status: 500 }
      );
    }

    const { error: activityError } = await supabaseAdmin
      .from("contact_activities")
      .insert({
        organization_id: me.organization_id,
        contact_id: createdContact.id,
        created_by: user.id,
        activity_type: "system",
        channel: null,
        template_id: null,
        note: "Contatto creato da screenshot annuncio via IA.",
        metadata: {
          source: "contact_ai_import",
          import_id: importId,
          portal_source: portalSource,
          listing_url: listingUrl,
          extracted_phone: extractedPhone,
          extracted_name: extractedName,
          extracted_price: extractedPrice,
          extracted_address: extractedAddress,
          extracted_title: extractedTitle,
          image_path: imagePath,
          suggested_first_message: suggestedFirstMessage,
        },
      });

    if (activityError) {
      await supabaseAdmin
        .from("contact_ai_imports")
        .update({
          contact_id: createdContact.id,
          source_portal: portalSource,
          source_label: buildSourceLabel(portalSource),
          listing_url: listingUrl,
          extracted_phone: extractedPhone,
          extracted_name: extractedName,
          extracted_price: extractedPrice,
          extracted_address: extractedAddress,
          extracted_title: extractedTitle,
          extracted_description: extractedDescription,
          suggested_first_message: suggestedFirstMessage,
          raw_ai_response: raw,
          import_status: "failed",
          error_message: `Contatto creato, ma attività non salvata: ${activityError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId);

      return NextResponse.json(
        {
          error: `Contatto creato, ma attività non salvata: ${activityError.message}`,
          contact_id: createdContact.id,
        },
        { status: 500 }
      );
    }

    const { error: importUpdateError } = await supabaseAdmin
      .from("contact_ai_imports")
      .update({
        contact_id: createdContact.id,
        source_portal: portalSource,
        source_label: buildSourceLabel(portalSource),
        image_path: imagePath,
        image_url: null,
        listing_url: listingUrl,
        extracted_phone: extractedPhone,
        extracted_name: extractedName,
        extracted_price: extractedPrice,
        extracted_address: extractedAddress,
        extracted_title: extractedTitle,
        extracted_description: extractedDescription,
        suggested_first_message: suggestedFirstMessage,
        raw_ai_response: raw,
        import_status: "processed",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId);

    if (importUpdateError) {
      return NextResponse.json(
        {
          error: `Contatto creato, ma import non aggiornato: ${importUpdateError.message}`,
          contact_id: createdContact.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      import_id: importId,
      contact: {
        id: createdContact.id,
        display_name: createdContact.display_name,
        phone_primary: createdContact.phone_primary,
        source: createdContact.source,
        notes: createdContact.notes,
      },
      ai: {
        portal_source: portalSource,
        listing_url: listingUrl,
        extracted_phone: extractedPhone,
        extracted_name: extractedName,
        extracted_price: extractedPrice,
        extracted_address: extractedAddress,
        extracted_title: extractedTitle,
        extracted_description: extractedDescription,
        suggested_first_message: suggestedFirstMessage,
      },
    });
  } catch (error) {
    if (importId) {
      await supabaseAdmin
        .from("contact_ai_imports")
        .update({
          import_status: "failed",
          error_message:
            error instanceof Error
              ? error.message
              : "Errore generico import IA.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}