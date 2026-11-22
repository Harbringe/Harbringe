#!/usr/bin/env node
/**
 * Generates dist/city.svg — the last year of GitHub contributions as a night
 * skyline. One building per day (weeks run left → right, most recent week in
 * front), height = commits that day, lit windows on the busy ones.
 *
 *   GITHUB_TOKEN=... GH_USER=Harbringe node scripts/generate-city.js
 *   MOCK=1 node scripts/generate-city.js        # offline preview with fake data
 *
 * Tokyo Night palette, same as hero.svg / stats.svg.
 */

const fs = require("fs");
const path = require("path");

const USER = process.env.GH_USER || "Harbringe";
const TOKEN = process.env.GITHUB_TOKEN || "";
const OUT = process.env.OUT || path.join(__dirname, "..", "dist", "city.svg");

const C = {
  bg: "#1a1b26", chrome: "#16161e", border: "#414868", ground: "#1f2335",
  text: "#c0caf5", dim: "#565f89", yellow: "#e0af68", cyan: "#7dcfff",
  mag: "#bb9af7", blue: "#7aa2f7", green: "#9ece6a",
};
// tower colour per activity level 1..4 (0 = empty lot)
const LEVEL = [null, "#3d59a1", C.blue, C.mag, C.cyan];
const FONT = "'Cascadia Code','Fira Code','JetBrains Mono','SF Mono',Consolas,'Liberation Mono',Menlo,monospace";

// ───────────────────────── data ─────────────────────────
async function fetchCalendar() {
  const query = `query($login:String!){ user(login:$login){ contributionsCollection {
    contributionCalendar { totalContributions weeks { contributionDays { date contributionCount weekday } } }
  } } }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "user-agent": "harbringe-profile-city" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error("no contribution calendar: " + JSON.stringify(json.errors || json).slice(0, 200));
  return { total: cal.totalContributions, weeks: cal.weeks.map((w) => w.contributionDays) };
}

function mockCalendar() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const weeks = [];
  const start = Date.now() - 52 * 7 * 864e5;
  let total = 0;
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const ramp = 0.25 + (w / 52) * 0.9;              // busier lately
      const r = rnd();
      const n = r < 0.28 / ramp ? 0 : Math.round(rnd() * rnd() * 26 * ramp + (d > 0 && d < 6 ? 2 : 0));
      total += n;
      days.push({ date: new Date(start + (w * 7 + d) * 864e5).toISOString().slice(0, 10), contributionCount: n, weekday: d });
    }
    weeks.push(days);
  }
  return { total, weeks };
}

// ───────────────────────── geometry ─────────────────────────
const W = 860, H = 430;
const U = [12.4, 3.1];   // one week step (to the right, slightly down)
const V = [-6.6, 4.4];   // one weekday step (towards the viewer, left)
const O = [92, 168];     // ground position of week 0, Sunday
const P = (x, y) => [O[0] + x * U[0] + y * V[0], O[1] + x * U[1] + y * V[1]];
const pt = ([x, y], dy = 0) => `${x.toFixed(1)},${(y - dy).toFixed(1)}`;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.round(((n >> s) & 255) * f);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

function build(cal) {
  const days = cal.weeks.flat();
  const counts = days.map((d) => d.contributionCount).filter((n) => n > 0).sort((a, b) => a - b);
  const max = counts.length ? counts[counts.length - 1] : 1;
  const q = (p) => counts[Math.floor(p * (counts.length - 1))] || 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (n) => (n === 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);
  const height = (n) => (n === 0 ? 0 : 6 + Math.sqrt(n / max) * 112);

  // streaks + busiest day
  let best = 0, run = 0, busiest = days[0];
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    best = Math.max(best, run);
    if (d.contributionCount > busiest.contributionCount) busiest = d;
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) current++;
    else if (i === days.length - 1) continue;
    else break;
  }

  const towers = [];
  const lots = [];
  const g = 0.14; // street width (fraction of a cell)
  cal.weeks.forEach((week, wi) => {
    week.forEach((day) => {
      const di = day.weekday ?? new Date(day.date).getUTCDay();
      const n = day.contributionCount;
      const a = P(wi + g, di + g), b = P(wi + 1 - g, di + g), c = P(wi + 1 - g, di + 1 - g), d = P(wi + g, di + 1 - g);
      const depth = (a[1] + c[1]) / 2;
      if (n === 0) {
        lots.push({ depth, svg: `<polygon points="${pt(a)} ${pt(b)} ${pt(c)} ${pt(d)}" fill="${C.ground}"/>` });
        return;
      }
      const h = height(n), lv = level(n), col = LEVEL[lv];
      const parts = [];
      // visible faces: front-left (d→c) and front-right (c→b)
      parts.push(`<polygon points="${pt(d)} ${pt(c)} ${pt(c, h)} ${pt(d, h)}" fill="${shade(col, 0.42)}"/>`);
      parts.push(`<polygon points="${pt(c)} ${pt(b)} ${pt(b, h)} ${pt(c, h)}" fill="${shade(col, 0.62)}"/>`);
      parts.push(`<polygon points="${pt(a, h)} ${pt(b, h)} ${pt(c, h)} ${pt(d, h)}" fill="${col}"/>`);
      // windows on the front-right face
      if (h > 16) {
        const lerp = (p, q2, t) => [p[0] + (q2[0] - p[0]) * t, p[1] + (q2[1] - p[1]) * t];
        for (let z = 7, row = 0; z < h - 5; z += 6.5, row++) {
          for (const [t0, t1, k] of [[0.18, 0.42, 0], [0.58, 0.82, 1]]) {
            const r = hash(wi * 7 + di, row, k);
            if (r > 0.18 + lv * 0.12) continue;
            const s = lerp(c, b, t0), e = lerp(c, b, t1);
            const cls = r < 0.035 ? ' class="flick"' : "";
            parts.push(`<line x1="${s[0].toFixed(1)}" y1="${(s[1] - z).toFixed(1)}" x2="${e[0].toFixed(1)}" y2="${(e[1] - z).toFixed(1)}" stroke="${r < 0.1 ? C.cyan : C.yellow}" stroke-width="2.2" stroke-opacity="${(0.55 + r * 2).toFixed(2)}"${cls}/>`);
          }
        }
      }
      // antenna + beacon on the tallest towers
      if (lv === 4 && n >= q(0.93)) {
        const top = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - h];
        parts.push(`<line x1="${top[0].toFixed(1)}" y1="${top[1].toFixed(1)}" x2="${top[0].toFixed(1)}" y2="${(top[1] - 10).toFixed(1)}" stroke="${C.dim}" stroke-width="1"/>`);
        parts.push(`<circle cx="${top[0].toFixed(1)}" cy="${(top[1] - 11).toFixed(1)}" r="1.8" fill="#f7768e" class="beacon"/>`);
      }
      towers.push({ depth, wi, svg: `<g class="t" style="animation-delay:${(wi * 0.035).toFixed(2)}s" aria-label="${day.date}: ${n}">${parts.join("")}</g>` });
    });
  });
  towers.sort((x, y) => x.depth - y.depth);
  lots.sort((x, y) => x.depth - y.depth);

  // ground slab under the whole grid
  const nW = cal.weeks.length;
  const ga = P(-0.4, -0.4), gb = P(nW + 0.4, -0.4), gc = P(nW + 0.4, 7.4), gd = P(-0.4, 7.4);
  const slab = 7;
  const ground = `
  <polygon points="${pt(gd)} ${pt(gc)} ${pt(gc, -slab)} ${pt(gd, -slab)}" fill="#13141c"/>
  <polygon points="${pt(gc)} ${pt(gb)} ${pt(gb, -slab)} ${pt(gc, -slab)}" fill="#181924"/>
  <polygon points="${pt(ga)} ${pt(gb)} ${pt(gc)} ${pt(gd)}" fill="#16161e" stroke="${C.border}" stroke-width="0.8"/>`;

  // stars
  let stars = "";
  for (let i = 0; i < 70; i++) {
    const x = 20 + hash(i, 1) * (W - 40), y = 44 + hash(i, 2) * 150;
    const r = 0.5 + hash(i, 3) * 0.9;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${C.text}" opacity="${(0.25 + hash(i, 4) * 0.5).toFixed(2)}"${i % 6 === 0 ? ' class="tw"' : ""}/>`;
  }

  const fmtDate = (s, yr) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(yr ? { year: "numeric" } : {}), timeZone: "UTC" });
  const firstDay = days[0]?.date, lastDay = days[days.length - 1]?.date;
  const legend = [1, 2, 3, 4].map((lv, i) => `<rect x="${W - 196 + i * 16}" y="${H - 34}" width="11" height="11" rx="2" fill="${LEVEL[lv]}"/>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
  <title>Contribution city: ${cal.total} contributions in the last year, one building per day</title>
  <style>
    text { white-space: pre; }
    @keyframes rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .t { transform-box: fill-box; transform-origin: 50% 100%; animation: rise 0.7s cubic-bezier(.2,.9,.3,1.15) both; }
    @keyframes flick { 0%,100% { opacity: 1; } 47% { opacity: 1; } 50% { opacity: 0.1; } 53% { opacity: 1; } 80% { opacity: 0.3; } }
    .flick { animation: flick 4.5s steps(1) infinite; }
    @keyframes beacon { 0%,100% { opacity: 1; } 50% { opacity: 0.15; } }
    .beacon { animation: beacon 1.4s ease-in-out infinite; }
    @keyframes tw { 0%,100% { opacity: 0.8; } 50% { opacity: 0.15; } }
    .tw { animation: tw 3s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .t, .flick, .beacon, .tw { animation: none; } }
  </style>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#13141c"/><stop offset="0.75" stop-color="#1a1b26"/><stop offset="1" stop-color="#232437"/>
    </linearGradient>
    <radialGradient id="haze" cx="0.62" cy="0.78" r="0.55">
      <stop offset="0" stop-color="${C.mag}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.mag}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="win"><rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="12"/></clipPath>
  </defs>

  <g clip-path="url(#win)">
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <rect width="${W}" height="${H}" fill="url(#haze)"/>
    ${stars}
    <circle cx="${W - 86}" cy="86" r="22" fill="${C.text}" opacity="0.9"/>
    <circle cx="${W - 76}" cy="80" r="20" fill="#14151d"/>
    ${ground}
    ${lots.map((l) => l.svg).join("\n    ")}
    ${towers.map((t) => t.svg).join("\n    ")}
  </g>

  <!-- window chrome -->
  <path d="M 1.5 13.5 A 12 12 0 0 1 13.5 1.5 H ${W - 13.5} A 12 12 0 0 1 ${W - 1.5} 13.5 V 34 H 1.5 Z" fill="${C.chrome}"/>
  <line x1="1.5" y1="34" x2="${W - 1.5}" y2="34" stroke="${C.border}"/>
  <circle cx="21" cy="17.5" r="5.5" fill="#f7768e"/><circle cx="40" cy="17.5" r="5.5" fill="${C.yellow}"/><circle cx="59" cy="17.5" r="5.5" fill="${C.green}"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="12" fill="${C.dim}">~/contributions — night shift</text>
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="12" fill="none" stroke="${C.border}" stroke-width="1.5"/>

  <!-- readout -->
  <g font-size="13">
    <text x="26" y="${H - 86}"><tspan fill="${C.green}" font-weight="bold">$ </tspan><tspan fill="${C.text}">git log --since=1.year | wc -l</tspan></text>
    <text x="26" y="${H - 58}" font-size="26" font-weight="bold" fill="${C.cyan}">${cal.total.toLocaleString("en-US")}<tspan font-size="13" font-weight="normal" fill="${C.dim}">  contributions</tspan></text>
    <text x="26" y="${H - 34}" fill="${C.dim}">streak <tspan fill="${C.yellow}">${current}d</tspan>  ·  best <tspan fill="${C.yellow}">${best}d</tspan>  ·  peak <tspan fill="${C.mag}">${busiest.contributionCount}</tspan> on ${fmtDate(busiest.date)}</text>
  </g>
  <text x="${W - 26}" y="${H - 58}" text-anchor="end" font-size="11.5" fill="${C.dim}">${fmtDate(firstDay, true)} → ${fmtDate(lastDay, true)} · 1 tower = 1 day</text>
  <text x="${W - 206}" y="${H - 24}" text-anchor="end" font-size="11.5" fill="${C.dim}">quiet</text>
  ${legend}
  <text x="${W - 26}" y="${H - 24}" text-anchor="end" font-size="11.5" fill="${C.dim}">crunch</text>
</svg>
`;
}

(async () => {
  const cal = process.env.MOCK || !TOKEN ? mockCalendar() : await fetchCalendar();
  if (!process.env.MOCK && !TOKEN) console.warn("no GITHUB_TOKEN: rendering mock data");
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, build(cal));
  console.log(`wrote ${OUT} (${cal.total} contributions)`);
})();
