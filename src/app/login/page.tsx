"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // controllo se esiste già una sessione attiva
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/");
      }
    }

    checkSession();
  }, [router]);

  async function signIn() {

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>

      <h1 style={{ marginBottom: 6 }}>Login CRM</h1>

      <div style={{ opacity: 0.7, marginBottom: 18 }}>
        Accesso riservato (email + password)
      </div>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          marginBottom: 10
        }}
      />

      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
          marginBottom: 10
        }}
      />

      <button
        onClick={signIn}
        disabled={!email || !password || loading}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #111",
          background: "#111",
          color: "#fff",
          cursor: !email || !password || loading ? "not-allowed" : "pointer",
          opacity: !email || !password || loading ? 0.7 : 1
        }}
      >
        {loading ? "Accesso..." : "Entra"}
      </button>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fafafa"
          }}
        >
          {msg}
        </div>
      )}

    </div>
  );
}