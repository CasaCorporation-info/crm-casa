"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuth() {
      await supabase.auth.getSession();
      router.replace("/");
    }

    handleAuth();
  }, [router]);

  return <div style={{ padding: 40 }}>Accesso in corso...</div>;
}