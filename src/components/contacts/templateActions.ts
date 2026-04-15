import type {
  Contact,
  MessageTemplate,
  RecentActivityMap,
} from "@/components/contacts/types";
import {
  buildGmailComposeUrl,
  buildRecentActivityWarningMessage,
  buildWhatsAppUrl,
  createContactActivityAndTouchContact,
} from "@/components/contacts/utils";

type WhatsappOutcome =
  | "sent"
  | "not_sent"
  | "no_whatsapp"
  | "error"
  | "invalid_number";

type PendingWhatsappSend = {
  contact: Contact;
  template: MessageTemplate;
  finalMessage: string;
  targetUrl: string | null;
  metadata: Record<string, unknown>;
};

export function closeTemplateModalState({
  setTemplateModalOpen,
  setTemplateModalType,
  setTemplateModalContact,
  setSelectedTemplateId,
  setActionLoading,
}: {
  setTemplateModalOpen: (value: boolean) => void;
  setTemplateModalType: (value: "whatsapp" | "email" | null) => void;
  setTemplateModalContact: (value: Contact | null) => void;
  setSelectedTemplateId: (value: string) => void;
  setActionLoading: (value: boolean) => void;
}) {
  setTemplateModalOpen(false);
  setTemplateModalType(null);
  setTemplateModalContact(null);
  setSelectedTemplateId("");
  setActionLoading(false);
}

export function closeWhatsappOutcomeModalState({
  setPendingWhatsappSend,
  setWhatsappOutcomeLoading,
}: {
  setPendingWhatsappSend: (value: PendingWhatsappSend | null) => void;
  setWhatsappOutcomeLoading: (value: boolean) => void;
}) {
  setPendingWhatsappSend(null);
  setWhatsappOutcomeLoading(false);
}

export function tryOpenTemplateModal({
  contact,
  type,
  recentActivities,
}: {
  contact: Contact;
  type: "whatsapp" | "email";
  recentActivities: RecentActivityMap;
}):
  | { ok: true; shouldOpen: boolean }
  | { ok: false; errorMessage: string } {
  if (type === "whatsapp" && !contact.phone_primary?.trim()) {
    return {
      ok: false,
      errorMessage: "Questo contatto non ha un numero di telefono.",
    };
  }

  if (type === "email" && !contact.email_primary?.trim()) {
    return {
      ok: false,
      errorMessage: "Questo contatto non ha un'email.",
    };
  }

  const recent =
    type === "whatsapp"
      ? recentActivities[contact.id]?.whatsapp || null
      : recentActivities[contact.id]?.email || null;

  if (recent) {
    const confirmed = window.confirm(
      buildRecentActivityWarningMessage(recent, type)
    );

    if (!confirmed) {
      return { ok: true, shouldOpen: false };
    }
  }

  return { ok: true, shouldOpen: true };
}

export async function insertWhatsappOutcomeActivity({
  supabase,
  pending,
  outcome,
  currentUserId,
}: {
  supabase: any;
  pending: PendingWhatsappSend;
  outcome: WhatsappOutcome;
  currentUserId: string | null;
}):
  Promise<
    | { ok: true; nowIso: string }
    | { ok: false; errorMessage: string }
  > {
  if (!currentUserId) {
    return {
      ok: false,
      errorMessage: "Utente non autenticato.",
    };
  }

  if (!pending.contact.organization_id) {
    return {
      ok: false,
      errorMessage: "organization_id mancante sul contatto.",
    };
  }

  try {
    const nowIso = new Date().toISOString();

    const outcomeNoteMap: Record<WhatsappOutcome, string> = {
      sent: `WhatsApp inviato con template: ${pending.template.title}`,
      not_sent: `WhatsApp non inviato con template: ${pending.template.title}`,
      no_whatsapp: `Contatto senza WhatsApp per template: ${pending.template.title}`,
      error: `Errore invio WhatsApp con template: ${pending.template.title}`,
      invalid_number: `Numero non valido per template WhatsApp: ${pending.template.title}`,
    };

    const metadata: Record<string, unknown> = {
      ...pending.metadata,
      direction: "outbound",
      outcome,
      template_id: pending.template.id,
      campaign_name: pending.template.title,
      template_title: pending.template.title,
      source: "template_send_outcome_popup",
    };

    const { error: activityError } = await supabase
      .from("contact_activities")
      .insert({
        organization_id: pending.contact.organization_id,
        contact_id: pending.contact.id,
        created_by: currentUserId,
        activity_type: "whatsapp",
        channel: "whatsapp",
        template_id: pending.template.id,
        note: outcomeNoteMap[outcome],
        metadata,
      });

    if (activityError) {
      throw new Error(activityError.message);
    }

    const updatePayload: Record<string, unknown> = {
      last_contact_at: nowIso,
    };

    if (outcome === "sent") {
      updatePayload.lead_status = "contattato";
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", pending.contact.id);

    if (contactError) {
      throw new Error(contactError.message);
    }

    return {
      ok: true,
      nowIso,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Errore nel salvataggio esito WhatsApp.",
    };
  }
}

export async function handleSendFromTemplate({
  supabase,
  templateModalContact,
  templateModalType,
  selectedTemplate,
  currentUserId,
  setErrorMsg,
  setActionLoading,
}: {
  supabase: any;
  templateModalContact: Contact | null;
  templateModalType: "whatsapp" | "email" | null;
  selectedTemplate: MessageTemplate | null;
  currentUserId: string | null;
  setErrorMsg: (value: string | null) => void;
  setActionLoading: (value: boolean) => void;
}):
  Promise<
    | { ok: false }
    | {
        ok: true;
        mode: "whatsapp_pending";
        pendingWhatsappSend: PendingWhatsappSend;
      }
    | {
        ok: true;
        mode: "email_done";
        contactId: string;
        lastContactAt: string | null;
        leadStatus: string | null;
        templateId: string;
        templateTitle: string;
      }
  > {
  if (!templateModalContact || !templateModalType) {
    setErrorMsg("Contatto o tipo azione non validi.");
    return { ok: false };
  }

  if (!selectedTemplate) {
    setErrorMsg("Seleziona un template.");
    return { ok: false };
  }

  if (!templateModalContact.organization_id) {
    setErrorMsg("organization_id mancante sul contatto.");
    return { ok: false };
  }

  if (!currentUserId) {
    setErrorMsg("Utente non autenticato.");
    return { ok: false };
  }

  setActionLoading(true);
  setErrorMsg(null);

  let targetUrl: string | null = null;
  let note = "";
  let metadata: Record<string, unknown> = {
    template_title: selectedTemplate.title,
  };

  let finalMessage = selectedTemplate.message;

  if (selectedTemplate.linked_asset_id) {
    const { data: asset, error: assetError } = await supabase
      .from("link_assets")
      .select("*")
      .eq("id", selectedTemplate.linked_asset_id)
      .single();

    if (assetError) {
      setErrorMsg(assetError.message);
      setActionLoading(false);
      return { ok: false };
    }

    if (asset) {
      if (asset.link_type === "static" && asset.static_url) {
        finalMessage += `\n\n${asset.static_url}`;
        metadata = {
          ...metadata,
          link_type: "static",
          linked_asset_id: asset.id,
          linked_asset_name: asset.name || null,
          static_url: asset.static_url,
        };
      }

      if (asset.link_type === "whatsapp_landing") {
        const token = crypto.randomUUID();

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("whatsapp_number")
          .eq("id", currentUserId)
          .single();

        if (profileError || !profile?.whatsapp_number) {
          setErrorMsg("Numero WhatsApp utente non configurato.");
          setActionLoading(false);
          return { ok: false };
        }

        const { error: insertLinkError } = await supabase
          .from("whatsapp_campaign_links")
          .insert({
            token,
            organization_id: templateModalContact.organization_id,
            contact_id: templateModalContact.id,
            template_id: selectedTemplate.id,
            campaign_name: selectedTemplate.title,
            whatsapp_number: profile.whatsapp_number,
            landing_title: asset.landing_title,
            landing_body: finalMessage,
            landing_footer: asset.landing_footer,
            button_1_label: asset.button_1_label,
            button_1_message: asset.button_1_message,
            button_2_label: asset.button_2_label,
            button_2_message: asset.button_2_message,
            button_3_label: asset.button_3_label,
            button_3_message: asset.button_3_message,
            button_4_label: asset.button_4_label,
            button_4_message: asset.button_4_message,
            is_active: true,
          });

        if (insertLinkError) {
          setErrorMsg(insertLinkError.message);
          setActionLoading(false);
          return { ok: false };
        }

        const landingUrl = `https://whatsapp.holdingcasacorporation.it/w/${token}`;
        finalMessage += `\n\n${landingUrl}`;

        metadata = {
          ...metadata,
          link_type: "whatsapp_landing",
          linked_asset_id: asset.id,
          linked_asset_name: asset.name || null,
          campaign_name: selectedTemplate.title,
          whatsapp_sender_number: profile.whatsapp_number,
          landing_token: token,
          landing_url: landingUrl,
        };
      }
    }
  }

  if (templateModalType === "whatsapp") {
    const phone = templateModalContact.phone_primary?.trim() || "";
    targetUrl = buildWhatsAppUrl(phone, finalMessage);

    const pending: PendingWhatsappSend = {
      contact: templateModalContact,
      template: selectedTemplate,
      finalMessage,
      targetUrl,
      metadata: {
        ...metadata,
        phone,
      },
    };

    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }

    setActionLoading(false);

    return {
      ok: true,
      mode: "whatsapp_pending",
      pendingWhatsappSend: pending,
    };
  }

  if (templateModalType === "email") {
    const email = templateModalContact.email_primary?.trim() || "";
    if (!email) {
      setErrorMsg("Email non valida.");
      setActionLoading(false);
      return { ok: false };
    }

    targetUrl = buildGmailComposeUrl(
      email,
      selectedTemplate.subject || "",
      finalMessage
    );

    if (!targetUrl) {
      setErrorMsg("Impossibile costruire il link Gmail.");
      setActionLoading(false);
      return { ok: false };
    }

    note = `Aperta email Gmail web con template: ${selectedTemplate.title}`;
    metadata = {
      ...metadata,
      email,
      subject: selectedTemplate.subject || "",
      direction: "outbound",
      outcome: "opened",
    };
  }

  try {
    const result = await createContactActivityAndTouchContact({
      organizationId: templateModalContact.organization_id,
      contactId: templateModalContact.id,
      createdBy: currentUserId,
      activityType: templateModalType,
      note,
      currentLeadStatus: templateModalContact.lead_status,
      channel: templateModalType,
      templateId: selectedTemplate.id,
      metadata,
    });

    window.open(targetUrl as string, "_blank", "noopener,noreferrer");
    setActionLoading(false);

    return {
      ok: true,
      mode: "email_done",
      contactId: templateModalContact.id,
      lastContactAt: result.last_contact_at,
      leadStatus: result.lead_status,
      templateId: selectedTemplate.id,
      templateTitle: selectedTemplate.title,
    };
  } catch (error) {
    setErrorMsg(
      error instanceof Error
        ? error.message
        : "Errore nell'apertura del template."
    );
    setActionLoading(false);
    return { ok: false };
  }
}