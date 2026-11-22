#!/usr/bin/env node
/**
 * Builds the static showcase SVGs used in the README:
 *   assets/now.svg               — `ps aux --sort=-focus` panel of what I'm working on
 *   assets/projects/<slug>.svg   — one terminal-window card per featured project
 *
 * Edit PROJECTS / NOW below, then:  node scripts/build-cards.js
 * Same Tokyo Night palette as assets/hero.svg and scripts/generate-stats.js.
 */

const fs = require("fs");
const path = require("path");

const C = {
  bg: "#1a1b26", chrome: "#16161e", border: "#414868", track: "#24283b",
  text: "#c0caf5", dim: "#565f89", green: "#9ece6a", cyan: "#7dcfff",
  mag: "#bb9af7", yellow: "#e0af68", red: "#f7768e", blue: "#7aa2f7",
};
const FONT = "'Cascadia Code','Fira Code','JetBrains Mono','SF Mono',Consolas,'Liberation Mono',Menlo,monospace";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ─────────────────────────── featured projects ───────────────────────────
const PROJECTS = [
  {
    slug: "eo-insight",
    title: "eo-insight",
    accent: C.cyan,
    status: ["shipping", C.green],
    tagline: "ask satellite imagery questions in English",
    lines: [
      ["Sentinel-2 → NDVI change detection", "→ BLIP-2 captions"],
      ["CLIP + text vectors in Qdrant,", "PostGIS spatial prefilter"],
      ["NL query → bbox + dates → cited answer", ""],
    ],
    stack: ["fastapi", "qdrant", "postgis", "clip", "celery"],
    next: "next: RemoteCLIP + map UI",
  },
  {
    slug: "expense-claim",
    title: "ai-expense-claim",
    accent: C.mag,
    status: ["shipping", C.green],
    tagline: "explainable reimbursement decisions",
    lines: [
      ["Azure OpenAI vision reads the receipt", ""],
      ["~20 policy checks, each with", "expected / actual / why"],
      ["every tool call traced for audit", ""],
    ],
    stack: ["fastapi", "azure-openai", "react", "sqlite"],
    next: "low confidence → human review",
  },
  {
    slug: "valshort",
    title: "valshort",
    accent: C.red,
    status: ["v1.0 released", C.yellow],
    tagline: "trimmed clip in, finished YouTube Short out",
    lines: [
      ["auto-detects 4:3 crop vs stretched", "via cropdetect"],
      ["blurred 9:16 bg, -14 LUFS audio,", "faststart"],
      ["CLI, watch-folder, and a local web UI", ""],
    ],
    stack: ["ffmpeg", "bash", "python"],
    next: "next: quota-aware auto-upload",
  },
  {
    slug: "jobpilot",
    title: "jobpilot",
    accent: C.blue,
    status: ["building", C.cyan],
    tagline: "AI-powered job application autopilot",
    lines: [
      ["profile → matched jobs → tailored", "resumes"],
      ["pgvector matching, JWT + rotating", "refresh tokens"],
      ["tracks every application end to end", ""],
    ],
    stack: ["node", "typescript", "prisma", "pgvector"],
    next: "API + frontend in progress",
  },
];

// ─────────────────────────── `ps aux` panel ───────────────────────────
const NOW = [
  // [pid, focus%, state, color, command, note]
  ["1337", 92, "R", C.green, "autoca", "new · cooking, details soon"],
  ["2048", 74, "R", C.green, "eo-insight", "satellite RAG · RemoteCLIP next"],
  ["4096", 58, "S", C.cyan, "jobpilot", "job autopilot api"],
  ["8080", 41, "S", C.cyan, "ai-expense-claim", "auditable agent checks"],
  ["9001", 27, "S", C.yellow, "valshort", "clip → short pipeline"],
];

function chrome(w, h, title, accent) {
  return `
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="11" fill="${C.bg}" stroke="${C.border}" stroke-width="1.5"/>
  <path d="M 1 12 A 11 11 0 0 1 12 1 H ${w - 12} A 11 11 0 0 1 ${w - 1} 12 V 34 H 1 Z" fill="${C.chrome}"/>
  <line x1="1" y1="34" x2="${w - 1}" y2="34" stroke="${C.border}"/>
  <rect x="1" y="34" width="3" height="${h - 46}" fill="${accent}" opacity="0.85"/>
  <circle cx="20" cy="17.5" r="5" fill="${C.red}"/><circle cx="37" cy="17.5" r="5" fill="${C.yellow}"/><circle cx="54" cy="17.5" r="5" fill="${C.green}"/>
  <text x="${w / 2}" y="22" text-anchor="middle" font-size="12" fill="${C.dim}">${esc(title)}</text>`;
}

function card(p) {
  const W = 410, H = 258, X = 22;
  let y = 64;
  const out = [];
  // header: name + status pill
  out.push(`<text x="${X}" y="${y}" font-size="17" font-weight="bold" fill="${p.accent}">${esc(p.title)}</text>`);
  const [label, col] = p.status;
  const pw = Math.round(label.length * 7.2 + 28);
  out.push(`<g transform="translate(${W - X - pw} ${y - 15})">
    <rect width="${pw}" height="21" rx="10.5" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-opacity="0.55"/>
    <circle cx="11" cy="10.5" r="3.5" fill="${col}" class="pulse"/>
    <text x="20" y="14.5" font-size="11.5" fill="${col}">${esc(label)}</text></g>`);
  y += 21;
  out.push(`<text x="${X}" y="${y}" font-size="13" fill="${C.text}" font-style="italic">${esc(p.tagline)}</text>`);
  y += 26;
  for (const [a, b] of p.lines) {
    out.push(`<text x="${X}" y="${y}" font-size="12.5" xml:space="preserve"><tspan fill="${p.accent}">›</tspan><tspan fill="${C.text}"> ${esc(a)}</tspan></text>`);
    if (b) { y += 17; out.push(`<text x="${X + 15}" y="${y}" font-size="12.5" fill="${C.text}">${esc(b)}</text>`); }
    y += 19;
  }
  // stack chips
  let cx = X; const cy = H - 50;
  for (const s of p.stack) {
    const w = Math.round(s.length * 6.9 + 16);
    out.push(`<rect x="${cx}" y="${cy}" width="${w}" height="19" rx="4" fill="${C.track}" stroke="${C.border}" stroke-width="0.8"/>
    <text x="${cx + w / 2}" y="${cy + 13.5}" text-anchor="middle" font-size="11" fill="${C.cyan}">${esc(s)}</text>`);
    cx += w + 6;
  }
  out.push(`<text x="${X}" y="${H - 15}" font-size="11.5" fill="${C.dim}"><tspan fill="${C.green}">$</tspan> ${esc(p.next)}</text>`);
  out.push(`<text x="${W - X}" y="${H - 15}" text-anchor="end" font-size="11.5" fill="${C.dim}">open repo ↗</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
  <title>${esc(p.title)} — ${esc(p.tagline)}</title>
  <style>
    text { white-space: pre; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .body { animation: rise 0.6s ease-out both; }
  </style>
  ${chrome(W, H, `~/${p.slug}`, p.accent)}
  <g class="body">
  ${out.join("\n  ")}
  </g>
</svg>
`;
}

function nowPanel() {
  const W = 860, rowH = 30, top = 120, H = top + NOW.length * rowH + 40;
  const col = { pid: 28, bar: 92, pct: 262, st: 318, cmd: 360, note: 540 };
  const BARW = 150;
  const rows = NOW.map(([pid, pct, st, color, cmd, note], i) => {
    const y = top + i * rowH;
    const d = (0.3 + i * 0.18).toFixed(2);
    return `
  <g class="row" style="animation-delay:${d}s">
    <text x="${col.pid}" y="${y}" fill="${C.dim}">${pid}</text>
    <rect x="${col.bar}" y="${y - 11}" width="${BARW}" height="13" rx="2" fill="${C.track}"/>
    <rect x="${col.bar}" y="${y - 11}" width="${(BARW * pct) / 100}" height="13" rx="2" fill="${color}" class="bar" style="animation-delay:${d}s"/>
    <text x="${col.pct}" y="${y}" fill="${color}">${pct}%</text>
    <text x="${col.st}" y="${y}" fill="${st === "R" ? C.green : C.dim}" font-weight="bold">${st}</text>
    <text x="${col.cmd}" y="${y}" fill="${C.text}" font-weight="bold">${esc(cmd)}</text>
    <text x="${col.note}" y="${y}" fill="${C.dim}"># ${esc(note)}</text>
  </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}" font-size="14">
  <title>What I'm working on right now</title>
  <style>
    text { white-space: pre; }
    @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .bar { transform-box: fill-box; transform-origin: left; animation: grow 1.1s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    .row { animation: fade 0.4s ease-out both; }
    @keyframes blink { 0%,45% { opacity: 1; } 50%,95% { opacity: 0; } }
    .cursor { animation: blink 1.1s step-end infinite; }
  </style>
  ${chrome(W, H, "aaditya@harbringe: ~/work", C.green)}
  <text x="28" y="62"><tspan fill="${C.green}" font-weight="bold">$ </tspan><tspan fill="${C.text}">ps aux --sort=-focus </tspan><tspan fill="${C.dim}">| head -${NOW.length}</tspan></text>
  <text x="${col.pid}" y="${top - 24}" fill="${C.mag}" font-size="12" font-weight="bold">PID</text>
  <text x="${col.bar}" y="${top - 24}" fill="${C.mag}" font-size="12" font-weight="bold">FOCUS</text>
  <text x="${col.st}" y="${top - 24}" fill="${C.mag}" font-size="12" font-weight="bold">S</text>
  <text x="${col.cmd}" y="${top - 24}" fill="${C.mag}" font-size="12" font-weight="bold">COMMAND</text>
  ${rows}
  <text x="28" y="${H - 22}"><tspan fill="${C.green}" font-weight="bold">$ </tspan></text>
  <rect x="46" y="${H - 35}" width="9" height="17" fill="${C.text}" class="cursor"/>
  <text x="${W - 28}" y="${H - 22}" text-anchor="end" fill="${C.dim}" font-size="12">R = running · S = shipped, still tinkering</text>
</svg>
`;
}

const root = path.join(__dirname, "..", "assets");
fs.mkdirSync(path.join(root, "projects"), { recursive: true });
for (const p of PROJECTS) fs.writeFileSync(path.join(root, "projects", `${p.slug}.svg`), card(p));
fs.writeFileSync(path.join(root, "now.svg"), nowPanel());
console.log(`wrote now.svg + ${PROJECTS.length} project cards`);
