import { useState, useRef, useEffect, useCallback } from "react";

// ── GROQ API ────────────────────────────────────────────────
async function callGroq({ apiKey, system, messages, maxTokens = 700 }) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: "system", content: system }, ...messages.slice(-3)],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content?.trim() || "";
}

// ── FILE PARSER ──────────────────────────────────────────────
async function parseFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const name = file.name;
    const ext = name.split(".").pop().toLowerCase();
    if (["txt","md","js","ts","py","json","yaml","yml","html","css","sql","csv"].includes(ext)) {
      reader.onload = e => resolve({ name, content: e.target.result.slice(0, 30000), type: ext === "csv" ? "csv" : "text" });
      reader.readAsText(file);
    } else if (ext === "pdf") {
      reader.onload = e => {
        const bytes = new Uint8Array(e.target.result);
        let t = "";
        for (let i = 0; i < bytes.length; i++) if (bytes[i] > 31 && bytes[i] < 127) t += String.fromCharCode(bytes[i]);
        const readable = (t.match(/[a-zA-Z0-9áéíóú\s,.:;!?()\-]{8,}/g) || []).join(" ");
        resolve({ name, content: `[PDF: ${name}]\n${readable.slice(0, 2000)}`, type: "pdf" });
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = e => resolve({ name, content: String(e.target.result || "").slice(0, 5000), type: "other" });
      reader.readAsText(file);
    }
  });
}

// ── DEMO DATA ────────────────────────────────────────────────
const DEMO_PROJECTS = {
  "nova-commerce": {
    id: "nova-commerce", name: "Nova Commerce Platform", client: "RetailCo Inc.",
    color: "#6366f1", status: "on-track", health: 87, budget: 120000, spent: 94000,
    startDate: "2025-01-15", dueDate: "2025-06-30",
    milestones: [
      { id: "m1", name: "Discovery & Architecture", due: "2025-02-15", status: "done" },
      { id: "m2", name: "Core Backend APIs", due: "2025-03-30", status: "done" },
      { id: "m3", name: "Frontend MVP", due: "2025-04-30", status: "in-progress" },
      { id: "m4", name: "Integrations & Testing", due: "2025-05-31", status: "pending" },
      { id: "m5", name: "Launch & Handoff", due: "2025-06-30", status: "pending" },
    ],
    team: ["Alex Rivera", "Sam Chen", "Jordan Lee", "Taylor Kim"],
    docs: [{
      id: "d1", name: "Tech Stack & Runbook", type: "text", source: "manual",
      content: `Project: Nova Commerce Platform | Client: RetailCo Inc.
Stack: Node.js 20, React 18, PostgreSQL 15, Redis 7, AWS EC2 t3.medium
PAYMENTS: Stripe v3 · webhook /api/payments/webhook · STRIPE_SECRET env var · 30s timeout · keys rotate every 90 days
INVENTORY: cron every 5min · Redis TTL 300s · flush: redis-cli FLUSHDB · logs: logs/inventory-sync.log
REPORTS: pm2 "report-worker" · storage /storage/reports (chmod 755)
INFRA: AWS EC2 + PM2 · .env at root · monitoring: pm2 monit · deploy: ./scripts/deploy.sh`,
      uploadedAt: "2025-02-01",
    }],
    tickets: [],
    activity: [
      { type: "commit", text: "feat: add Stripe webhook handler", user: "Alex Rivera", time: "2h ago" },
      { type: "task", text: "Frontend MVP — Sprint 4 started", user: "Sam Chen", time: "5h ago" },
      { type: "message", text: "Client approved design mockups", user: "Jordan Lee", time: "1d ago" },
    ],
  },
  "fleet-tracker": {
    id: "fleet-tracker", name: "Fleet Tracker 360", client: "LogiCorp SA",
    color: "#10b981", status: "at-risk", health: 61, budget: 85000, spent: 71000,
    startDate: "2025-02-01", dueDate: "2025-07-15",
    milestones: [
      { id: "m1", name: "GPS Integration Layer", due: "2025-03-01", status: "done" },
      { id: "m2", name: "Real-time Dashboard", due: "2025-04-15", status: "at-risk" },
      { id: "m3", name: "Mobile App Beta", due: "2025-05-30", status: "pending" },
      { id: "m4", name: "Reporting Module", due: "2025-06-30", status: "pending" },
    ],
    team: ["Morgan Walsh", "Casey Park"],
    docs: [{
      id: "d2", name: "Architecture Overview", type: "text", source: "manual",
      content: `Project: Fleet Tracker 360 | Client: LogiCorp SA
Stack: Python FastAPI, React Native, PostgreSQL, Redis, Google Maps API
GPS: WebSocket stream · update every 30s · fallback to polling
ALERTS: Celery workers · Redis broker · email via SendGrid
MOBILE: React Native 0.73 · Expo · TestFlight for iOS beta`,
      uploadedAt: "2025-02-10",
    }],
    tickets: [{
      id: "TKT-0012", summary: "Real-time map not updating after 10min idle",
      status: "open", severity: "high", createdAt: "2025-04-10T10:00:00Z",
      conversation: [{ role: "user", content: "Map stops updating after 10 minutes of idle" }],
    }],
    activity: [
      { type: "alert", text: "Milestone 2 at risk — 3 tasks overdue", user: "System", time: "30m ago" },
      { type: "commit", text: "fix: websocket reconnection logic", user: "Morgan Walsh", time: "3h ago" },
    ],
  },
  "hr-portal": {
    id: "hr-portal", name: "HR Self-Service Portal", client: "Internal — Dramhost",
    color: "#f59e0b", status: "on-track", health: 92, budget: 45000, spent: 28000,
    startDate: "2025-03-01", dueDate: "2025-07-01",
    milestones: [
      { id: "m1", name: "Auth & Roles", due: "2025-03-31", status: "done" },
      { id: "m2", name: "Leave Management", due: "2025-04-30", status: "done" },
      { id: "m3", name: "Payroll Integration", due: "2025-05-31", status: "in-progress" },
    ],
    team: ["Riley Johnson", "Drew Martinez"],
    docs: [],
    tickets: [],
    activity: [
      { type: "task", text: "Payroll API integration — 70% complete", user: "Riley Johnson", time: "1h ago" },
    ],
  },
};

const USERS = {
  // Admin
  admin:   { id: "admin",   name: "Alex Admin",     role: "admin",    password: "admin123",  avatar: "AA", color: "#6366f1" },
  // Internal by area
  pm:      { id: "pm",      name: "Sam PM",          role: "internal", area: "pm",       password: "pm123",      avatar: "SP", color: "#8b5cf6" },
  hr:      { id: "hr",      name: "Jordan HR",       role: "internal", area: "hr",       password: "hr123",      avatar: "JH", color: "#f59e0b" },
  finance: { id: "finance", name: "Taylor Finance",  role: "internal", area: "finance",  password: "finance123", avatar: "TF", color: "#10b981" },
  support: { id: "support", name: "Morgan Support",  role: "internal", area: "support",  password: "support123", avatar: "MS", color: "#ef4444" },
  // Clients
  retailco: { id: "retailco", name: "RetailCo Inc.", role: "client", password: "client123", projectId: "nova-commerce", avatar: "RC", color: "#6366f1" },
  logicorp: { id: "logicorp", name: "LogiCorp SA",   role: "client", password: "logi123",   projectId: "fleet-tracker", avatar: "LC", color: "#10b981" },
};

const AREA_CONFIG = {
  pm:      { label: "Project Management", icon: "📋", color: "#8b5cf6", desc: "Sprints, milestones, team velocity" },
  hr:      { label: "Human Resources",    icon: "👥", color: "#f59e0b", desc: "Team hours, headcount, leave" },
  finance: { label: "Finance",            icon: "💰", color: "#10b981", desc: "Budgets, costs, invoicing" },
  support: { label: "Support N2",         icon: "🛠", color: "#ef4444", desc: "Tickets, incidents, escalations" },
};

// ── ICONS ────────────────────────────────────────────────────
const I = {
  Send:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Bot:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>,
  User:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  File:     () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Upload:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  Ticket:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>,
  Settings:() => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10a10 10 0 0 0 7.07-2.93"/><path d="M12 22v-4m0-12V2M2 12h4m12 0h4"/></svg>,
  Logout:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Trash:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Plus:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Home:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Link:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Zap:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Chart:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Globe:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Key:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>,
};

function MD({ text }) {
  const html = String(text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, `<code style="background:#1e293b;padding:1px 5px;border-radius:3px;font-size:11px;color:#7dd3fc">$1</code>`)
    .replace(/^(\d+)\. (.+)$/gm, `<div style="margin:3px 0;padding-left:6px">$1. $2</div>`)
    .replace(/^- (.+)$/gm, `<div style="margin:2px 0;padding-left:6px">• $1</div>`)
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function Dots() {
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <style>{`@keyframes bl{0%,80%,100%{opacity:.15;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}`}</style>
      {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block", animation: `bl 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
    </span>
  );
}

function Avatar({ user, size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: user.color || "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "white", flexShrink: 0 }}>
      {user.avatar || user.name?.[0]}
    </div>
  );
}

function HealthBar({ value, width = 80 }) {
  const color = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width, height: 5, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700 }}>{value}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    "on-track":    { label: "On Track",    bg: "#052e16", color: "#10b981", border: "#166534" },
    "at-risk":     { label: "At Risk",     bg: "#451a03", color: "#f59e0b", border: "#78350f" },
    "off-track":   { label: "Off Track",   bg: "#450a0a", color: "#ef4444", border: "#7f1d1d" },
    "done":        { label: "Done",        bg: "#052e16", color: "#10b981", border: "#166534" },
    "in-progress": { label: "In Progress", bg: "#1e1b4b", color: "#818cf8", border: "#312e81" },
    "pending":     { label: "Pending",     bg: "#1e293b", color: "#64748b", border: "#334155" },
    "open":        { label: "Open",        bg: "#450a0a", color: "#ef4444", border: "#7f1d1d" },
    "resolved":    { label: "Resolved",    bg: "#052e16", color: "#10b981", border: "#166534" },
  };
  const c = cfg[status] || cfg["pending"];
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{c.label}</span>;
}

// ── LANG TOGGLE ──────────────────────────────────────────────
function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: "flex", gap: 2, background: "#1e293b", borderRadius: 6, padding: 2 }}>
      {["en","es"].map(l => (
        <button key={l} onClick={() => setLang(l)} style={{ padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", background: lang === l ? "#4f46e5" : "transparent", color: lang === l ? "white" : "#64748b" }}>
          {l === "es" ? "🇦🇷 ES" : "🇺🇸 EN"}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════
export default function Sentinel() {
  const [lang, setLang]             = useState("en");
  const [groqKey, setGroqKey]       = useState(import.meta.env.VITE_GROQ_KEY || "");
  const [keyInput, setKeyInput]     = useState("");
  const [keyError, setKeyError]     = useState("");
  const [keyTesting, setKeyTesting] = useState(false);

  const [user, setUser]             = useState(null);
  const [loginForm, setLoginForm]   = useState({ u: "", p: "" });
  const [loginErr, setLoginErr]     = useState("");

  const [view, setView]             = useState("dashboard");
  const [projects, setProjects]     = useState(DEMO_PROJECTS);
  const [activeProject, setActive]  = useState("nova-commerce");

  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [escalated, setEscalated]   = useState(false);

  const [docTab, setDocTab]         = useState("manual");
  const [urlInput, setUrlInput]     = useState("");
  const [scriptTxt, setScriptTxt]   = useState("");
  const [selectedTkt, setSelectedTkt] = useState(null);
  const [tktReply, setTktReply]     = useState("");
  const [newProjName, setNewProjName] = useState("");

  const fileRef   = useRef();
  const bottomRef = useRef();
  const inputRef  = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const pid     = user?.projectId || activeProject;
  const project = projects[pid];

  // ── TEST KEY ─────────────────────────────────────────────
  const testKey = async () => {
    if (!keyInput.trim()) return;
    setKeyTesting(true); setKeyError("");
    try {
      await callGroq({ apiKey: keyInput.trim(), system: "Reply: OK", messages: [{ role: "user", content: "ping" }], maxTokens: 5 });
      setGroqKey(keyInput.trim());
    } catch { setKeyError("Invalid key or no connection. Check console.groq.com"); }
    finally { setKeyTesting(false); }
  };

  // ── LOGIN ────────────────────────────────────────────────
  const login = (e) => {
    e.preventDefault();
    const u = USERS[loginForm.u.toLowerCase()];
    if (u && u.password === loginForm.p) {
      setUser(u);
      if (u.projectId) setActive(u.projectId);
      setView("dashboard");
      const welcome = u.role === "client"
        ? `Hi **${u.name}**! I have full access to your project documentation. What would you like to know?`
        : u.role === "admin"
        ? `Welcome back, **${u.name}**. All ${Object.keys(projects).length} projects are loaded. How can I help?`
        : `Hi **${u.name}**! I'm your ${AREA_CONFIG[u.area]?.label} assistant. Ask me anything about your area.`;
      setMessages([{ role: "assistant", content: welcome }]);
    } else { setLoginErr("Wrong username or password"); }
  };

  // ── SYSTEM PROMPT ────────────────────────────────────────
  const buildSystem = useCallback(() => {
    const proj = projects[pid];
    const docs = proj?.docs?.length
      ? proj.docs.slice(0, 2).map(d => `=== ${d.name} ===\n${d.content.slice(0, 600)}`).join("\n\n")
      : null;

    if (!user) return "You are Sentinel AI.";

    if (user.role === "client") {
      return `You are Sentinel, post-delivery support AI for project "${proj?.name}" (client: ${user.name}).
Rules: English, technical, concise. Max 3 steps. If unresolved in 3 attempts, start with ESCALAR_N2.
${docs ? `PROJECT DOCS:\n${docs}` : "No docs loaded. Use general knowledge."}`;
    }
    if (user.role === "admin") {
      const allProjects = Object.values(projects).map(p => `- ${p.name} (${p.client}): health ${p.health}%, status ${p.status}`).join("\n");
      return `You are Sentinel, executive intelligence AI for Dramhost agency.
Projects overview:\n${allProjects}
${docs ? `Active project docs:\n${docs}` : ""}
Provide concise, data-driven answers. Flag risks proactively.`;
    }
    // Internal by area
    const areaPrompts = {
      pm:      `You are Sentinel PM Assistant. Help with project tracking, sprint planning, milestone analysis, and team velocity. Be concise and action-oriented.`,
      hr:      `You are Sentinel HR Assistant. Help with team hours, headcount planning, leave tracking, and people metrics. Be empathetic and data-driven.`,
      finance: `You are Sentinel Finance Assistant. Help with budget tracking, cost analysis, invoicing, and financial forecasting. Be precise with numbers.`,
      support: `You are Sentinel Support Assistant. Help diagnose technical issues, analyze tickets, suggest fixes, and escalate when needed.`,
    };
    return `${areaPrompts[user.area] || "You are Sentinel AI."}
${docs ? `CONTEXT:\n${docs}` : ""}`;
  }, [projects, pid, user]);

  // ── SEND ─────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || loading || escalated) return;
    const msg = input.trim();
    setInput("");
    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const reply = await callGroq({ apiKey: groqKey, system: buildSystem(), messages: newMsgs.map(m => ({ role: m.role, content: m.content })) });
      if (reply.startsWith("ESCALAR_N2")) {
        const summary = reply.replace("ESCALAR_N2", "").trim();
        const tkt = makeTicket(summary, newMsgs);
        setMessages(p => [...p, { role: "assistant", content: `⚠️ **Case escalated to N2**\n\n${summary}\n\nTicket: **${tkt.id}**`, escalated: true }]);
        setEscalated(true);
      } else {
        setMessages(p => [...p, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      setMessages(p => [...p, { role: "assistant", content: `❌ Error: ${err.message}`, error: true }]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const makeTicket = (summary, conv) => {
    const tkt = { id: "TKT-" + String(Date.now()).slice(-4), projectId: pid, summary, conversation: [...conv], status: "open", severity: "high", createdAt: new Date().toISOString() };
    setProjects(p => ({ ...p, [pid]: { ...p[pid], tickets: [...(p[pid]?.tickets || []), tkt] } }));
    return tkt;
  };

  const resolveTicket = (tId, res) => {
    setProjects(p => ({ ...p, [pid]: { ...p[pid], tickets: p[pid].tickets.map(t => t.id === tId ? { ...t, status: "resolved", resolution: res, resolvedAt: new Date().toISOString() } : t) } }));
    setSelectedTkt(null);
  };

  const suggestReply = async (tkt) => {
    setLoading(true);
    try {
      const conv = tkt.conversation.map(m => `${m.role === "user" ? "CLIENT" : "AI"}: ${m.content}`).join("\n");
      const r = await callGroq({ apiKey: groqKey, system: "You are a senior technical agent. Reply in English, concise and actionable.", messages: [{ role: "user", content: `Write a technical reply for this ticket.\nISSUE: ${tkt.summary}\nCONVERSATION:\n${conv}\nJust the reply text.` }], maxTokens: 400 });
      setTktReply(r);
    } finally { setLoading(false); }
  };

  const uploadFiles = async (files) => {
    for (const file of Array.from(files)) {
      const parsed = await parseFile(file);
      const doc = { id: Date.now() + Math.random(), ...parsed, source: "upload", uploadedAt: new Date().toISOString().split("T")[0] };
      setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: [...(p[pid]?.docs || []), doc] } }));
    }
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    const doc = { id: Date.now(), name: urlInput, type: "url", source: "url", content: `[URL: ${urlInput}]\nWeb source indexed as reference.`, uploadedAt: new Date().toISOString().split("T")[0] };
    setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: [...(p[pid]?.docs || []), doc] } }));
    setUrlInput("");
  };

  const addScript = () => {
    if (!scriptTxt.trim()) return;
    const doc = { id: Date.now(), name: "Manual Entry", type: "text", source: "manual", content: scriptTxt, uploadedAt: new Date().toISOString().split("T")[0] };
    setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: [...(p[pid]?.docs || []), doc] } }));
    setScriptTxt("");
  };

  const addProject = () => {
    if (!newProjName.trim()) return;
    const id = newProjName.toLowerCase().replace(/\s+/g, "-");
    setProjects(p => ({ ...p, [id]: { id, name: newProjName, client: "New Client", color: "#6366f1", status: "on-track", health: 100, budget: 0, spent: 0, milestones: [], team: [], docs: [], tickets: [], activity: [] } }));
    setActive(id); setNewProjName("");
  };

  const allTickets = Object.values(projects).flatMap(p => (p.tickets || []).map(t => ({ ...t, projectName: p.name })));

  // ══════════════════════════════════════════
  // SCREEN: API KEY
  // ══════════════════════════════════════════
  if (!groqKey) return (
    <div style={S.bg}>
      <div style={S.authCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={S.logoBox}>S</div>
            <div>
              <div style={S.logoTitle}>SENTINEL</div>
              <div style={{ fontSize: 11, color: "#475569" }}>Project Intelligence Platform</div>
            </div>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>

        <div style={{ background: "#1a1205", border: "1px solid #78350f", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <I.Zap /><strong style={{ color: "#fbbf24", fontSize: 13 }}>Groq API — 100% Free</strong>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>No credit card · 500k tokens/day · llama-3.1-8b-instant</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={S.label}><I.Key /> &nbsp;Groq API Key</label>
          <input style={S.input} placeholder="gsk_xxxxxxxxxxxxxxxxxxxx" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && testKey()} type="password" />
          {keyError && <div style={S.err}>{keyError}</div>}
          <button onClick={testKey} disabled={keyTesting || !keyInput.trim()} style={S.bigBtn}>
            {keyTesting ? "Verifying..." : "Connect and enter →"}
          </button>
        </div>

        <div style={{ background: "#1e293b", borderRadius: 10, padding: 14, marginTop: 18 }}>
          <div style={S.label}>How to get your free key</div>
          {[["1","Go to","console.groq.com","https://console.groq.com"],["2","Sign up (email only, no card)"],["3",'Go to "API Keys" → Create'],["4","Paste here and go"]].map(([n,t,l,h]) => (
            <div key={n} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#4f46e5", color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{t} {l && <a href={h} target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>{l}</a>}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#475569", textAlign: "center", marginTop: 10 }}>Key never stored on any server. Session only.</div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  // SCREEN: LOGIN
  // ══════════════════════════════════════════
  if (!user) return (
    <div style={S.bg}>
      <div style={{ ...S.authCard, maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={S.logoBox}>S</div>
            <div>
              <div style={S.logoTitle}>SENTINEL</div>
              <div style={{ fontSize: 11, color: "#10b981" }}>● Groq connected</div>
            </div>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>

        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label style={S.label}>Username</label><input style={S.input} placeholder="admin / pm / hr / finance / support / retailco / logicorp" value={loginForm.u} onChange={e => setLoginForm(f => ({ ...f, u: e.target.value }))} /></div>
          <div><label style={S.label}>Password</label><input style={S.input} type="password" placeholder="••••••••" value={loginForm.p} onChange={e => setLoginForm(f => ({ ...f, p: e.target.value }))} /></div>
          {loginErr && <div style={S.err}>{loginErr}</div>}
          <button type="submit" style={S.bigBtn}>Sign in →</button>
        </form>

        <div style={{ background: "#1e293b", borderRadius: 10, padding: 14, marginTop: 16 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>Demo accounts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              ["#6366f1","admin","admin123","Admin — all projects"],
              ["#8b5cf6","pm","pm123","Internal PM — project tracking"],
              ["#f59e0b","hr","hr123","Internal HR — people & hours"],
              ["#10b981","finance","finance123","Internal Finance — budgets"],
              ["#ef4444","support","support123","Internal Support — tickets"],
              ["#6366f1","retailco","client123","Client — Nova Commerce"],
              ["#10b981","logicorp","logi123","Client — Fleet Tracker"],
            ].map(([c,u,p,desc]) => (
              <div key={u} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }} onClick={() => setLoginForm({ u, p })}>
                <span style={{ background: c, color: "white", fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 3, minWidth: 52, textAlign: "center" }}>{u}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{p} — {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  // MAIN APP
  // ══════════════════════════════════════════

  // Nav items by role
  const navItems = [
    { key: "dashboard", label: "Dashboard", Icon: I.Home },
    { key: "chat",      label: "AI Chat",   Icon: I.Bot },
    ...(user.role !== "client" ? [{ key: "data",    label: "Data Sources", Icon: I.Upload }] : []),
    ...(user.role !== "client" ? [{ key: "tickets", label: "Tickets",      Icon: I.Ticket }] : []),
    ...(user.role === "admin"  ? [{ key: "admin",   label: "Admin",        Icon: I.Settings }] : []),
  ];

  const visibleProjects = user.role === "client"
    ? [projects[user.projectId]].filter(Boolean)
    : Object.values(projects);

  return (
    <div style={S.app}>

      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #1e293b" }}>
          <div style={S.logoBox}>S</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#f1f5f9", letterSpacing: 1 }}>SENTINEL</div>
            <div style={{ fontSize: 9, color: "#10b981" }}>● Groq · llama-3.1-8b</div>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 10px", marginBottom: 14, fontSize: 11 }}>
          {user.role === "admin" && <div style={{ color: "#818cf8", fontWeight: 700 }}>⚡ Admin — Full Access</div>}
          {user.role === "internal" && <div style={{ color: AREA_CONFIG[user.area]?.color, fontWeight: 700 }}>{AREA_CONFIG[user.area]?.icon} {AREA_CONFIG[user.area]?.label}</div>}
          {user.role === "client" && <div style={{ color: "#10b981", fontWeight: 700 }}>🏢 Client Portal</div>}
          <div style={{ color: "#475569", marginTop: 2 }}>{user.name}</div>
        </div>

        {/* Project selector — admin/internal */}
        {user.role !== "client" && (
          <div style={{ marginBottom: 14 }}>
            <div style={S.label}>Active project</div>
            <select value={activeProject} onChange={e => setActive(e.target.value)} style={S.select}>
              {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setView(key)} style={{ ...S.navBtn, ...(view === key ? S.navActive : {}) }}>
              <Icon /> <span>{label}</span>
            </button>
          ))}
        </nav>

        <div style={{ paddingBottom: 10 }}>
          <LangToggle lang={lang} setLang={setLang} />
        </div>

        <div style={{ borderTop: "1px solid #1e293b", paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar user={user} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{user.name}</div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>{user.role}{user.area ? ` · ${user.area}` : ""}</div>
          </div>
          <button onClick={() => { setUser(null); setMessages([]); }} style={S.iconBtn}><I.Logout /></button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={S.main}>

        {/* ═══ DASHBOARD ═══ */}
        {view === "dashboard" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={S.panelH}>
                {user.role === "admin" ? "Agency Overview" :
                 user.role === "client" ? `${project?.name} — Project Status` :
                 `${AREA_CONFIG[user.area]?.label} Dashboard`}
              </h2>
              <p style={S.panelSub}>
                {user.role === "admin" ? `${Object.keys(projects).length} active projects · Real-time intelligence` :
                 user.role === "client" ? `Client: ${user.name}` :
                 AREA_CONFIG[user.area]?.desc}
              </p>
            </div>

            {/* Metric strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
              {user.role === "admin" && <>
                <MetricCard label="Active Projects" value={Object.keys(projects).length} sub="across all clients" />
                <MetricCard label="Avg Health" value={`${Math.round(Object.values(projects).reduce((s,p) => s+p.health,0)/Object.keys(projects).length)}%`} sub="portfolio score" color="#10b981" />
                <MetricCard label="Open Tickets" value={allTickets.filter(t=>t.status==="open").length} sub="awaiting resolution" color="#ef4444" />
                <MetricCard label="Total Budget" value={`$${(Object.values(projects).reduce((s,p)=>s+p.budget,0)/1000).toFixed(0)}k`} sub="under management" color="#f59e0b" />
              </>}
              {user.role === "client" && <>
                <MetricCard label="Project Health" value={`${project?.health}%`} sub="overall score" color={project?.health >= 80 ? "#10b981" : "#f59e0b"} />
                <MetricCard label="Milestones Done" value={`${project?.milestones?.filter(m=>m.status==="done").length}/${project?.milestones?.length}`} sub="completed" color="#818cf8" />
                <MetricCard label="Open Tickets" value={project?.tickets?.filter(t=>t.status==="open").length || 0} sub="in progress" color="#ef4444" />
                <MetricCard label="Budget Used" value={`${Math.round((project?.spent/project?.budget)*100)}%`} sub={`$${(project?.spent/1000).toFixed(0)}k / $${(project?.budget/1000).toFixed(0)}k`} color="#f59e0b" />
              </>}
              {user.role === "internal" && user.area === "pm" && <>
                <MetricCard label="Projects Tracked" value={visibleProjects.length} sub="all clients" />
                <MetricCard label="At Risk" value={visibleProjects.filter(p=>p.status==="at-risk").length} sub="need attention" color="#ef4444" />
                <MetricCard label="Milestones Due" value={visibleProjects.flatMap(p=>p.milestones||[]).filter(m=>m.status==="in-progress").length} sub="this month" color="#f59e0b" />
                <MetricCard label="Team Members" value={[...new Set(visibleProjects.flatMap(p=>p.team||[]))].length} sub="active devs" color="#818cf8" />
              </>}
              {user.role === "internal" && user.area === "finance" && <>
                <MetricCard label="Total Budget" value={`$${(visibleProjects.reduce((s,p)=>s+p.budget,0)/1000).toFixed(0)}k`} sub="contracted" color="#10b981" />
                <MetricCard label="Total Spent" value={`$${(visibleProjects.reduce((s,p)=>s+p.spent,0)/1000).toFixed(0)}k`} sub="to date" color="#f59e0b" />
                <MetricCard label="Remaining" value={`$${((visibleProjects.reduce((s,p)=>s+p.budget,0)-visibleProjects.reduce((s,p)=>s+p.spent,0))/1000).toFixed(0)}k`} sub="available" color="#818cf8" />
                <MetricCard label="Avg Burn Rate" value={`${Math.round(visibleProjects.reduce((s,p)=>s+(p.spent/p.budget*100),0)/visibleProjects.length)}%`} sub="budget consumed" color="#ef4444" />
              </>}
              {user.role === "internal" && (user.area === "hr" || user.area === "support") && <>
                <MetricCard label="Team Size" value={[...new Set(visibleProjects.flatMap(p=>p.team||[]))].length} sub="active members" />
                <MetricCard label="Open Tickets" value={allTickets.filter(t=>t.status==="open").length} sub="need resolution" color="#ef4444" />
                <MetricCard label="Projects" value={visibleProjects.length} sub="monitored" color="#818cf8" />
                <MetricCard label="Resolved" value={allTickets.filter(t=>t.status==="resolved").length} sub="this period" color="#10b981" />
              </>}
            </div>

            {/* Projects grid */}
            <div style={{ display: "grid", gridTemplateColumns: user.role === "client" ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {visibleProjects.map(proj => (
                <div key={proj.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setActive(proj.id); setView("chat"); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: proj.color }} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{proj.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{proj.client}</div>
                    </div>
                    <StatusBadge status={proj.status} />
                  </div>
                  <HealthBar value={proj.health} width={120} />
                  <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11, color: "#64748b" }}>
                    <span>📋 {proj.milestones?.filter(m=>m.status==="done").length}/{proj.milestones?.length} milestones</span>
                    <span>👥 {proj.team?.length} members</span>
                    {proj.tickets?.filter(t=>t.status==="open").length > 0 && <span style={{ color: "#ef4444" }}>🎫 {proj.tickets.filter(t=>t.status==="open").length} open</span>}
                  </div>
                  {/* Milestones */}
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                    {proj.milestones?.slice(0,3).map(m => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                        <span style={{ color: "#94a3b8" }}>{m.name}</span>
                        <StatusBadge status={m.status} />
                      </div>
                    ))}
                  </div>
                  {/* Recent activity */}
                  {proj.activity?.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Recent activity</div>
                      {proj.activity.slice(0,2).map((a,i) => (
                        <div key={i} style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                          <span style={{ color: "#94a3b8" }}>{a.user}</span> · {a.text} · <span style={{ color: "#475569" }}>{a.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 10, fontSize: 11, color: "#4f46e5" }}>Ask AI about this project →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ CHAT ═══ */}
        {view === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e293b", background: "#0d1526", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>
                  {user.role === "client" ? project?.name : user.role === "admin" ? project?.name : `${AREA_CONFIG[user.area]?.label} · AI Assistant`}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                  {project?.docs?.length || 0} docs indexed · {messages.length} turns
                </div>
              </div>
              <button onClick={() => { setMessages([{ role: "assistant", content: "Chat restarted. How can I help?" }]); setEscalated(false); }} style={S.smBtn}>New chat</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 6, alignItems: "flex-end" }}>
                  {m.role === "assistant" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.escalated ? "#7f1d1d" : "#312e81", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>{m.escalated ? <I.Alert /> : <I.Bot />}</div>}
                  <div style={{ maxWidth: "72%", padding: "9px 13px", borderRadius: 12, fontSize: 13, lineHeight: 1.65,
                    ...(m.role === "user" ? { background: "#4f46e5", color: "white", borderBottomRightRadius: 3 } : { background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderBottomLeftRadius: 3 }),
                    ...(m.escalated ? { borderColor: "#dc2626" } : {}), ...(m.error ? { color: "#fca5a5" } : {}),
                  }}>
                    <MD text={m.content} />
                  </div>
                  {m.role === "user" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}><I.User /></div>}
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#312e81", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><I.Bot /></div>
                  <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, borderBottomLeftRadius: 3, padding: "9px 13px" }}><Dots /></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #1e293b", background: "#0d1526", display: "flex", gap: 8 }}>
              {escalated ? (
                <div style={{ flex: 1, textAlign: "center", color: "#f87171", fontSize: 13, fontWeight: 600 }}>⚠️ Case escalated — check Tickets section</div>
              ) : (
                <>
                  <textarea ref={inputRef} rows={2} style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "9px 12px", color: "#f1f5f9", fontSize: 13, resize: "none", fontFamily: "inherit", outline: "none" }}
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Ask about ${user.role === "client" ? project?.name : user.role === "admin" ? "any project" : AREA_CONFIG[user.area]?.label}... (Enter to send)`} />
                  <button onClick={send} disabled={loading || !input.trim()} style={{ background: "#4f46e5", border: "none", borderRadius: 10, padding: "9px 14px", color: "white", cursor: "pointer", display: "flex", alignItems: "center" }}><I.Send /></button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ DATA SOURCES ═══ */}
        {view === "data" && user.role !== "client" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={S.panelH}>Data Sources</h2>
              <p style={S.panelSub}>Connect tools and upload documents to power AI answers</p>
            </div>

            {user.role === "admin" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
                <span style={S.label}>Project:</span>
                <select value={activeProject} onChange={e => setActive(e.target.value)} style={S.select}>
                  {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            {/* Integration tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 22 }}>
              {[
                { name: "ClickUp", icon: "🎯", status: "connect", color: "#7c3aed", desc: "Tasks & sprints" },
                { name: "GitLab", icon: "🦊", status: "connect", color: "#fc6d26", desc: "Repos & issues" },
                { name: "GitHub", icon: "⚫", status: "connect", color: "#6e40c9", desc: "Code & PRs" },
                { name: "Slack",  icon: "💬", status: "connect", color: "#4a154b", desc: "Messages" },
                { name: "Wiki.js",icon: "📖", status: "connect", color: "#1976d2", desc: "Docs & runbooks" },
                { name: "Jira",   icon: "🔵", status: "soon",    color: "#0052cc", desc: "Coming soon" },
              ].map(tool => (
                <div key={tool.name} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{tool.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{tool.name}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>{tool.desc}</div>
                  {tool.status === "soon" ? (
                    <span style={{ fontSize: 10, color: "#475569" }}>Coming soon</span>
                  ) : (
                    <button style={{ ...S.smBtn, fontSize: 10, padding: "4px 10px", borderColor: tool.color, color: tool.color }} onClick={() => alert(`${tool.name} integration — connect your workspace URL and API token to sync data into Sentinel.`)}>
                      Connect →
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Manual upload tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {[["manual","📎 File Upload"],["url","🔗 URL"],["text","📝 Manual Entry"]].map(([k,l]) => (
                <button key={k} onClick={() => setDocTab(k)} style={{ ...S.smBtn, ...(docTab===k ? { background: "#1e293b", color: "#818cf8", borderColor: "#4f46e5" } : {}) }}>{l}</button>
              ))}
            </div>

            {docTab === "manual" && (
              <div style={{ border: "2px dashed #334155", borderRadius: 12, padding: 28, textAlign: "center", cursor: "pointer", marginBottom: 18 }} onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); uploadFiles(e.dataTransfer.files); }}>
                <I.Upload />
                <div style={{ marginTop: 8, fontWeight: 600, color: "#94a3b8", fontSize: 13 }}>Drop files or click to upload</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>PDF · CSV · TXT · MD · JSON · YAML · JS · SQL · Excel</div>
                <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => uploadFiles(e.target.files)} />
              </div>
            )}

            {docTab === "url" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 18, background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "8px 12px", alignItems: "center" }}>
                <I.Link />
                <input style={{ ...S.input, flex: 1, margin: 0, background: "transparent", border: "none", padding: "4px 0" }} placeholder="https://docs.yourproject.com, Confluence, Notion, GitHub..." value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addUrl()} />
                <button onClick={addUrl} style={S.smBtn}>Add</button>
              </div>
            )}

            {docTab === "text" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                <textarea style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px", color: "#f1f5f9", fontSize: 13, resize: "none", fontFamily: "inherit", outline: "none", minHeight: 120 }} placeholder="Paste SOW, meeting notes, scripts, changelogs, technical specs..." value={scriptTxt} onChange={e => setScriptTxt(e.target.value)} />
                <button onClick={addScript} style={S.smBtn}>Add to knowledge base</button>
              </div>
            )}

            {/* Doc list */}
            <div style={S.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Indexed documents — {(project?.docs || []).length}
              </div>
              {(project?.docs || []).map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                  <span style={{ background: { pdf:"#ef4444",csv:"#10b981",text:"#6366f1",url:"#f59e0b" }[doc.type]||"#8b5cf6", color:"white", fontSize:9, fontWeight:800, padding:"2px 5px", borderRadius:3 }}>{doc.type?.toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{doc.name}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{doc.source} · {doc.uploadedAt} · {doc.content?.length?.toLocaleString()} chars</div>
                  </div>
                  <button onClick={() => { setProjects(p => ({ ...p, [pid]: { ...p[pid], docs: p[pid].docs.filter(d => d.id !== doc.id) } })); }} style={S.iconBtn}><I.Trash /></button>
                </div>
              ))}
              {!(project?.docs?.length) && <div style={{ padding: "20px 0", textAlign: "center", color: "#475569", fontSize: 12 }}>No documents yet — upload something to get started</div>}
            </div>
          </div>
        )}

        {/* ═══ TICKETS ═══ */}
        {view === "tickets" && user.role !== "client" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={S.panelH}>N2 Tickets</h2>
              <p style={S.panelSub}>Escalated cases for manual resolution</p>
            </div>

            {selectedTkt ? (
              <div>
                <button onClick={() => { setSelectedTkt(null); setTktReply(""); }} style={S.smBtn}>← Back</button>
                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: "#818cf8" }}>{selectedTkt.id}</span>
                    <StatusBadge status={selectedTkt.status} />
                  </div>
                  <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 6 }}>{selectedTkt.summary}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{new Date(selectedTkt.createdAt).toLocaleString()} · {selectedTkt.projectName}</div>
                </div>
                <div style={{ ...S.card, marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>Conversation</div>
                  {selectedTkt.conversation?.map((m,i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: m.role === "user" ? "#818cf8" : "#34d399", textTransform: "uppercase", marginBottom: 2 }}>{m.role === "user" ? "Client" : "Sentinel AI"}</div>
                      <div style={{ fontSize: 12, color: "#cbd5e1" }}>{m.content}</div>
                    </div>
                  ))}
                </div>
                {selectedTkt.status === "open" && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={() => suggestReply(selectedTkt)} disabled={loading} style={S.smBtn}>{loading ? "Generating..." : "✨ Suggest AI reply"}</button>
                    {tktReply && <textarea style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 12px", color: "#f1f5f9", fontSize: 13, resize: "none", fontFamily: "inherit", outline: "none", minHeight: 80 }} value={tktReply} onChange={e => setTktReply(e.target.value)} />}
                    <button onClick={() => resolveTicket(selectedTkt.id, tktReply || "Resolved by N2 agent")} style={{ ...S.smBtn, background: "#052e16", borderColor: "#10b981", color: "#10b981" }}><I.Check /> Close as resolved</button>
                  </div>
                )}
                {selectedTkt.status === "resolved" && (
                  <div style={{ marginTop: 14, padding: 12, background: "#052e16", border: "1px solid #166534", borderRadius: 10, fontSize: 12, color: "#86efac" }}>✅ {selectedTkt.resolution}</div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allTickets.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).map(tkt => (
                  <div key={tkt.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setSelectedTkt(tkt); setTktReply(""); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <StatusBadge status={tkt.status} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>{tkt.id}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#475569" }}>{tkt.projectName}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>{tkt.summary.slice(0,100)}{tkt.summary.length>100?"...":""}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{new Date(tkt.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {!allTickets.length && <div style={{ padding: 48, textAlign: "center", color: "#475569", fontSize: 13 }}>No escalated tickets yet — that's a good sign 🎉</div>}
              </div>
            )}
          </div>
        )}

        {/* ═══ ADMIN ═══ */}
        {view === "admin" && user.role === "admin" && (
          <div style={S.panel}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={S.panelH}>Administration</h2>
              <p style={S.panelSub}>Manage projects, clients and team access</p>
            </div>

            <div style={{ ...S.card, marginBottom: 14 }}>
              <div style={S.sectionTitle}>Create project</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...S.input, flex: 1 }} placeholder="Project name" value={newProjName} onChange={e => setNewProjName(e.target.value)} onKeyDown={e => e.key === "Enter" && addProject()} />
                <button onClick={addProject} style={S.smBtn}><I.Plus /> Create</button>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.sectionTitle}>Projects ({Object.keys(projects).length})</div>
              {Object.values(projects).map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color || "#6366f1", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{p.client} · {p.docs?.length||0} docs · <span style={{ color: p.health>=80?"#10b981":p.health>=60?"#f59e0b":"#ef4444" }}>{p.health}% health</span></div>
                  </div>
                  <StatusBadge status={p.status} />
                  <button onClick={() => { setActive(p.id); setView("data"); }} style={S.smBtn}>Manage →</button>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.sectionTitle}>Team accounts</div>
              {Object.values(USERS).map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                  <Avatar user={u} size={26} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: "#475569", textTransform: "capitalize" }}>{u.role}{u.area ? ` · ${u.area}` : ""}{u.projectId ? ` · ${projects[u.projectId]?.name}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 10, background: "#1e293b", color: "#64748b", padding: "2px 8px", borderRadius: 4 }}>{u.id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ── METRIC CARD ──────────────────────────────────────────────
function MetricCard({ label, value, sub, color = "#f1f5f9" }) {
  return (
    <div style={{ background: "#0d1526", border: "1px solid #1e293b", borderRadius: 10, padding: "14px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ── STYLES ───────────────────────────────────────────────────
const S = {
  bg:        { minHeight: "100vh", background: "#060b18", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono','Fira Code',monospace" },
  authCard:  { background: "#0d1526", border: "1px solid #1e293b", borderRadius: 16, padding: "30px 34px", width: 440, maxWidth: "95vw", boxShadow: "0 0 60px rgba(99,102,241,0.1)" },
  logoBox:   { width: 36, height: 36, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "white" },
  logoTitle: { fontWeight: 800, fontSize: 16, color: "#f1f5f9", letterSpacing: 3 },
  label:     { fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4, marginBottom: 5 },
  input:     { width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  err:       { color: "#f87171", fontSize: 11, background: "rgba(248,113,113,0.08)", padding: "7px 10px", borderRadius: 6 },
  bigBtn:    { background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 8, padding: "11px", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" },
  app:       { display: "flex", height: "100vh", background: "#060b18", fontFamily: "'IBM Plex Mono','Fira Code',monospace", overflow: "hidden" },
  sidebar:   { width: 220, background: "#0d1526", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "16px 10px", overflow: "hidden" },
  navBtn:    { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500, width: "100%" },
  navActive: { background: "#1e3a5f", color: "#818cf8" },
  iconBtn:   { background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 5, display: "flex", alignItems: "center" },
  smBtn:     { background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "6px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" },
  select:    { background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: "6px 10px", color: "#f1f5f9", fontSize: 12, fontFamily: "inherit", width: "100%" },
  main:      { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  panel:     { flex: 1, overflowY: "auto", padding: 24 },
  panelH:    { fontSize: 20, fontWeight: 800, color: "#f1f5f9", margin: 0 },
  panelSub:  { fontSize: 12, color: "#475569", marginTop: 3 },
  card:      { background: "#0d1526", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px" },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
};
