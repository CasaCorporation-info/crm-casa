"use client";

import { supabase } from "@/lib/supabaseClient";

export default function SidebarLogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
        color: "#111",
        fontWeight: 600,
        fontSize: 14,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}