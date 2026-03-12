import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════
// GROQ API — 100% GRATUITO, sin tarjeta de crédito
// Obtené tu key en: https://console.groq.com
// Modelo: llama-3.3-70b-versatile (gratis)
// Límite free tier: ~500k tokens/día
// ══════════════════════════════════════════════════

async function callGroq({ apiKey, system, messages, maxTokens = 900 }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── DEMO DATA ──────────────────────────────────────
const DEMO_PROJECTS = {
  "nova-commerce": {
    id: "nova-commerce",
    name: "Nova Commerce Platform",
    client: "RetailCo S.A.",
    color: "#6366f1",
    docs: [
      {
        id: "d1",
        name: "Stack técnico",
        type: "text",
        content: `Proyecto: Nova Commerce Platform | Cliente: RetailCo S.A.
Stack: Node.js, React, PostgreSQL, Redis, AWS EC2

PAGOS: Stripe v3 · webhook /api/payments/webhook · var STRIPE_SECRET · timeout 30s en config/payments.js · keys rotan 90 días
INVENTARIO: cron cada 5min · Redis TTL 300s · flush: redis-cli FLUSHDB · logs: logs/inventory-sync.log
REPORTES: pm2 "report-worker" · storage /storage/reports (chmod 755) · debug flag --debug
INFRA: AWS EC2 + PM2 · .env en raíz · monitoreo: pm2 monit
Deploy: 15 Feb 2025 (Milestone 4)`,
        uploadedAt: "2025-02-01",
      }
    ],
    tickets: [],
  },
};

const USERS = {
  admin:    { id: "admin",    name: "Admin",       role: "admin",  password: "admin123" },
  retailco: { id: "retailco", name: "RetailCo S.A.",role: "client", password: "client123", projectId: "nova-commerce" },
  guest:    { id: "guest",    name: "Visitante",   role: "guest",  password: "guest" },
};

// ── FILE PARSER ────────────────────────────────────
async function parseFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const name = file.name;
    const ext = name.split(".").pop().toLowerCase();

    if (["txt","md","js","ts","py","json","yaml","yml","html","css","sql","csv"].includes(ext)) {
      reader.onload = (e) => resolve({ name, content: e.target.result.slice(0, 40000), type: ext === "csv" ? "csv" : "text" });
      reader.readAsText(file);
    } else if (ext === "pdf") {
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target.result);
        let text = "";
        for (let i = 0; i < bytes.length; i++) {
          if (bytes[i] > 31 && bytes[i] < 127) text += String.fromCharCode(bytes[i]);
        }
        const readable = (text.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ\s,.:;!?()]{8,}/g) || []).join(" ");
        resolve({ name, content: `[PDF: ${name}]\n${readable.slice(0, 20000)}`, type: "pdf" });
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => resolve({ name, content: String(e.target.result || "").slice(0, 8000), type: "other" });
      reader.readAsText(file);
    }
  });
}

// ── SVG ICONS ──────────────────────────────────────
const Icons = {
  Send:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Bot:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>,
  User:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Upload:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  File:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Ticket:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10a10 10 0 0 0 7.07-2.93"/><path d="M12 22v-4m0-12V2M2 12h4m12 0h4"/></svg>,
  Link:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Trash:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Logout:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Alert:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Plus:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Key:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>,
  Zap:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
};

// ── MARKDOWN RENDERER ──────────────────────────────
function MD({ text }) {
  const html = String(text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code style="background:#1e293b;padding:1px 6px;border-radius:4px;font-size:12px;color:#7dd3fc;font-family:monospace">$1</code>`)
    .replace(/^### (.+)$/gm, `<div style="font-weight:700;font-size:13px;color:#94a3b8;margin-top:10px;text-transform:uppercase;letter-spacing:1px">$1</div>`)
    .replace(/^(\d+)\. (.+)$/gm, `<div style="margin:4px 0;padding-left:8px">$1. $2</div>`)
    .replace(/^- (.+)$/gm, `<div style="margin:3px 0;padding-left:8px">• $1</div>`)
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── LOADING DOTS ───────────────────────────────────
function Dots() {
  return (
    <span style={{ display: "flex", gap: 5, alignItems: "center", padding: "2px 0" }}>
      <style>{`@keyframes blink{0%,80%,100%{opacity:.15;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}`}</style>
      {[0,1,2].map(i => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#818cf8", display: "inline-block", animation: `blink 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
    </span>
  );
}

// ══════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════
export default function Sentinel() {
  // ── STATE ────────────────────────────────────────
  const [groqKey, setGroqKey] = useState(import.meta.env.VITE_GROQ_KEY || "");
  const [keyInput, setKeyInput]       = useState("");
  const [keyError, setKeyError]       = useState("");
  const [keyTesting, setKeyTesting]   = useState(false);

  const [user, setUser]               = useState(null);
  const [loginForm, setLoginForm]     = useState({ u: "", p: "" });
  const [loginErr, setLoginErr]       = useState("");

  const [view, setView]               = useState("chat");
  const [projects, setProjects]       = useState(DEMO_PROJECTS);
  const [activeProject, setActive]    = useState("nova-commerce");

  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [escalated, setEscalated]     = useState(false);
  const [steps, setSteps]             = useState(0);

  const [tab, setTab]                 = useState("upload");
  const [urlInput, setUrlInput]       = useState("");
  const [scriptTxt, setScriptTxt]     = useState("");
  const [newProjName, setNewProjName] = useState("");
  const [ticketReply, setTicketReply] = useState("");
  const [selectedTkt, setSelectedTkt] = useState(null);

  const fileRef     = useRef();
  const bottomRef   = useRef();
  const inputRef    = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const pid = user?.projectId || activeProject;
  const project = projects[pid];

  // ── TEST GROQ KEY ─────────────────────────────────
  const testKey = async () => {
    if (!keyInput.trim()) return;
    setKeyTesting(true);
    setKeyError("");
    try {
      await callGroq({
        apiKey: keyInput.trim(),
        system: "Respondé solo: OK",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
      });
      setGroqKey(keyInput.trim());
    } catch (e) {
      setKeyError("Key inválida o sin conexión. Verificá en console.groq.com");
    } finally {
      setKeyTesting(false);
    }
  };

  // ── LOGIN ─────────────────────────────────────────
  const login = (e) => {
    e.preventDefault();
    const u = USERS[loginForm.u.toLowerCase()];
    if (u && u.password === loginForm.p) {
      setUser(u);
      if (u.projectId) setActive(u.projectId);
      setView("chat");
      setMessages([{
        role: "assistant",
        content: u.role === "guest"
          ? "¡Hola! Soy **Sentinel** — tu asistente de soporte técnico.\n\nPodés preguntarme cualquier cosa técnica. ¿En qué puedo ayudarte?"
          : u.role === "client"
          ? `¡Hola, **${u.name}**! Tengo acceso a toda la documentación de **${projects[u.projectId]?.name}**. ¿Cuál es el problema?`
          : "¡Bienvenido, Admin! Panel completo activo.",
        escalated: false,
      }]);
    } else {
      setLoginErr("Usuario o contraseña incorrectos");
    }
  };

  // ── SYSTEM PROMPT ─────────────────────────────────
  const buildSystem = useCallback(() => {
    const docs = project?.docs?.length
      ? project.docs.map(d => `=== ${d.name} ===\n${d.content}`).join("\n\n")
      : null;

    if (!user || user.role === "guest") {
      return "Sos Sentinel, asistente técnico de soporte. Respondé en español, de forma clara y técnica. Máximo 3 pasos por respuesta. Si el problema no se resuelve en 3 intentos, comenzá tu respuesta con ESCALAR_N2 y el resumen del problema.";
    }
    return `Sos Sentinel, asistente de soporte post-entrega para "${project?.name || pid}".

REGLAS:
- Español, técnico y conciso
- Máximo 3 pasos por respuesta
- Basate en la documentación del proyecto
- Si el problema persiste después de 3 intentos, comenzá con ESCALAR_N2 seguido del resumen técnico

${docs ? `DOCUMENTACIÓN DEL PROYECTO:\n${docs}` : "No hay documentación cargada. Respondé con conocimiento técnico general."}`;
  }, [project, user, pid]);

  // ── SEND MESSAGE ──────────────────────────────────
  const send = async () => {
    if (!input.trim() || loading || escalated) return;
    const msg = input.trim();
    setInput("");
    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }));
      const reply = await callGroq({ apiKey: groqKey, system: buildSystem(), messages: apiMsgs });
      const newStep = steps + 1;
      setSteps(newStep);

      if (reply.startsWith("ESCALAR_N2")) {
        const summary = reply.replace("ESCALAR_N2", "").trim();
        const tkt = makeTicket(summary, newMsgs);
        setMessages(p => [...p, {
          role: "assistant",
          content: `⚠️ **Caso escalado al equipo N2**\n\n${summary}\n\n*Ticket: **${tkt.id}***`,
          escalated: true,
          ticketId: tkt.id,
        }]);
        setEscalated(true);
      } else {
        setMessages(p => [...p, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      setMessages(p => [...p, { role: "assistant", content: `❌ Error: ${err.message}`, error: true }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // ── TICKET ────────────────────────────────────────
  const makeTicket = (summary, conv) => {
    const tkt = {
      id: "TKT-" + String(Date.now()).slice(-4),
      projectId: pid, summary, conversation: [...conv],
      status: "open", severity: "high",
      createdAt: new Date().toISOString(),
    };
    setProjects(p => ({ ...p, [pid]: { ...p[pid], tickets: [...(p[pid]?.tickets || []), tkt] } }));
    return tkt;
  };

  const resolveTicket = (tId, resolution) => {
    setProjects(p => ({
      ...p,
      [pid]: {
        ...p[pid],
        tickets: p[pid].tickets.map(t => t.id === tId ? { ...t, status: "resolved", resolution, resolvedAt: new Date().toISOString() } : t),
      },
    }));
    setSelectedTkt(null);
  };

  const suggestReply = async (tkt) => {
    setLoading(true);
    try {
      const conv = tkt.conversation.map(m => `${m.role === "user" ? "CLIENTE" : "SENTINEL"}: ${m.content}`).join("\n");
      const r = await callGroq({
        apiKey: groqKey,
        system: "Sos un agente técnico senior. Respondé en español, de forma concisa y accionable.",
        messages: [{ role: "user", content: `Generá una respuesta técnica para este ticket.\n\nPROBLEMA: ${tkt.summary}\n\nCONVERSACIÓN:\n${conv}\n\nSolo el texto de la respuesta.` }],
        maxTokens: 400,
      });
      setTicketReply(r);
    } finally {
      setLoading(false);
    }
  };

  // ── DOCS ──────────────────────────────────────────
  const uploadFiles = async (files) => {
    for (const file of Array.from(files)) {
      const parsed = await parseFile(file);
      const doc = { id: Date.now() + Math.random(), ...parsed, uploadedAt: new Date().toISOString().split("T")[0] };
      setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: [...(p[pid]?.docs || []), doc] } }));
    }
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    const doc = { id: Date.now(), name: urlInput, type: "url", content: `[Fuente web: ${urlInput}]\nURL indexada como referencia de conocimiento para este proyecto.`, uploadedAt: new Date().toISOString().split("T")[0] };
    setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: [...(p[pid]?.docs || []), doc] } }));
    setUrlInput("");
  };

  const addScript = () => {
    if (!scriptTxt.trim()) return;
    const doc = { id: Date.now(), name: "Texto / Script", type: "text", content: scriptTxt, uploadedAt: new Date().toISOString().split("T")[0] };
    setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: [...(p[pid]?.docs || []), doc] } }));
    setScriptTxt("");
  };

  const deleteDoc = (dId) => {
    setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: p[pid].docs.filter(d => d.id !== dId) } }));
  };

  const addProject = () => {
    if (!newProjName.trim()) return;
    const id = newProjName.toLowerCase().replace(/\s+/g, "-");
    setProjects(p => ({ ...p, [id]: { id, name: newProjName, docs: [], tickets: [], client: "Nuevo cliente" } }));
    setActive(id);
    setNewProjName("");
  };

  // ── TYPE COLORS ───────────────────────────────────
  const typeColor = { pdf: "#ef4444", csv: "#10b981", text: "#6366f1", url: "#f59e0b", excel: "#059669", other: "#8b5cf6" };
  const typeLabel = { pdf: "PDF", csv: "CSV", text: "TXT", url: "URL", excel: "XLS", other: "DOC" };

  // ── ALL TICKETS ───────────────────────────────────
  const allTickets = Object.values(projects).flatMap(p => (p.tickets || []).map(t => ({ ...t, projectName: p.name })));

  // ════════════════════════════════════════════════
  // SCREEN 1: KEY SETUP
  // ════════════════════════════════════════════════
  if (!groqKey) return (
    <div style={S.bg}>
      <div style={S.keyCard}>
        <div style={S.logoRow}>
          <div style={S.logoBox}>S</div>
          <div>
            <div style={S.logoTitle}>SENTINEL</div>
            <div style={S.logoSub}>Support Intelligence · Powered by Groq</div>
          </div>
        </div>

        <div style={S.groqBanner}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icons.Zap />
            <strong style={{ color: "#fbbf24" }}>Groq API — 100% GRATUITO</strong>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            Sin tarjeta de crédito · Sin límite de tiempo · 500k tokens/día
            <br/>Modelo: <code style={{ color: "#7dd3fc" }}>llama-3.3-70b-versatile</code> (top open-source)
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={S.label}>
            <Icons.Key /> &nbsp;Tu API Key de Groq
          </label>
          <input
            style={S.input}
            placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && testKey()}
            type="password"
          />
          {keyError && <div style={S.errMsg}>{keyError}</div>}
          <button onClick={testKey} disabled={keyTesting || !keyInput.trim()} style={S.bigBtn}>
            {keyTesting ? "Verificando..." : "Conectar y entrar →"}
          </button>
        </div>

        <div style={S.stepBox}>
          <div style={S.stepTitle}>¿Cómo obtener tu key gratis?</div>
          {[
            ["1", "Entrá a", "console.groq.com", "https://console.groq.com"],
            ["2", "Registrate (solo email, sin tarjeta)"],
            ["3", 'Ir a "API Keys" → "Create API Key"'],
            ["4", "Pegá la key acá y listo"],
          ].map(([n, text, link, href]) => (
            <div key={n} style={S.step}>
              <div style={S.stepNum}>{n}</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                {text} {link && <a href={href} target="_blank" rel="noreferrer" style={{ color: "#818cf8", textDecoration: "none" }}>{link}</a>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#475569", textAlign: "center", marginTop: 8 }}>
          La key nunca se guarda en ningún servidor. Solo vive en tu sesión.
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════
  // SCREEN 2: LOGIN
  // ════════════════════════════════════════════════
  if (!user) return (
    <div style={S.bg}>
      <div style={{ ...S.keyCard, maxWidth: 380 }}>
        <div style={S.logoRow}>
          <div style={S.logoBox}>S</div>
          <div>
            <div style={S.logoTitle}>SENTINEL</div>
            <div style={{ fontSize: 11, color: "#10b981" }}>● Groq conectado — listo</div>
          </div>
        </div>

        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={S.label}>Usuario</label>
            <input style={S.input} placeholder="admin / retailco / guest" value={loginForm.u} onChange={e => setLoginForm(f => ({ ...f, u: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Contraseña</label>
            <input style={S.input} type="password" placeholder="••••••••" value={loginForm.p} onChange={e => setLoginForm(f => ({ ...f, p: e.target.value }))} />
          </div>
          {loginErr && <div style={S.errMsg}>{loginErr}</div>}
          <button type="submit" style={S.bigBtn}>Ingresar →</button>
        </form>

        <div style={S.stepBox}>
          <div style={S.stepTitle}>Usuarios demo</div>
          {[
            ["#6366f1", "admin", "admin123", "Admin — acceso total"],
            ["#10b981", "retailco", "client123", "Cliente — módulo propio"],
            ["#8b5cf6", "guest", "guest", "Visitante — chat general"],
          ].map(([c, u, p, desc]) => (
            <div key={u} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ background: c, color: "white", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4 }}>{u}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{p} — {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════
  // SCREEN 3: MAIN APP
  // ════════════════════════════════════════════════
  const navItems = [
    { key: "chat",    label: "Chat",    Icon: Icons.Bot },
    ...(user.role !== "guest" ? [{ key: "docs",    label: "Docs",    Icon: Icons.File }] : []),
    ...(user.role !== "guest" ? [{ key: "tickets", label: "Tickets", Icon: Icons.Ticket }] : []),
    ...(user.role === "admin" ? [{ key: "admin",   label: "Admin",   Icon: Icons.Settings }] : []),
  ];

  return (
    <div style={S.app}>
      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.sideLogoRow}>
          <div style={S.logoBox}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#f1f5f9", letterSpacing: 1 }}>SENTINEL</div>
            <div style={{ fontSize: 10, color: "#10b981" }}>● Groq · llama-3.3-70b</div>
          </div>
        </div>

        {project && (
          <div style={S.projBadge}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: project.color || "#6366f1", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.3 }}>{project.name}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{project.client || "General"}</div>
            </div>
          </div>
        )}

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setView(key)}
              style={{ ...S.navBtn, ...(view === key ? S.navActive : {}) }}>
              <Icon /> {label}
            </button>
          ))}
        </nav>

        <div style={S.sideBottom}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
            <div style={S.avatar}>{user.name[0]}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>{user.role}</div>
            </div>
          </div>
          <button onClick={() => { setUser(null); setMessages([]); }} style={S.iconBtn}><Icons.Logout /></button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main}>

        {/* ── CHAT ── */}
        {view === "chat" && (
          <div style={S.chatWrap}>
            <div style={S.chatHead}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>
                  {project ? project.name : "Chat General"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {user.role === "guest" ? "Asistente general" : `${project?.docs?.length || 0} docs indexados`}
                  {" · "}{steps} turnos
                </div>
              </div>
              <button onClick={() => { setMessages([{ role: "assistant", content: "Chat reiniciado. ¿En qué puedo ayudarte?" }]); setSteps(0); setEscalated(false); }} style={S.smBtn}>
                Nuevo chat
              </button>
            </div>

            <div style={S.msgs}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                  {m.role === "assistant" && (
                    <div style={{ ...S.ava, background: m.escalated ? "#7f1d1d" : "#312e81" }}>
                      {m.escalated ? <Icons.Alert /> : <Icons.Bot />}
                    </div>
                  )}
                  <div style={{
                    maxWidth: "72%", padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.65,
                    ...(m.role === "user"
                      ? { background: "#4f46e5", color: "white", borderBottomRightRadius: 4 }
                      : { background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderBottomLeftRadius: 4 }),
                    ...(m.escalated ? { borderColor: "#dc2626" } : {}),
                    ...(m.error ? { borderColor: "#f43f5e", color: "#fca5a5" } : {}),
                  }}>
                    <MD text={m.content} />
                    {m.ticketId && (
                      <div onClick={() => setView("tickets")} style={{ marginTop: 8, fontSize: 11, color: "#818cf8", cursor: "pointer", textDecoration: "underline" }}>
                        🎫 Ver {m.ticketId}
                      </div>
                    )}
                  </div>
                  {m.role === "user" && <div style={{ ...S.ava, background: "#1e3a5f" }}><Icons.User /></div>}
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ ...S.ava, background: "#312e81" }}><Icons.Bot /></div>
                  <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, borderBottomLeftRadius: 4, padding: "10px 14px" }}>
                    <Dots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={S.inputRow}>
              {escalated ? (
                <div style={{ flex: 1, textAlign: "center", color: "#f87171", fontSize: 13, fontWeight: 600 }}>
                  ⚠️ Caso escalado al equipo N2. Revisá la sección Tickets.
                </div>
              ) : (
                <>
                  <textarea
                    ref={inputRef}
                    rows={2}
                    style={S.ta}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Describí el problema técnico... (Enter para enviar, Shift+Enter nueva línea)"
                  />
                  <button onClick={send} disabled={loading || !input.trim()} style={S.sendBtn}>
                    <Icons.Send />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── DOCS ── */}
        {view === "docs" && user.role !== "guest" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={S.panelH}>Base de Conocimiento</h2>
              <p style={S.panelSub}>Cargá documentación del proyecto para que Sentinel responda con precisión</p>
            </div>

            {user.role === "admin" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
                <label style={{ ...S.label, margin: 0 }}>Proyecto:</label>
                <select value={activeProject} onChange={e => setActive(e.target.value)} style={S.select}>
                  {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {[["upload","📎 Archivo"],["url","🔗 URL"],["script","📝 Texto"]].map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabActive : {}) }}>{l}</button>
              ))}
            </div>

            {tab === "upload" && (
              <div
                style={S.dropzone}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
              >
                <Icons.Upload />
                <div style={{ marginTop: 10, fontWeight: 600, color: "#94a3b8", fontSize: 14 }}>Arrastrá archivos o hacé click</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>PDF · CSV · TXT · MD · JSON · YAML · JS · SQL · Excel</div>
                <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => uploadFiles(e.target.files)} />
              </div>
            )}

            {tab === "url" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "8px 12px", alignItems: "center" }}>
                <Icons.Link />
                <input style={{ ...S.input, flex: 1, margin: 0, background: "transparent", border: "none", padding: "4px 0" }}
                  placeholder="https://docs.proyecto.com, Confluence, Notion, GitHub..." value={urlInput}
                  onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addUrl()} />
                <button onClick={addUrl} style={S.smBtn}>Agregar</button>
              </div>
            )}

            {tab === "script" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <textarea style={{ ...S.ta, minHeight: 140, borderRadius: 10 }}
                  placeholder="Pegá texto, JSON, scripts, changelogs, notas técnicas..."
                  value={scriptTxt} onChange={e => setScriptTxt(e.target.value)} />
                <button onClick={addScript} style={S.smBtn}>Agregar a la KB</button>
              </div>
            )}

            <div style={S.docList}>
              <div style={S.docListHdr}>
                Documentos — {(project?.docs || []).length}
              </div>
              {(project?.docs || []).map(doc => (
                <div key={doc.id} style={S.docItem}>
                  <span style={{ background: typeColor[doc.type] || "#6366f1", color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3 }}>
                    {typeLabel[doc.type] || "DOC"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{doc.uploadedAt} · {doc.content.length.toLocaleString()} chars</div>
                  </div>
                  <button onClick={() => deleteDoc(doc.id)} style={S.iconBtn}><Icons.Trash /></button>
                </div>
              ))}
              {!(project?.docs?.length) && (
                <div style={{ padding: 32, textAlign: "center", color: "#475569", fontSize: 13 }}>
                  Sin documentos aún — subí algo para empezar
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TICKETS ── */}
        {view === "tickets" && user.role !== "guest" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={S.panelH}>Tickets N2</h2>
              <p style={S.panelSub}>Casos escalados para resolución por equipo técnico</p>
            </div>

            {selectedTkt ? (
              <div>
                <button onClick={() => { setSelectedTkt(null); setTicketReply(""); }} style={S.smBtn}>← Volver</button>
                <div style={{ ...S.tktCard, cursor: "default", marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: "#818cf8" }}>{selectedTkt.id}</span>
                    <span style={{ ...S.badge, background: selectedTkt.status === "open" ? "#b91c1c" : "#065f46" }}>
                      {selectedTkt.status === "open" ? "Abierto" : "Resuelto"}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 8 }}>{selectedTkt.summary}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{new Date(selectedTkt.createdAt).toLocaleString("es-AR")} · {selectedTkt.projectName}</div>
                </div>

                <div style={{ ...S.docList, marginTop: 16 }}>
                  <div style={S.docListHdr}>Conversación</div>
                  {selectedTkt.conversation?.map((m, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: m.role === "user" ? "#818cf8" : "#34d399", textTransform: "uppercase", marginBottom: 2 }}>
                        {m.role === "user" ? "Cliente" : "Sentinel"}
                      </div>
                      <div style={{ fontSize: 13, color: "#cbd5e1" }}>{m.content}</div>
                    </div>
                  ))}
                </div>

                {selectedTkt.status === "open" && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={() => suggestReply(selectedTkt)} disabled={loading} style={S.smBtn}>
                      {loading ? "Generando..." : "✨ Sugerir respuesta con IA"}
                    </button>
                    {ticketReply && <textarea style={{ ...S.ta, minHeight: 100 }} value={ticketReply} onChange={e => setTicketReply(e.target.value)} />}
                    <button onClick={() => resolveTicket(selectedTkt.id, ticketReply || "Resuelto por agente N2")}
                      style={{ ...S.smBtn, background: "#065f46", borderColor: "#10b981" }}>
                      <Icons.Check /> Cerrar ticket como resuelto
                    </button>
                  </div>
                )}
                {selectedTkt.status === "resolved" && (
                  <div style={{ marginTop: 16, padding: 14, background: "#052e16", border: "1px solid #166534", borderRadius: 10, fontSize: 13, color: "#86efac" }}>
                    ✅ Resuelto: {selectedTkt.resolution}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(tkt => (
                  <div key={tkt.id} style={S.tktCard} onClick={() => { setSelectedTkt(tkt); setTicketReply(""); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ ...S.badge, background: tkt.status === "open" ? "#b91c1c" : "#065f46" }}>
                          {tkt.status === "open" ? "Abierto" : "Resuelto"}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>{tkt.id}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#475569" }}>{tkt.projectName}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>{tkt.summary.slice(0, 100)}{tkt.summary.length > 100 ? "..." : ""}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{new Date(tkt.createdAt).toLocaleString("es-AR")}</div>
                  </div>
                ))}
                {!allTickets.length && (
                  <div style={{ padding: 48, textAlign: "center", color: "#475569", fontSize: 13 }}>
                    No hay tickets escalados aún — eso es una buena señal 🎉
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN ── */}
        {view === "admin" && user.role === "admin" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={S.panelH}>Administración</h2>
              <p style={S.panelSub}>Gestioná proyectos y módulos de clientes</p>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Crear proyecto</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...S.input, flex: 1 }} placeholder="Nombre del proyecto" value={newProjName} onChange={e => setNewProjName(e.target.value)} onKeyDown={e => e.key === "Enter" && addProject()} />
                <button onClick={addProject} style={S.smBtn}><Icons.Plus /> Crear</button>
              </div>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Proyectos ({Object.keys(projects).length})</div>
              {Object.values(projects).map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#1e293b", borderRadius: 10, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color || "#6366f1" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{p.docs?.length || 0} docs · {p.tickets?.filter(t => t.status === "open")?.length || 0} tickets abiertos</div>
                  </div>
                  <button onClick={() => { setActive(p.id); setView("docs"); }} style={S.smBtn}>Gestionar →</button>
                </div>
              ))}
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Integraciones de datos</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["📄","PDF","✓ Activo"],["📊","CSV / Excel","✓ Activo"],
                  ["📝","Texto / Script","✓ Activo"],["🔗","URL / Web","✓ Activo"],
                  ["🎯","Jira","Próximamente"],["📚","Confluence","Próximamente"],
                  ["⚡","Notion","Próximamente"],["✅","ClickUp","Próximamente"],
                ].map(([icon, name, status]) => (
                  <div key={name} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{name}</div>
                      <div style={{ fontSize: 11, color: status.includes("✓") ? "#10b981" : "#475569" }}>{status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>API en uso</div>
              <div style={{ padding: 14, background: "#0f2240", border: "1px solid #1d4ed8", borderRadius: 10, fontSize: 13, color: "#93c5fd" }}>
                <strong>Groq Cloud</strong> · llama-3.3-70b-versatile · Free tier activo<br/>
                <span style={{ fontSize: 11, color: "#60a5fa" }}>~500k tokens/día · Sin cargo · Sin tarjeta</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── STYLES ─────────────────────────────────────────
const S = {
  bg:          { minHeight: "100vh", background: "#060b18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" },
  keyCard:     { background: "#0d1526", border: "1px solid #1e293b", borderRadius: 18, padding: "36px 40px", width: 460, maxWidth: "95vw", boxShadow: "0 0 80px rgba(99,102,241,0.12)" },
  logoRow:     { display: "flex", alignItems: "center", gap: 14, marginBottom: 28 },
  logoBox:     { width: 42, height: 42, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "white", letterSpacing: -1 },
  logoTitle:   { fontWeight: 800, fontSize: 18, color: "#f1f5f9", letterSpacing: 3 },
  logoSub:     { fontSize: 11, color: "#475569", marginTop: 2 },
  groqBanner:  { background: "#1a1205", border: "1px solid #78350f", borderRadius: 10, padding: "14px 16px", marginBottom: 24 },
  label:       { fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4, marginBottom: 6 },
  input:       { width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  errMsg:      { color: "#f87171", fontSize: 12, background: "rgba(248,113,113,0.08)", padding: "8px 12px", borderRadius: 6 },
  bigBtn:      { background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 8, padding: "12px", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" },
  stepBox:     { background: "#1e293b", borderRadius: 10, padding: "16px", marginTop: 20 },
  stepTitle:   { fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  step:        { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  stepNum:     { width: 20, height: 20, borderRadius: "50%", background: "#4f46e5", color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  app:         { display: "flex", height: "100vh", background: "#060b18", fontFamily: "'IBM Plex Mono', 'Fira Code', monospace", overflow: "hidden" },
  sidebar:     { width: 230, background: "#0d1526", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "18px 10px" },
  sideLogoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #1e293b" },
  projBadge:   { background: "#1e293b", borderRadius: 8, padding: "10px 12px", marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start" },
  navBtn:      { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 7, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500 },
  navActive:   { background: "#1e3a5f", color: "#818cf8" },
  sideBottom:  { borderTop: "1px solid #1e293b", paddingTop: 14, display: "flex", alignItems: "center", gap: 6 },
  avatar:      { width: 30, height: 30, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#818cf8" },
  iconBtn:     { background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" },
  main:        { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  chatWrap:    { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
  chatHead:    { padding: "14px 22px", borderBottom: "1px solid #1e293b", background: "#0d1526", display: "flex", justifyContent: "space-between", alignItems: "center" },
  msgs:        { flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 },
  ava:         { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white" },
  inputRow:    { padding: "14px 22px", borderTop: "1px solid #1e293b", background: "#0d1526", display: "flex", gap: 8 },
  ta:          { flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, resize: "none", fontFamily: "inherit", outline: "none" },
  sendBtn:     { background: "#4f46e5", border: "none", borderRadius: 10, padding: "10px 14px", color: "white", cursor: "pointer", display: "flex", alignItems: "center" },
  smBtn:       { background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "7px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 },
  panel:       { flex: 1, overflowY: "auto", padding: 28 },
  panelH:      { fontSize: 20, fontWeight: 800, color: "#f1f5f9", margin: 0 },
  panelSub:    { fontSize: 13, color: "#475569", marginTop: 4 },
  select:      { background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "7px 12px", color: "#f1f5f9", fontSize: 13, fontFamily: "inherit" },
  tab:         { padding: "7px 14px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  tabActive:   { background: "#1e293b", color: "#818cf8", borderColor: "#4f46e5" },
  dropzone:    { border: "2px dashed #334155", borderRadius: 12, padding: 30, textAlign: "center", cursor: "pointer", color: "#475569", marginBottom: 18 },
  docList:     { background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" },
  docListHdr:  { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #1e293b" },
  docItem:     { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #1e293b" },
  tktCard:     { background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, padding: 14, cursor: "pointer" },
  badge:       { padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "white" },
  section:     { background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, padding: 18, marginBottom: 14 },
  sectionTitle:{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
};
