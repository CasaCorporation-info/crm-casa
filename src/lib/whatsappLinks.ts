export type LandingButton = {
  key: "button_1" | "button_2" | "button_3" | "button_4";
  label: string;
  message: string;
};

export type WhatsAppCampaignLinkRow = {
  id: string;
  token: string;
  organization_id: string;
  contact_id: string;
  template_id: string | null;
  campaign_name: string | null;
  whatsapp_number: string;
  landing_title: string;
  landing_body: string;
  landing_footer: string | null;
  button_1_label: string;
  button_1_message: string;
  button_2_label: string;
  button_2_message: string;
  button_3_label: string;
  button_3_message: string;
  button_4_label: string;
  button_4_message: string;
  is_active: boolean;
};

export function normalizeWhatsAppNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("39")) return digits;
  if (digits.startsWith("0")) return `39${digits.slice(1)}`;
  return `39${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function getLandingButtons(row: WhatsAppCampaignLinkRow): LandingButton[] {
  return [
    {
      key: "button_1",
      label: row.button_1_label,
      message: row.button_1_message,
    },
    {
      key: "button_2",
      label: row.button_2_label,
      message: row.button_2_message,
    },
    {
      key: "button_3",
      label: row.button_3_label,
      message: row.button_3_message,
    },
    {
      key: "button_4",
      label: row.button_4_label,
      message: row.button_4_message,
    },
  ];
}