import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(req: Request) {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

type Body = {
  contact_id: string;
};

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", step: "missing_bearer_token" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Body;
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: "contact_id required", step: "missing_contact_id" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          step: "invalid_token",
          details: authError?.message ?? null,
        },
        { status: 401 }
      );
    }

    const { data: me, error: meError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

    if (meError || !me) {
      return NextResponse.json(
        { error: "Profile not found", step: "profile_not_found" },
        { status: 404 }
      );
    }

    const myRole = String(me.role || "").trim().toLowerCase();
    const isAdminLike = myRole === "admin" || myRole === "manager";

    if (!isAdminLike) {
      return NextResponse.json(
        { error: "Forbidden", step: "not_allowed" },
        { status: 403 }
      );
    }

    const { data: contact, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, organization_id, first_name, last_name")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Contact not found", step: "contact_not_found" },
        { status: 404 }
      );
    }

    if (
      !me.organization_id ||
      String(contact.organization_id) !== String(me.organization_id)
    ) {
      return NextResponse.json(
        { error: "Wrong organization", step: "wrong_organization" },
        { status: 403 }
      );
    }

    const { error: activitiesDeleteError } = await supabaseAdmin
      .from("contact_activities")
      .delete()
      .eq("contact_id", contact_id);

    if (activitiesDeleteError) {
      return NextResponse.json(
        {
          error: activitiesDeleteError.message,
          step: "delete_activities_failed",
        },
        { status: 500 }
      );
    }

    const { error: linksDeleteError } = await supabaseAdmin
      .from("whatsapp_campaign_links")
      .delete()
      .eq("contact_id", contact_id);

    if (linksDeleteError) {
      return NextResponse.json(
        {
          error: linksDeleteError.message,
          step: "delete_whatsapp_links_failed",
        },
        { status: 500 }
      );
    }

    const { error: contactDeleteError } = await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("id", contact_id);

    if (contactDeleteError) {
      return NextResponse.json(
        {
          error: contactDeleteError.message,
          step: "delete_contact_failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted_contact_id: contact_id,
      message: "Contatto eliminato con successo",
    });
  } catch {
    return NextResponse.json(
      { error: "Server error", step: "catch" },
      { status: 500 }
    );
  }
}