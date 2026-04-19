import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildWhatsAppUrl } from "@/lib/whatsappLinks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;
    const buttonKey = body?.buttonKey;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token mancante" }, { status: 400 });
    }

    if (!buttonKey || typeof buttonKey !== "string") {
      return NextResponse.json({ error: "Pulsante mancante" }, { status: 400 });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from("whatsapp_campaign_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: "Link non trovato" }, { status: 404 });
    }

    const map: Record<string, { label: string; message: string }> = {
      button_1: {
        label: link.button_1_label || "",
        message: link.button_1_message || "",
      },
      button_2: {
        label: link.button_2_label || "",
        message: link.button_2_message || "",
      },
      button_3: {
        label: link.button_3_label || "",
        message: link.button_3_message || "",
      },
      button_4: {
        label: link.button_4_label || "",
        message: link.button_4_message || "",
      },
    };

    const selected = map[buttonKey];

    if (!selected) {
      return NextResponse.json({ error: "Pulsante non valido" }, { status: 400 });
    }

    if (!selected.message.trim()) {
      return NextResponse.json(
        { error: "Messaggio pulsante mancante" },
        { status: 400 }
      );
    }

    const whatsappNumber = String(link.whatsapp_number || "").trim();

    if (!whatsappNumber) {
      return NextResponse.json(
        { error: "Numero WhatsApp destinatario mancante" },
        { status: 400 }
      );
    }

    const headersList = await headers();
    const userAgent = headersList.get("user-agent");

    const { error: insertEventError } = await supabaseAdmin
      .from("whatsapp_campaign_events")
      .insert({
        token: link.token,
        link_id: link.id,
        organization_id: link.organization_id,
        contact_id: link.contact_id,
        template_id: link.template_id,
        campaign_name: link.campaign_name,
        event_type: "button_clicked",
        button_key: buttonKey,
        button_label: selected.label,
        prefilled_message: selected.message,
        user_agent: userAgent,
      });

    if (insertEventError) {
      return NextResponse.json(
        { error: insertEventError.message },
        { status: 500 }
      );
    }

    if (link.contact_id && link.organization_id) {
      const { error: activityError } = await supabaseAdmin
        .from("contact_activities")
        .insert({
          organization_id: link.organization_id,
          contact_id: link.contact_id,
          created_by: null,
          activity_type: "system",
          channel: "whatsapp",
          template_id: link.template_id,
          note: `Lead ha cliccato il pulsante "${selected.label}" nella landing WhatsApp della campagna: ${
            link.campaign_name || "Senza nome"
          }`,
          metadata: {
            source: "whatsapp_landing_click",
            token: link.token,
            link_id: link.id,
            campaign_name: link.campaign_name || null,
            event_type: "button_clicked",
            button_key: buttonKey,
            button_label: selected.label,
            prefilled_message: selected.message,
            whatsapp_number: whatsappNumber,
            user_agent: userAgent,
          },
        });

      if (activityError) {
        return NextResponse.json(
          { error: activityError.message },
          { status: 500 }
        );
      }
    }

    const whatsappUrl = buildWhatsAppUrl(whatsappNumber, selected.message);

    if (!whatsappUrl) {
      return NextResponse.json(
        { error: "Impossibile costruire il link WhatsApp" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      whatsappUrl,
    });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}