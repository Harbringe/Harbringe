#!/usr/bin/env node
/**
 * Builds the static showcase SVGs used in the README:
 *   assets/projects/autoca.svg   — the full-width flagship card
 *   assets/projects/<slug>.svg   — half-width cards for the other featured projects
 *
 * Edit FLAGSHIP / PROJECTS below, then:  node scripts/build-cards.js
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

// ─────────────────────────── flagship ───────────────────────────
const FLAGSHIP = {
  slug: "autoca",
  title: "autoca",
  accent: C.green,
  status: ["MVP · in production", C.green],
  tagline: "bookkeeping on autopilot for Indian CA firms",
  forWho: "bank statements in, books and returns out. Rules + AI do the booking; the CA reviews the queue.",
  pipeline: [
    ["statement.pdf", "any bank, parsed and proved against its own running balance"],
    ["classify", "rules first, then an LLM that only ever sees pseudonymised data"],
    ["review", "CA queue sorted by confidence; every decision teaches a rule"],
    ["post", "immutable journal entry; corrections reverse, never edit"],
    ["file", "Tally sync · GSTR-1 / 3B / 2B recon · TDS · payroll · P&L, BS"],
  ],
  stats: [
    ["38k+", ["parsed", "txns"], C.cyan],
    ["175k+", ["lines of", "code"], C.cyan],
    ["2.3k+", ["tests"], C.green],
    ["60+", ["books"], C.green],
  ],
  guarantees: ["postgres RLS per firm", "no UPDATE on journals", "encrypted GSTINs", "MFA everywhere"],
  stack: ["django", "postgres", "react 19", "celery", "aws"],
};

// ─────────────────────────── featured projects ───────────────────────────
const PROJECTS = [
  {
    slug: "eo-insight",
    title: "eo-insight",
    accent: C.cyan,
    status: ["working MVP", C.cyan],
    tagline: "ask satellite imagery questions in English",
    forWho: "for analysts tracking deforestation & sprawl",
    lines: [
      ["Sentinel-2 → NDVI change maps", "+ BLIP-2 scene captions"],
      ["CLIP + text vectors in Qdrant,", "PostGIS does the where & when"],
      ["\"forest loss, Western Ghats, Jan–May\"", "→ grounded answer, cited scenes"],
    ],
    stack: ["fastapi", "qdrant", "postgis", "clip", "celery"],
    next: "next: RemoteCLIP + map UI",
  },
  {
    slug: "valshort",
    title: "valshort",
    accent: C.red,
    status: ["v1.0 released", C.yellow],
    tagline: "trimmed clip in, finished YouTube Short out",
    forWho: "for Valorant players who clip their plays",
    lines: [
      ["trimming is the only manual step", ""],
      ["detects 4:3 crop vs stretched res,", "so the minimap + HUD survive"],
      ["-14 LUFS audio, GPU encode, watch-", "folder + one-click local web UI"],
    ],
    stack: ["ffmpeg", "python", "bash"],
    next: "next: quota-aware auto-upload",
  },
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

function pill(label, col, xRight, y) {
  const pw = Math.round(label.length * 7.2 + 28);
  return `<g transform="translate(${xRight - pw} ${y - 15})">
    <rect width="${pw}" height="21" rx="10.5" fill="${col}" fill-opacity="0.12" stroke="${col}" stroke-opacity="0.55"/>
    <circle cx="11" cy="10.5" r="3.5" fill="${col}" class="pulse"/>
    <text x="20" y="14.5" font-size="11.5" fill="${col}">${esc(label)}</text></g>`;
}

function chips(list, x, y, color = C.cyan) {
  let cx = x; const out = [];
  for (const s of list) {
    const w = Math.round(s.length * 6.9 + 16);
    out.push(`<rect x="${cx}" y="${y}" width="${w}" height="19" rx="4" fill="${C.track}" stroke="${C.border}" stroke-width="0.8"/>
    <text x="${cx + w / 2}" y="${y + 13.5}" text-anchor="middle" font-size="11" fill="${color}">${esc(s)}</text>`);
    cx += w + 6;
  }
  return out.join("\n  ");
}

const STYLE = `
  <style>
    text { white-space: pre; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .body { animation: rise 0.6s ease-out both; }
    .step { animation: rise 0.45s ease-out both; }
    @media (prefers-reduced-motion: reduce) { .pulse, .body, .step { animation: none; } }
  </style>`;

function flagship(p) {
  const W = 860, H = 372, X = 26;
  const out = [];
  out.push(`<text x="${X}" y="68" font-size="22" font-weight="bold" fill="${p.accent}">${esc(p.title)}</text>`);
  out.push(`<text x="${X + 96}" y="68" font-size="13" fill="${C.dim}">★ flagship</text>`);
  out.push(pill(p.status[0], p.status[1], W - X, 66));
  out.push(`<text x="${X}" y="94" font-size="15" fill="${C.text}" font-style="italic">${esc(p.tagline)}</text>`);
  out.push(`<text x="${X}" y="115" font-size="12.5" fill="${C.dim}">${esc(p.forWho)}</text>`);

  // pipeline (left)
  const y = 150;
  out.push(`<text x="${X}" y="${y - 6}" font-size="11.5" fill="${C.mag}" font-weight="bold">PIPELINE</text>`);
  p.pipeline.forEach(([k, v], i) => {
    const yy = y + 14 + i * 27;
    const d = (0.25 + i * 0.15).toFixed(2);
    out.push(`<g class="step" style="animation-delay:${d}s">
    <circle cx="${X + 5}" cy="${yy - 4}" r="4" fill="${i === p.pipeline.length - 1 ? p.accent : C.bg}" stroke="${p.accent}" stroke-width="1.5"/>
    ${i < p.pipeline.length - 1 ? `<line x1="${X + 5}" y1="${yy + 1}" x2="${X + 5}" y2="${yy + 18}" stroke="${C.border}" stroke-width="1.5" stroke-dasharray="2 2"/>` : ""}
    <text x="${X + 20}" y="${yy}" font-size="12.5"><tspan fill="${C.yellow}" font-weight="bold">${esc(k.padEnd(14))}</tspan><tspan fill="${C.text}">${esc(v)}</tspan></text></g>`);
  });

  // scale (right column)
  const SX = 682;
  out.push(`<line x1="${SX - 18}" y1="136" x2="${SX - 18}" y2="282" stroke="${C.border}" stroke-dasharray="3 3"/>`);
  out.push(`<text x="${SX}" y="144" font-size="11.5" fill="${C.mag}" font-weight="bold">BY THE NUMBERS</text>`);
  p.stats.forEach(([n, lines, col], i) => {
    const yy = 172 + Math.floor(i / 2) * 60, xx = SX + (i % 2) * 86;
    out.push(`<text x="${xx}" y="${yy}" font-size="19" font-weight="bold" fill="${col}">${esc(n)}</text>`);
    lines.forEach((l, j) => out.push(`<text x="${xx}" y="${yy + 15 + j * 12}" font-size="10" fill="${C.dim}">${esc(l)}</text>`));
  });

  // guarantees + stack
  out.push(`<text x="${X}" y="${H - 69}" font-size="11.5" fill="${C.mag}" font-weight="bold">GUARANTEES</text>`);
  out.push(chips(p.guarantees, X + 92, H - 83, C.green));
  out.push(chips(p.stack, X, H - 52));
  out.push(`<text x="${W - X}" y="${H - 15}" text-anchor="end" font-size="11.5" fill="${C.dim}">open repo ↗</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
  <title>${esc(p.title)}: ${esc(p.tagline)}</title>${STYLE}
  ${chrome(W, H, `~/${p.slug}`, p.accent)}
  <g class="body">
  ${out.join("\n  ")}
  </g>
</svg>
`;
}

function card(p) {
  const W = 410, H = 292, X = 22;
  let y = 64;
  const out = [];
  out.push(`<text x="${X}" y="${y}" font-size="17" font-weight="bold" fill="${p.accent}">${esc(p.title)}</text>`);
  out.push(pill(p.status[0], p.status[1], W - X, y));
  y += 21;
  out.push(`<text x="${X}" y="${y}" font-size="13" fill="${C.text}" font-style="italic">${esc(p.tagline)}</text>`);
  y += 18;
  out.push(`<text x="${X}" y="${y}" font-size="12" fill="${C.dim}">${esc(p.forWho)}</text>`);
  y += 26;
  for (const [a, b] of p.lines) {
    out.push(`<text x="${X}" y="${y}" font-size="12.5" xml:space="preserve"><tspan fill="${p.accent}">›</tspan><tspan fill="${C.text}"> ${esc(a)}</tspan></text>`);
    if (b) { y += 17; out.push(`<text x="${X + 15}" y="${y}" font-size="12.5" fill="${C.text}">${esc(b)}</text>`); }
    y += 19;
  }
  out.push(chips(p.stack, X, H - 50));
  out.push(`<text x="${X}" y="${H - 15}" font-size="11.5" fill="${C.dim}"><tspan fill="${C.green}">$</tspan> ${esc(p.next)}</text>`);
  out.push(`<text x="${W - X}" y="${H - 15}" text-anchor="end" font-size="11.5" fill="${C.dim}">open repo ↗</text>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
  <title>${esc(p.title)}: ${esc(p.tagline)}</title>${STYLE}
  ${chrome(W, H, `~/${p.slug}`, p.accent)}
  <g class="body">
  ${out.join("\n  ")}
  </g>
</svg>
`;
}

const dir = path.join(__dirname, "..", "assets", "projects");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${FLAGSHIP.slug}.svg`), flagship(FLAGSHIP));
for (const p of PROJECTS) fs.writeFileSync(path.join(dir, `${p.slug}.svg`), card(p));
console.log(`wrote flagship + ${PROJECTS.length} project cards`);
