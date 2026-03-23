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
        label: link.button_1_label,
        message: link.button_1_message,
      },
      button_2: {
        label: link.button_2_label,
        message: link.button_2_message,
      },
      button_3: {
        label: link.button_3_label,
        message: link.button_3_message,
      },
      button_4: {
        label: link.button_4_label,
        message: link.button_4_message,
      },
    };

    const selected = map[buttonKey];

    if (!selected) {
      return NextResponse.json({ error: "Pulsante non valido" }, { status: 400 });
    }

    const headersList = await headers();
    const userAgent = headersList.get("user-agent");

    const { error: insertError } = await supabaseAdmin
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

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const whatsappUrl = buildWhatsAppUrl(link.whatsapp_number, selected.message);

    return NextResponse.json({
      ok: true,
      whatsappUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}