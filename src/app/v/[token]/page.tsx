import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

const FALLBACK_REDIRECT_URL = "https://holdingcasacorporation.it";

export default async function ValuationPdfPage({ params }: PageProps) {
  const { token } = await params;

  if (!token) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  const { data: valuationLink, error: linkError } = await supabaseAdmin
    .from("valuation_links")
    .select("*")
    .eq("token", token)
    .eq("link_type", "valuation_pdf")
    .eq("is_active", true)
    .maybeSingle();

  if (linkError || !valuationLink) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  const destinationUrl =
    typeof valuationLink.destination_url === "string"
      ? valuationLink.destination_url.trim()
      : "";

  if (!destinationUrl) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  const headersList = await headers();
  const userAgent = headersList.get("user-agent");

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
    event_type: "opened",
    user_agent: userAgent,
  });

  redirect(destinationUrl);
}