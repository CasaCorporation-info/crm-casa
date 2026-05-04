import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const FALLBACK_REDIRECT_URL = "https://holdingcasacorporation.it";

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  if (!token) {
    return NextResponse.redirect(FALLBACK_REDIRECT_URL);
  }

  const { data: valuationLink, error: linkError } = await supabaseAdmin
    .from("valuation_links")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (linkError || !valuationLink) {
    return NextResponse.redirect(FALLBACK_REDIRECT_URL);
  }

  const destinationUrl =
    typeof valuationLink.destination_url === "string"
      ? valuationLink.destination_url.trim()
      : "";

  if (!destinationUrl) {
    return NextResponse.redirect(FALLBACK_REDIRECT_URL);
  }

  const userAgent = request.headers.get("user-agent");

  await supabaseAdmin.from("valuation_link_events").insert({
    organization_id: valuationLink.organization_id,
    valuation_link_id: valuationLink.id,
    valuation_token: valuationLink.valuation_token,
    contact_id: valuationLink.contact_id,
    agent_id: valuationLink.agent_id,
    token: valuationLink.token,
    link_type: valuationLink.link_type,
    destination_url: destinationUrl,
    source: valuationLink.source,
    event_type: "clicked",
    user_agent: userAgent,
  });

  return NextResponse.redirect(destinationUrl);
}