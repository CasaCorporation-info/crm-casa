import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALUATION_PDF_BUCKET = "valuation-pdfs";
const VALUATION_INCARICHI_BUCKET = "valuation-incarichi";
const FALLBACK_REVIEWS_URL = "https://recensioni.holdingcasacorporation.it/";
const FALLBACK_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://crm-casa.vercel.app";

function buildToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

function buildStoragePath({
  organizationId,
  contactId,
}: {
  organizationId: string;
  contactId: string | null;
}) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = now.getTime();
  const contactSegment = contactId || "senza-contatto";

  return `${organizationId}/${year}/${month}/${contactSegment}/valutazione-${timestamp}.pdf`;
}

function buildPublicValuationUrl(baseUrl: string, token: string) {
  return `${baseUrl}/v/${token}`;
}

function buildTrackedLinkUrl(baseUrl: string, token: string) {
  return `${baseUrl}/vl/${token}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const mode = String(formData.get("mode") || "prepare").trim();
    const organizationId = String(formData.get("organization_id") || "").trim();
    const contactId = String(formData.get("contact_id") || "").trim();
    const agentIdRaw = String(formData.get("agent_id") || "").trim();
    const source = String(formData.get("source") || "valuator").trim();
    const valuationName = String(formData.get("valuation_name") || "").trim();

    const reviewsUrl =
      String(formData.get("reviews_url") || FALLBACK_REVIEWS_URL).trim() ||
      FALLBACK_REVIEWS_URL;

    const websiteUrl =
      String(formData.get("website_url") || FALLBACK_SITE_URL).trim() ||
      FALLBACK_SITE_URL;

    const whatsappNumberRaw = String(
      formData.get("whatsapp_number") || ""
    ).trim();

    if (!organizationId) {
      return NextResponse.json(
        { error: "organization_id mancante." },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_VALUATION_BASE_URL ||
      "https://valutazioni.holdingcasacorporation.it";

    const contactIdSafe = contactId || null;
    const agentId = agentIdRaw || null;

    if (mode === "prepare") {
      if (!whatsappNumberRaw) {
        return NextResponse.json(
          { error: "Numero WhatsApp mancante." },
          { status: 400 }
        );
      }

      const whatsappNumber = whatsappNumberRaw.replace(/[^\d]/g, "");

      if (!whatsappNumber) {
        return NextResponse.json(
          { error: "Numero WhatsApp non valido." },
          { status: 400 }
        );
      }

      let incaricoDestinationUrl: string | null = null;

      const { data: assetRow, error: assetError } = await supabaseAdmin
        .from("valuation_assets")
        .select("file_path")
        .eq("organization_id", organizationId)
        .eq("asset_type", "incarico")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assetError) {
        return NextResponse.json(
          { error: `Errore lettura incarico: ${assetError.message}` },
          { status: 500 }
        );
      }

      if (assetRow?.file_path) {
        const cleanPath = String(assetRow.file_path).trim();

        const { data: signedIncaricoData, error: signedIncaricoError } =
          await supabaseAdmin.storage
            .from(VALUATION_INCARICHI_BUCKET)
            .createSignedUrl(cleanPath, 60 * 60 * 24 * 365);

        if (!signedIncaricoError && signedIncaricoData?.signedUrl) {
          incaricoDestinationUrl = signedIncaricoData.signedUrl;
        }
      }

      const valuationToken = buildToken("val");
      const valuationPdfToken = buildToken("vpdf");
      const reviewsToken = buildToken("rev");
      const whatsappToken = buildToken("wa");
      const incaricoToken = buildToken("inc");
      const websiteToken = buildToken("site");

      const whatsappMessage = encodeURIComponent(
        "Ho visto la valutazione del mio immobile, vorrei parlare con un agente"
      );

      const whatsappDestinationUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

      const rowsToInsert: Array<Record<string, string | boolean | null>> = [
        {
          organization_id: organizationId,
          contact_id: contactIdSafe,
          agent_id: agentId,
          valuation_name: valuationName || null,
          token: valuationPdfToken,
          valuation_token: valuationToken,
          link_type: "valuation_pdf",
          destination_url: "",
          source,
          is_active: true,
        },
        {
          organization_id: organizationId,
          contact_id: contactIdSafe,
          agent_id: agentId,
          valuation_name: valuationName || null,
          token: reviewsToken,
          valuation_token: valuationToken,
          link_type: "reviews",
          destination_url: reviewsUrl,
          source,
          is_active: true,
        },
        {
          organization_id: organizationId,
          contact_id: contactIdSafe,
          agent_id: agentId,
          valuation_name: valuationName || null,
          token: whatsappToken,
          valuation_token: valuationToken,
          link_type: "whatsapp",
          destination_url: whatsappDestinationUrl,
          source,
          is_active: true,
        },
        {
          organization_id: organizationId,
          contact_id: contactIdSafe,
          agent_id: agentId,
          valuation_name: valuationName || null,
          token: websiteToken,
          valuation_token: valuationToken,
          link_type: "website",
          destination_url: websiteUrl,
          source,
          is_active: true,
        },
      ];

      if (incaricoDestinationUrl) {
        rowsToInsert.push({
          organization_id: organizationId,
          contact_id: contactIdSafe,
          agent_id: agentId,
          valuation_name: valuationName || null,
          token: incaricoToken,
          valuation_token: valuationToken,
          link_type: "incarico",
          destination_url: incaricoDestinationUrl,
          source,
          is_active: true,
        });
      }

      const { data: insertedRows, error: insertError } = await supabaseAdmin
        .from("valuation_links")
        .insert(rowsToInsert)
        .select("id, token, valuation_token, link_type, destination_url");

      if (insertError) {
        return NextResponse.json(
          {
            error: `Errore inserimento valuation_links: ${insertError.message}`,
          },
          { status: 500 }
        );
      }

      const valuationPdfRow = insertedRows?.find(
        (row) => row.link_type === "valuation_pdf"
      );
      const reviewsRow = insertedRows?.find((row) => row.link_type === "reviews");
      const whatsappRow = insertedRows?.find(
        (row) => row.link_type === "whatsapp"
      );
      const incaricoRow = insertedRows?.find(
        (row) => row.link_type === "incarico"
      );
      const websiteRow = insertedRows?.find((row) => row.link_type === "website");

      const valuationPdfResolvedToken =
        valuationPdfRow?.token ?? valuationPdfToken;
      const reviewsResolvedToken = reviewsRow?.token ?? reviewsToken;
      const whatsappResolvedToken = whatsappRow?.token ?? whatsappToken;
      const websiteResolvedToken = websiteRow?.token ?? websiteToken;

      return NextResponse.json({
        success: true,
        mode: "prepare",
        valuation_token: valuationToken,
        valuation_pdf: {
          token: valuationPdfResolvedToken,
          tracked_url: buildPublicValuationUrl(
            baseUrl,
            valuationPdfResolvedToken
          ),
        },
        reviews: {
          token: reviewsResolvedToken,
          tracked_url: buildTrackedLinkUrl(baseUrl, reviewsResolvedToken),
        },
        whatsapp: {
          token: whatsappResolvedToken,
          tracked_url: buildTrackedLinkUrl(baseUrl, whatsappResolvedToken),
        },
        website: {
          token: websiteResolvedToken,
          tracked_url: buildTrackedLinkUrl(baseUrl, websiteResolvedToken),
        },
        incarico: incaricoRow
          ? {
              token: incaricoRow.token,
              tracked_url: buildTrackedLinkUrl(baseUrl, incaricoRow.token),
            }
          : null,
      });
    }

    if (mode === "finalize") {
      const pdfFile = formData.get("file");
      const valuationPdfToken = String(
        formData.get("valuation_pdf_token") || ""
      ).trim();

      if (!(pdfFile instanceof File)) {
        return NextResponse.json(
          { error: "File PDF mancante." },
          { status: 400 }
        );
      }

      if (!valuationPdfToken) {
        return NextResponse.json(
          { error: "valuation_pdf_token mancante." },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await pdfFile.arrayBuffer());
      const storagePath = buildStoragePath({
        organizationId,
        contactId: contactIdSafe,
      });

      const uploadResult = await supabaseAdmin.storage
        .from(VALUATION_PDF_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadResult.error) {
        return NextResponse.json(
          { error: `Errore upload PDF: ${uploadResult.error.message}` },
          { status: 500 }
        );
      }

      const { data: signedPdfData, error: signedPdfError } =
        await supabaseAdmin.storage
          .from(VALUATION_PDF_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      if (signedPdfError || !signedPdfData?.signedUrl) {
        return NextResponse.json(
          { error: "Impossibile creare signed URL del PDF." },
          { status: 500 }
        );
      }

      const pdfDestinationUrl = signedPdfData.signedUrl;

      const { error: updateError } = await supabaseAdmin
        .from("valuation_links")
        .update({
          destination_url: pdfDestinationUrl,
          is_active: true,
          valuation_name: valuationName || null,
        })
        .eq("token", valuationPdfToken)
        .eq("link_type", "valuation_pdf");

      if (updateError) {
        return NextResponse.json(
          { error: `Errore update valuation_pdf: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: "finalize",
        storage_path: storagePath,
        destination_url: pdfDestinationUrl,
        tracked_url: buildPublicValuationUrl(baseUrl, valuationPdfToken),
      });
    }

    return NextResponse.json(
      { error: "mode non valido. Usa prepare o finalize." },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore imprevisto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}