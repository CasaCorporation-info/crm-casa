import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  email: string;
  password?: string;
  full_name?: string;
  role: "admin" | "manager" | "agent";
};

function randomPassword(len = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const ORG_ID = "1573b4fa-eb4a-4fb2-9c7e-fba3ef58a580";

function getBearerToken(req: Request) {
  const h =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const email = (body.email || "").trim().toLowerCase();
    const role = body.role;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Missing email or role" },
        { status: 400 }
      );
    }

    const password = (body.password || "").trim() || randomPassword();
    const full_name = (body.full_name || "").trim() || null;

    const token = getBearerToken(req);

    let supabaseUser:
      | ReturnType<typeof createClient>
      | ReturnType<typeof createServerClient>;

    if (token) {
      supabaseUser = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
    } else {
      const cookieStore = await cookies();

      supabaseUser = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {},
          },
        }
      );
    }

    const { data: userData, error: userErr } =
      await supabaseUser.auth.getUser();

    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const me = userData.user;

    const { data: myMembership, error: memErr } = await supabaseUser
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", me.id)
      .eq("organization_id", ORG_ID)
      .maybeSingle();

    if (memErr || !myMembership || myMembership.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin only" },
        { status: 403 }
      );
    }

    const organization_id = myMembership.organization_id;

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: createErr?.message ?? "User creation failed" },
        { status: 400 }
      );
    }

    const newUserId = created.user.id;

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      organization_id,
      role,
      full_name,
      created_at: new Date().toISOString(),
    });

    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: `profiles insert failed: ${profErr.message}` },
        { status: 400 }
      );
    }

    const { error: omErr } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id,
        user_id: newUserId,
        role,
      });

    if (omErr) {
      await supabaseAdmin.from("profiles").delete().eq("id", newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: `organization_members insert failed: ${omErr.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      organization_id,
      user_id: newUserId,
      role,
      temp_password: password,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}