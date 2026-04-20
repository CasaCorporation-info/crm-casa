import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PageProps = {
  params: {
    token: string;
  };
};

const FALLBACK_REDIRECT_URL = "https://holdingcasacorporation.it";

export default async function ValuationPdfPage({ params }: PageProps) {
  const { token } = params;

  if (!token) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  const { data: valuationLink, error: linkError } = await supabaseAdmin
    .from("valuation_links")
    .select("*")
    .eq("token", token)
    .eq("link_type", "valuation_pdf")
    .eq("is_active", true)
    .single();

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

  await supabaseAdmin.from("valuation_link_events").insert({
    organization_id: valuationLink.organization_id,
    valuation_link_id: valuationLink.id,
    contact_id: valuationLink.contact_id,
    agent_id: valuationLink.agent_id,
    token: valuationLink.token,
    link_type: valuationLink.link_type,
    destination_url: destinationUrl,
    source: valuationLink.source,
    event_type: "opened",
    user_agent: null,
  });

  return (
    <main className="min-h-screen bg-neutral-950">
      <iframe
        src={destinationUrl}
        title="Valutazione PDF"
        className="h-screen w-full border-0"
      />
    </main>
  );
}