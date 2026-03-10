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
  full_name: string;
  role: "agent" | "manager";
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
    const { user_id, full_name, role } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id required", step: "missing_user_id" },
        { status: 400 }
      );
    }

    if (!full_name || !String(full_name).trim()) {
      return NextResponse.json(
        { error: "full_name required", step: "missing_full_name" },
        { status: 400 }
      );
    }

    if (role !== "agent" && role !== "manager") {
      return NextResponse.json(
        { error: "Invalid role", step: "invalid_role" },
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
      .select("id, role, organization_id")
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
          error: "Non puoi modificare un admin da questa schermata",
          step: "target_is_admin",
        },
        { status: 403 }
      );
    }

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: String(full_name).trim(),
        role,
      })
      .eq("id", user_id);

    if (updateProfileError) {
      return NextResponse.json(
        {
          error: updateProfileError.message,
          step: "update_profile_failed",
        },
        { status: 500 }
      );
    }

    const { error: updateMembershipError } = await supabaseAdmin
      .from("organization_members")
      .update({
        role,
      })
      .eq("user_id", user_id)
      .eq("organization_id", ORG_ID);

    if (updateMembershipError) {
      return NextResponse.json(
        {
          error: updateMembershipError.message,
          step: "update_membership_failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated_user_id: user_id,
      message: "Agente aggiornato con successo",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", step: "catch" },
      { status: 500 }
    );
  }
}