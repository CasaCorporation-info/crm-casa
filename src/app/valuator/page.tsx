"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ValuatorForm from "@/components/valuator/ValuatorForm";

type Profile = {
  id: string;
  role: string | null;
};

export default function ValuatorPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      setProfile(data || null);
      setLoading(false);
    }

    loadProfile();
  }, []);

  return (
    <main style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700 }}>
          Valutatore immobiliare
        </h1>

        {!loading && profile?.role === "admin" && (
          <a
            href="/admin/valuator-fields"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#111",
              color: "#fff",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Gestione campi
          </a>
        )}
      </div>

      <ValuatorForm />
    </main>
  );
}