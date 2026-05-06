"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ValuationLink = {
  id: string;
  token: string | null;
  valuation_token: string | null;
  valuation_name: string | null;
  link_type: string | null;
  source: string | null;
  destination_url: string | null;
  created_at: string;
};

type ValuationEvent = {
  id: string;
  valuation_link_id: string | null;
  token: string | null;
  valuation_token: string | null;
  valuation_name: string | null;
  event_type: string | null;
  link_type: string | null;
  clicked_at: string;
};

export default function PrivatiAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<ValuationLink[]>([]);
  const [events, setEvents] = useState<ValuationEvent[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: linksData } = await supabase
        .from("valuation_links")
        .select(
          "id, token, valuation_token, valuation_name, link_type, source, destination_url, created_at"
        )
        .order("created_at", { ascending: false });

      const { data: eventsData } = await supabase
        .from("valuation_link_events")
        .select(
          "id, valuation_link_id, token, valuation_token, valuation_name, event_type, link_type, clicked_at"
        )
        .order("clicked_at", { ascending: false });

      setLinks(linksData || []);
      setEvents(eventsData || []);
      setLoading(false);
    }

    loadData();
  }, []);

  const pdfLinks = useMemo(
    () => links.filter((link) => link.link_type === "valuation_pdf"),
    [links]
  );

  const pdfOpenEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.event_type === "opened" &&
          event.link_type === "valuation_pdf"
      ),
    [events]
  );

  const stats = useMemo(() => {
    const countEvents = (eventType: string, linkType: string) =>
      events.filter(
        (event) =>
          event.event_type === eventType && event.link_type === linkType
      ).length;

    const pdfOpen = pdfOpenEvents.length;
    const reviewsClick = countEvents("clicked", "reviews");
    const whatsappClick = countEvents("clicked", "whatsapp");
    const incaricoClick = countEvents("clicked", "incarico");
    const websiteClick = countEvents("clicked", "website");

    const rate = (value: number, total: number) =>
      total > 0 ? Math.round((value / total) * 100) : 0;

    return {
      totalLinks: pdfLinks.length,
      pdfOpen,
      reviewsClick,
      whatsappClick,
      incaricoClick,
      websiteClick,
      openRate: rate(pdfOpen, pdfLinks.length),
      reviewsRate: rate(reviewsClick, pdfOpen),
      whatsappRate: rate(whatsappClick, pdfOpen),
      incaricoRate: rate(incaricoClick, pdfOpen),
      websiteRate: rate(websiteClick, pdfOpen),
    };
  }, [events, pdfLinks.length, pdfOpenEvents.length]);

  const detailedLinks = useMemo(() => {
    return pdfLinks.map((link) => {
      const relatedEvents = events.filter((event) => {
        const byLinkId =
          event.valuation_link_id && event.valuation_link_id === link.id;

        const byToken = event.token && link.token && event.token === link.token;

        const byValuationToken =
          event.valuation_token &&
          link.valuation_token &&
          event.valuation_token === link.valuation_token;

        return byLinkId || byToken || byValuationToken;
      });

      const pdfOpen = relatedEvents.filter(
        (event) =>
          event.event_type === "opened" &&
          event.link_type === "valuation_pdf"
      ).length;

      const whatsappClick = relatedEvents.filter(
        (event) =>
          event.event_type === "clicked" && event.link_type === "whatsapp"
      ).length;

      const reviewsClick = relatedEvents.filter(
        (event) =>
          event.event_type === "clicked" && event.link_type === "reviews"
      ).length;

      const incaricoClick = relatedEvents.filter(
        (event) =>
          event.event_type === "clicked" && event.link_type === "incarico"
      ).length;

      const websiteClick = relatedEvents.filter(
        (event) =>
          event.event_type === "clicked" && event.link_type === "website"
      ).length;

      const latestEvent = relatedEvents[0];

      return {
        ...link,
        pdfOpen,
        whatsappClick,
        reviewsClick,
        incaricoClick,
        websiteClick,
        latestEvent,
      };
    });
  }, [events, pdfLinks]);

  if (loading) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Privati Analytics</h1>
        <p className="text-sm text-gray-500 mt-2">Caricamento KPI...</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6 bg-[#f6f7f9] min-h-screen">
      <header className="bg-white border rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-gray-500">KPI / Analytics</p>
        <h1 className="text-3xl font-bold mt-1">Privati Analytics</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Monitoraggio dei link tracciati inviati ai privati: aperture PDF,
          recensioni, WhatsApp, incarico e sito.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          title="Valutazioni create"
          value={stats.totalLinks}
          subtitle="Totale PDF valutazione generati"
        />

        <KpiCard
          title="PDF aperti"
          value={stats.pdfOpen}
          subtitle={`${stats.openRate}% apertura`}
        />

        <KpiCard
          title="Click WhatsApp"
          value={stats.whatsappClick}
          subtitle={`${stats.whatsappRate}% sui PDF aperti`}
        />

        <KpiCard
          title="Click incarico"
          value={stats.incaricoClick}
          subtitle={`${stats.incaricoRate}% sui PDF aperti`}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-1">Funnel privati</h2>
          <p className="text-sm text-gray-500 mb-5">
            Sequenza reale: valutazione creata → PDF aperto → click sui pulsanti.
          </p>

          <div className="space-y-4">
            <FunnelStep label="Valutazioni create" value={stats.totalLinks} percent={100} />
            <FunnelStep label="PDF aperti" value={stats.pdfOpen} percent={stats.openRate} />
            <FunnelStep label="Click recensioni" value={stats.reviewsClick} percent={stats.reviewsRate} />
            <FunnelStep label="Click WhatsApp" value={stats.whatsappClick} percent={stats.whatsappRate} />
            <FunnelStep label="Click incarico PDF" value={stats.incaricoClick} percent={stats.incaricoRate} />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-1">Click sui pulsanti PDF</h2>
          <p className="text-sm text-gray-500 mb-5">
            Capisce quali pulsanti attirano più interesse.
          </p>

          <div className="space-y-3">
            <ClickRow label="Recensioni" value={stats.reviewsClick} total={stats.pdfOpen} />
            <ClickRow label="WhatsApp" value={stats.whatsappClick} total={stats.pdfOpen} />
            <ClickRow label="Incarico PDF" value={stats.incaricoClick} total={stats.pdfOpen} />
            <ClickRow label="Sito Casa Corporation" value={stats.websiteClick} total={stats.pdfOpen} />
          </div>
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-6 shadow-sm overflow-auto">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Dettaglio valutazioni tracciate</h2>
          <p className="text-sm text-gray-500">
            Qui vedi quale valutazione è stata aperta e quali pulsanti sono stati premuti.
          </p>
        </div>

        <table className="w-full text-sm border-collapse min-w-[1200px]">
          <thead>
            <tr className="border-b text-left">
              <th className="py-3 pr-4">Valutazione</th>
              <th className="py-3 pr-4">Aperture PDF</th>
              <th className="py-3 pr-4">WhatsApp</th>
              <th className="py-3 pr-4">Recensioni</th>
              <th className="py-3 pr-4">Incarico</th>
              <th className="py-3 pr-4">Sito</th>
              <th className="py-3 pr-4">Ultimo evento</th>
              <th className="py-3 pr-4">Stato</th>
            </tr>
          </thead>

          <tbody>
            {detailedLinks.map((link) => {
              const isHot =
                link.whatsappClick > 0 ||
                link.incaricoClick > 0 ||
                link.pdfOpen >= 2;

              const valuationName =
                link.valuation_name ||
                `Valutazione ${link.valuation_token?.slice(0, 8) || link.token?.slice(0, 8) || ""}`;

              return (
                <tr key={link.id} className="border-b">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{valuationName}</div>

                    <div className="text-xs text-gray-500 mt-1 font-mono">
                      {link.valuation_token
                        ? `Valuation token: ${link.valuation_token.slice(0, 22)}...`
                        : link.token
                          ? `Token link: ${link.token.slice(0, 22)}...`
                          : "Token non disponibile"}
                    </div>

                    {link.destination_url && (
                      <a
                        href={link.destination_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline text-gray-700 mt-1 inline-block"
                      >
                        Apri link PDF
                      </a>
                    )}
                  </td>

                  <td className="py-3 pr-4 font-semibold">{link.pdfOpen}</td>
                  <td className="py-3 pr-4">{link.whatsappClick}</td>
                  <td className="py-3 pr-4">{link.reviewsClick}</td>
                  <td className="py-3 pr-4">{link.incaricoClick}</td>
                  <td className="py-3 pr-4">{link.websiteClick}</td>

                  <td className="py-3 pr-4 text-xs text-gray-500">
                    {link.latestEvent
                      ? new Date(link.latestEvent.clicked_at).toLocaleString("it-IT")
                      : "-"}
                  </td>

                  <td className="py-3 pr-4">
                    {isHot ? (
                      <span className="rounded-full bg-black text-white px-3 py-1 text-xs">
                        Caldo
                      </span>
                    ) : link.pdfOpen > 0 ? (
                      <span className="rounded-full bg-gray-200 px-3 py-1 text-xs">
                        Aperto
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                        Non aperto
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="bg-white border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-1">Lettura rapida</h2>
        <p className="text-sm text-gray-500 mb-4">
          Sintesi operativa della campagna privati.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightBox title="Apertura PDF" value={`${stats.openRate}%`} text="Quanti aprono il PDF rispetto ai link generati." />
          <InsightBox title="Ricerca fiducia" value={`${stats.reviewsRate}%`} text="Click recensioni: indica bisogno di conferma sulla tua agenzia." />
          <InsightBox title="Segnale caldo" value={`${stats.whatsappRate}%`} text="Click WhatsApp: contatto da richiamare subito." />
        </div>
      </section>
    </main>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
      <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">
          {value} · {percent}%
        </span>
      </div>

      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-black rounded-full"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function ClickRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const rate = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="flex items-center justify-between border-b pb-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-gray-400">Calcolato sui PDF aperti</p>
      </div>

      <div className="text-right">
        <p className="font-bold">{value} click</p>
        <p className="text-xs text-gray-500">{rate}%</p>
      </div>
    </div>
  );
}

function InsightBox({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className="border rounded-xl p-5 bg-gray-50">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-sm text-gray-500 mt-2">{text}</p>
    </div>
  );
}