import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ORG_ID = "1573b4fa-eb4a-4fb2-9c7e-fba3ef58a580";

function getBearerToken(req: Request) {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

type Body = {
  user_id: string;
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
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id required", step: "missing_user_id" },
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
        { error: "Profile not found", step: "admin_profile_not_found" },
        { status: 404 }
      );
    }

    if (me.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden", step: "not_admin" },
        { status: 403 }
      );
    }

    if (me.organization_id !== ORG_ID) {
      return NextResponse.json(
        { error: "Wrong organization", step: "wrong_admin_org" },
        { status: 403 }
      );
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user_id)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: "Agent not found", step: "target_not_found" },
        { status: 404 }
      );
    }

    if (targetProfile.organization_id !== ORG_ID) {
      return NextResponse.json(
        { error: "Agent not in organization", step: "wrong_target_org" },
        { status: 403 }
      );
    }

    if (targetProfile.role === "admin") {
      return NextResponse.json(
        {
          error: "Non puoi eliminare un admin da questa schermata",
          step: "target_is_admin",
        },
        { status: 403 }
      );
    }

    const { error: deleteMembershipError } = await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("user_id", user_id)
      .eq("organization_id", ORG_ID);

    if (deleteMembershipError) {
      return NextResponse.json(
        {
          error: deleteMembershipError.message,
          step: "delete_membership_failed",
        },
        { status: 500 }
      );
    }

    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user_id);

    if (deleteProfileError) {
      return NextResponse.json(
        {
          error: deleteProfileError.message,
          step: "delete_profile_failed",
        },
        { status: 500 }
      );
    }

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteUserError) {
      return NextResponse.json(
        {
          error: deleteUserError.message,
          step: "delete_auth_user_failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted_user_id: user_id,
      message: "Agente eliminato con successo",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", step: "catch" },
      { status: 500 }
    );
  }
}