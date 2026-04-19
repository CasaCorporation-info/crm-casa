import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token mancante" }, { status: 400 });
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
        event_type: "opened",
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
          note: `Lead ha aperto la landing WhatsApp della campagna: ${
            link.campaign_name || "Senza nome"
          }`,
          metadata: {
            source: "whatsapp_landing_open",
            token: link.token,
            link_id: link.id,
            campaign_name: link.campaign_name || null,
            event_type: "opened",
            whatsapp_number: link.whatsapp_number || null,
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}