import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;
    const durationMsRaw = body?.durationMs;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token mancante" }, { status: 400 });
    }

    const durationMs =
      typeof durationMsRaw === "number" && Number.isFinite(durationMsRaw)
        ? Math.max(0, Math.floor(durationMsRaw))
        : 0;

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

    const durationSeconds = Math.round(durationMs / 1000);

    const { error: insertError } = await supabaseAdmin
      .from("whatsapp_campaign_events")
      .insert({
        token: link.token,
        link_id: link.id,
        organization_id: link.organization_id,
        contact_id: link.contact_id,
        template_id: link.template_id,
        campaign_name: link.campaign_name,
        event_type: "landing_stay",
        button_label: `${durationSeconds}s`,
        prefilled_message: String(durationMs),
        user_agent: userAgent,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}