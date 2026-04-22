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
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>DEBUG PDF VALUTAZIONE</h1>
        <p>Errore: token mancante</p>
      </main>
    );
  }

  const { data: valuationLink, error: linkError } = await supabaseAdmin
    .from("valuation_links")
    .select("*")
    .eq("token", token)
    .eq("link_type", "valuation_pdf")
    .eq("is_active", true)
    .maybeSingle();

  if (linkError) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>DEBUG PDF VALUTAZIONE</h1>
        <p>Errore query valuation_links:</p>
        <pre>{JSON.stringify(linkError, null, 2)}</pre>
      </main>
    );
  }

  if (!valuationLink) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>DEBUG PDF VALUTAZIONE</h1>
        <p>Nessuna riga trovata in valuation_links</p>
        <p>
          <strong>Token:</strong> {token}
        </p>
        <p>
          Sto cercando con:
          <br />
          link_type = valuation_pdf
          <br />
          is_active = true
        </p>
      </main>
    );
  }

  const destinationUrl =
    typeof valuationLink.destination_url === "string"
      ? valuationLink.destination_url.trim()
      : "";

  if (!destinationUrl) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>DEBUG PDF VALUTAZIONE</h1>
        <p>Riga trovata, ma destination_url è vuoto.</p>
        <pre>{JSON.stringify(valuationLink, null, 2)}</pre>
      </main>
    );
  }

  const { error: eventError } = await supabaseAdmin
    .from("valuation_link_events")
    .insert({
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

  if (eventError) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>DEBUG PDF VALUTAZIONE</h1>
        <p>Riga trovata, destination_url ok, ma errore insert evento.</p>
        <p>
          <strong>Destination URL:</strong> {destinationUrl}
        </p>
        <pre>{JSON.stringify(eventError, null, 2)}</pre>
      </main>
    );
  }

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