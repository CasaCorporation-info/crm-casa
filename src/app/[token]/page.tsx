import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

const FALLBACK_REDIRECT_URL = "https://holdingcasacorporation.it";

export default async function PublicValuationTokenPage({ params }: PageProps) {
  const { token } = await params;

  if (!token || !token.startsWith("vpdf_")) {
    redirect(FALLBACK_REDIRECT_URL);
  }

  const { data: valuationLink, error } = await supabaseAdmin
    .from("valuation_links")
    .select("*")
    .eq("token", token)
    .eq("link_type", "valuation_pdf")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !valuationLink) {
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
    <main style={{ margin: 0, padding: 0, background: "#111" }}>
      <iframe
        src={destinationUrl}
        title="Valutazione immobiliare"
        style={{
          width: "100vw",
          height: "100vh",
          border: 0,
          display: "block",
        }}
      />
    </main>
  );
}