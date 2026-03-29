"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Agent = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string | null;
  whatsapp_number: string | null;
};

type CurrentUserProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  organization_id: string | null;
};

export default function AgentsPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("agent");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [result, setResult] = useState<any>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("agent");
  const [editWhatsappNumber, setEditWhatsappNumber] = useState("");

  function normalizeWhatsappNumber(value: string) {
    return value.replace(/[^\d+]/g, "").trim();
  }

  async function checkAccess() {
    try {
      setCheckingAuth(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, organization_id")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        router.push("/login");
        return;
      }

      setCurrentUser(profile);

      if (profile.role !== "admin") {
        setIsAuthorized(false);
        return;
      }

      setIsAuthorized(true);
    } catch (err) {
      router.push("/login");
    } finally {
      setCheckingAuth(false);
    }
  }

  async function createAgent() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setResult({ error: "Not authenticated" });
      return;
    }

    const normalizedWhatsappNumber = normalizeWhatsappNumber(whatsappNumber);

    const res = await fetch("/api/admin/agents/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email,
        full_name: name,
        role,
        whatsapp_number: normalizedWhatsappNumber || null,
      }),
    });

    const data = await res.json();
    setResult(data);

    if (res.ok) {
      setEmail("");
      setName("");
      setRole("agent");
      setWhatsappNumber("");
      loadAgents();
    }
  }

  async function loadAgents() {
    try {
      setLoadingAgents(true);
      setAgentsError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setAgentsError("Sessione non trovata");
        return;
      }

      const res = await fetch("/api/admin/agents/list", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setAgentsError(data.error || "Errore caricamento agenti");
        return;
      }

      setAgents(data.agents || []);
    } catch (err) {
      setAgentsError("Errore di connessione");
    } finally {
      setLoadingAgents(false);
    }
  }

  function startEdit(agent: Agent) {
    setEditingId(agent.id);
    setEditName(agent.full_name || "");
    setEditRole(
      agent.role === "manager" || agent.role === "agent" ? agent.role : "agent"
    );
    setEditWhatsappNumber(agent.whatsapp_number || "");
    setResult(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditRole("agent");
    setEditWhatsappNumber("");
  }

  async function saveAgent(agentId: string) {
    try {
      setActionLoadingId(agentId);
      setResult(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setResult({ error: "Not authenticated" });
        return;
      }

      const normalizedWhatsappNumber = normalizeWhatsappNumber(editWhatsappNumber);

      const res = await fetch("/api/admin/agents/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: agentId,
          full_name: editName,
          role: editRole,
          whatsapp_number: normalizedWhatsappNumber || null,
        }),
      });

      const data = await res.json();
      setResult(data);

      if (res.ok) {
        cancelEdit();
        loadAgents();
      }
    } catch (err) {
      setResult({ error: "Errore durante aggiornamento agente" });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function resetPassword(agentId: string, agentName: string) {
    const chosenPassword = window.prompt(
      `Inserisci la nuova password per "${agentName}".\n\nLascia vuoto per generarne una casuale.`
    );

    if (chosenPassword === null) return;

    try {
      setActionLoadingId(agentId);
      setResult(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setResult({ error: "Not authenticated" });
        return;
      }

      const res = await fetch("/api/admin/agents/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: agentId,
          new_password: chosenPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      setResult(data);

      if (res.ok && data?.new_password) {
        window.alert(
          `Password aggiornata con successo.\n\nNuova password per "${agentName}":\n${data.new_password}`
        );
      }
    } catch (err) {
      setResult({ error: "Errore durante reset password" });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function deleteAgent(agentId: string, agentName: string) {
    const confirmed = window.confirm(
      `⚠️ Eliminare definitivamente l'agente "${agentName}"?\n\nQuesta azione non può essere annullata.`
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(agentId);
      setResult(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setResult({ error: "Not authenticated", step: "missing_session_on_client" });
        return;
      }

      const res = await fetch("/api/admin/agents/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: agentId,
        }),
      });

      const data = await res.json();
      setResult(data);

      if (res.ok) {
        loadAgents();
      }
    } catch (err) {
      setResult({ error: "Errore di connessione durante eliminazione" });
    } finally {
      setActionLoadingId(null);
    }
  }

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadAgents();
    }
  }, [isAuthorized]);

  if (checkingAuth) {
    return <div style={{ padding: 40 }}>Controllo accesso...</div>;
  }

  if (!isAuthorized) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Accesso negato</h1>
        <p>Questa area è riservata agli admin.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Gestione Agenti</h1>

      {currentUser && (
        <p style={{ marginTop: 10 }}>
          Loggato come: <strong>{currentUser.full_name || currentUser.id}</strong>{" "}
          ({currentUser.role})
        </p>
      )}

      <div
        style={{
          marginTop: 20,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          placeholder="Email agente"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8, minWidth: 220 }}
        />

        <input
          placeholder="Nome agente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, minWidth: 220 }}
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ padding: 8 }}
        >
          <option value="agent">Agent</option>
          <option value="manager">Manager</option>
        </select>

        <input
          placeholder="Numero WhatsApp agente"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          style={{ padding: 8, minWidth: 220 }}
        />

        <button
          onClick={createAgent}
          style={{
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Crea agente
        </button>
      </div>

      {result?.message && (
        <div style={{ marginTop: 20, color: "green", fontWeight: 600 }}>
          {result.message}
        </div>
      )}

      {result?.error && (
        <div style={{ marginTop: 20, color: "red", fontWeight: 600 }}>
          {result.error}
        </div>
      )}

      {result?.new_password && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff7e6",
            border: "1px solid #ffd591",
            borderRadius: 10,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Nuova password temporanea
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              background: "#fff",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #eee",
              display: "inline-block",
            }}
          >
            {result.new_password}
          </div>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <h2>Agenti esistenti</h2>

        <button onClick={loadAgents} style={{ marginTop: 10, marginBottom: 20 }}>
          Aggiorna lista
        </button>

        {loadingAgents && <p>Caricamento agenti...</p>}

        {!loadingAgents && agentsError && (
          <p style={{ color: "red" }}>{agentsError}</p>
        )}

        {!loadingAgents && !agentsError && agents.length === 0 && (
          <p>Nessun agente trovato.</p>
        )}

        {!loadingAgents && !agentsError && agents.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 12,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Ruolo</th>
                <th style={thStyle}>WhatsApp</th>
                <th style={thStyle}>Creato il</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const normalizedRole = String(agent.role || "").trim().toLowerCase();
                const isAdmin = normalizedRole === "admin";
                const isEditing = editingId === agent.id;

                return (
                  <tr key={agent.id}>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ padding: 6, width: "100%" }}
                        />
                      ) : (
                        agent.full_name || "-"
                      )}
                    </td>

                    <td style={tdStyle}>
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          style={{ padding: 6 }}
                        >
                          <option value="agent">Agent</option>
                          <option value="manager">Manager</option>
                        </select>
                      ) : (
                        <>
                          {normalizedRole === "admin" && (
                            <span style={badgeAdminStyle}>ADMIN</span>
                          )}
                          {normalizedRole === "manager" && (
                            <span style={badgeManagerStyle}>MANAGER</span>
                          )}
                          {normalizedRole === "agent" && (
                            <span style={badgeAgentStyle}>AGENT</span>
                          )}
                          {!["admin", "manager", "agent"].includes(normalizedRole) && (
                            <span>{agent.role || "-"}</span>
                          )}
                        </>
                      )}
                    </td>

                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          value={editWhatsappNumber}
                          onChange={(e) => setEditWhatsappNumber(e.target.value)}
                          placeholder="Es. 393331234567"
                          style={{ padding: 6, width: "100%" }}
                        />
                      ) : (
                        agent.whatsapp_number || "-"
                      )}
                    </td>

                    <td style={tdStyle}>
                      {agent.created_at
                        ? new Date(agent.created_at).toLocaleString()
                        : "-"}
                    </td>

                    <td style={tdStyle}>
                      {isAdmin ? (
                        <span style={{ color: "#999" }}>—</span>
                      ) : isEditing ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => saveAgent(agent.id)}
                            disabled={actionLoadingId === agent.id}
                            style={smallButtonStyle}
                          >
                            {actionLoadingId === agent.id ? "Salvataggio..." : "Salva"}
                          </button>

                          <button onClick={cancelEdit} style={smallButtonStyle}>
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => startEdit(agent)}
                            disabled={actionLoadingId === agent.id}
                            style={smallButtonStyle}
                          >
                            Modifica
                          </button>

                          <button
                            onClick={() =>
                              resetPassword(agent.id, agent.full_name || "Senza nome")
                            }
                            disabled={actionLoadingId === agent.id}
                            style={smallButtonStyle}
                          >
                            Reset password
                          </button>

                          <button
                            onClick={() =>
                              deleteAgent(agent.id, agent.full_name || "Senza nome")
                            }
                            disabled={actionLoadingId === agent.id}
                            style={smallButtonStyle}
                          >
                            {actionLoadingId === agent.id ? "Eliminazione..." : "Elimina"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left" as const,
  background: "#f7f7f7",
};

const tdStyle = {
  border: "1px solid #ddd",
  padding: "10px",
  verticalAlign: "top" as const,
};

const smallButtonStyle = {
  padding: "6px 10px",
  cursor: "pointer",
};

const badgeAdminStyle = {
  background: "#ff4d4f",
  color: "white",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 700,
};

const badgeManagerStyle = {
  background: "#fa8c16",
  color: "white",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 700,
};

const badgeAgentStyle = {
  background: "#1677ff",
  color: "white",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 700,
};