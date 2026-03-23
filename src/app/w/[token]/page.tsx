import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getLandingButtons,
  type WhatsAppCampaignLinkRow,
} from "@/lib/whatsappLinks";
import WhatsAppLandingClient from "@/components/whatsapp/WhatsAppLandingClient";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function WhatsAppLandingPage({ params }: Props) {
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from("whatsapp_campaign_links")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single<WhatsAppCampaignLinkRow>();

  if (error || !data) {
    notFound();
  }

  return (
    <WhatsAppLandingClient
      token={data.token}
      title={data.landing_title}
      body={data.landing_body}
      footer={data.landing_footer}
      buttons={getLandingButtons(data)}
    />
  );
}