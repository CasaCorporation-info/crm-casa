import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ORGANIZATION_ID = "1573b4fa-eb4a-4fb2-9c7e-fba3ef58a580";

function calculateSuggestedPrice(media: number) {
  if (!Number.isFinite(media) || media <= 0) return 0;
  const base = Math.floor(media / 10000) * 10000;
  return base + 9000;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contactId = clean(body.contact_id);
    const userId = clean(body.user_id);

    if (!contactId) {
      return NextResponse.json({ error: "contact_id mancante." }, { status: 400 });
    }

    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: "Contatto non trovato." }, { status: 404 });
    }

    const { data: aiImport, error: aiError } = await supabaseAdmin
      .from("contact_ai_imports")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aiError) {
      return NextResponse.json(
        { error: `Errore lettura dati IA: ${aiError.message}` },
        { status: 500 }
      );
    }

    if (!aiImport) {
      return NextResponse.json(
        { error: "Nessun Box IA annuncio collegato al contatto." },
        { status: 400 }
      );
    }

    const aiPayload = {
      mode: "contact_ai_import",
      organization_id: contact.organization_id || ORGANIZATION_ID,
      contact_id: contactId,
      contesto_localizzazione: {
        comune: contact.city || null,
        zona: aiImport.extracted_address || null,
        microzona: null,
        indirizzo: aiImport.extracted_address || null,
        civico: null,
      },
      dati_immobiliari: {
        "Dati annuncio importato": {
          Portale: aiImport.source_portal,
          Link: aiImport.listing_url,
          Prezzo: aiImport.extracted_price,
          Indirizzo: aiImport.extracted_address,
          Titolo: aiImport.extracted_title,
          Descrizione: aiImport.extracted_description,
          Telefono: aiImport.extracted_phone,
          Nome: aiImport.extracted_name,
        },
      },
    };

    const openAiResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/valuator/chatgpt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiPayload),
      }
    );

    const valuation = await openAiResponse.json();

    if (!openAiResponse.ok) {
      return NextResponse.json(
        { error: valuation?.error || "Errore generazione valutazione IA." },
        { status: 500 }
      );
    }

    const suggested = calculateSuggestedPrice(valuation.media);

    const valuationPayload = {
      company: {
        name: "Casa Corporation",
        tagline: "Valutazioni immobiliari professionali",
        address: "Via Davide Campari 205/207, Roma",
        phone: "",
        email: "",
        website: "www.holdingcasacorporation.it",
      },
      pricing: {
        min: valuation.min,
        media: valuation.media,
        max: valuation.max,
        suggested,
      },
      assignment: {
        duration: "",
        commission: "",
        tacitRenewal: "",
      },
      omi: {
        zone:
          valuation.zonaOmi ||
          aiImport.extracted_address ||
          contact.city ||
          "-",
        min: valuation.omiMin || "",
        max: valuation.omiMax || "",
      },
      ai: {
        comment: valuation.commento,
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
    };

    const valuationName =
      aiImport.extracted_address ||
      aiImport.extracted_title ||
      contact.display_name ||
      "Valutazione IA da annuncio";

    const { data: savedValuation, error: saveError } = await supabaseAdmin
      .from("property_valuations")
      .insert({
        organization_id: contact.organization_id || ORGANIZATION_ID,
        created_by: userId || null,
        contact_id: contactId,
        contact_name:
          contact.display_name ||
          `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
          aiImport.extracted_name ||
          null,
        phone: contact.phone_primary || aiImport.extracted_phone || null,
        email: contact.email_primary || null,
        property_address: aiImport.extracted_address || null,
        property_data: {
          source: "contact_ai_import",
          ai_import_id: aiImport.id,
          listing_url: aiImport.listing_url,
          extracted_price: aiImport.extracted_price,
          extracted_title: aiImport.extracted_title,
          extracted_description: aiImport.extracted_description,
          ai_payload: aiPayload,
          preview: valuationPayload,
        },
        status: "draft",
      })
      .select("id")
      .single();

    if (saveError) {
      return NextResponse.json(
        { error: `Errore salvataggio valutazione: ${saveError.message}` },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("contact_activities").insert({
      organization_id: contact.organization_id || ORGANIZATION_ID,
      contact_id: contactId,
      created_by: userId || null,
      activity_type: "valuation",
      channel: null,
      note: `Generata valutazione IA da annuncio: ${valuationName}`,
      metadata: {
        source: "contact_detail_generate_ai_valuation",
        valuation_id: savedValuation?.id,
        ai_import_id: aiImport.id,
        listing_url: aiImport.listing_url,
        suggested_price: suggested,
      },
    });

    return NextResponse.json({
      success: true,
      valuation_id: savedValuation?.id,
      valuation_name: valuationName,
      preview: valuationPayload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Errore imprevisto.",
      },
      { status: 500 }
    );
  }
}