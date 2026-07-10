#!/usr/bin/env node
/**
 * Generates dist/stats.svg — a btop-style "system monitor" panel of live
 * GitHub stats, styled to match assets/terminal.svg (Tokyo Night).
 *
 * Data sources:
 *   - REST  /users/:user, /users/:user/repos  (public, works unauthenticated)
 *   - GraphQL contributionsCollection          (needs GITHUB_TOKEN; skipped if absent)
 *
 * Run in CI:  GITHUB_TOKEN=... GH_USER=Harbringe node scripts/generate-stats.js
 */

const fs = require("fs");
const path = require("path");

const USER = process.env.GH_USER || "Harbringe";
const TOKEN = process.env.GITHUB_TOKEN || "";
const OUT = path.join(__dirname, "..", "dist", "stats.svg");

const C = {
  bg: "#1a1b26", chrome: "#16161e", border: "#414868", track: "#24283b",
  text: "#c0caf5", dim: "#565f89", green: "#9ece6a", cyan: "#7dcfff",
  mag: "#bb9af7", yellow: "#e0af68", red: "#f7768e", blue: "#7aa2f7",
};
const LANG_COLORS = [C.blue, C.green, C.yellow, C.red, C.mag, C.cyan];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function rest(p) {
  const res = await fetch(`https://api.github.com${p}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "harbringe-profile-stats",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
}

async function contributions() {
  if (!TOKEN) return null;
  try {
    const query = `query($login:String!){ user(login:$login){ contributionsCollection {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    } } }`;
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
        "user-agent": "harbringe-profile-stats",
      },
      body: JSON.stringify({ query, variables: { login: USER } }),
    });
    const json = await res.json();
    const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) return null;
    const days = cal.weeks.flatMap((w) => w.contributionDays);
    days.sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].contributionCount > 0) streak++;
      else if (i === days.length - 1) continue; // today can be empty without breaking streak
      else break;
    }
    return { total: cal.totalContributions, days, streak };
  } catch {
    return null;
  }
}

function mockData() {
  const today = Date.now();
  const days = Array.from({ length: 70 }, (_, i) => ({
    date: new Date(today - (69 - i) * 864e5).toISOString().slice(0, 10),
    contributionCount: [0, 0, 2, 5, 1, 8, 3, 0, 4, 12, 6, 2][i % 12],
  }));
  return {
    user: { public_repos: 24, followers: 18, created_at: "2021-03-14T00:00:00Z" },
    repos: [
      { language: "Python", size: 52000, stargazers_count: 21, fork: false },
      { language: "JavaScript", size: 30000, stargazers_count: 9, fork: false },
      { language: "Solidity", size: 14000, stargazers_count: 5, fork: false },
      { language: "Jupyter Notebook", size: 11000, stargazers_count: 3, fork: false },
      { language: "C", size: 6000, stargazers_count: 1, fork: false },
      { language: "HTML", size: 4000, stargazers_count: 0, fork: false },
    ],
    contrib: { total: 847, days, streak: 6 },
  };
}

(async () => {
  const { user, repos, contrib } = process.env.MOCK
    ? mockData()
    : await Promise.all([
        rest(`/users/${USER}`),
        rest(`/users/${USER}/repos?per_page=100&type=owner`),
        contributions(),
      ]).then(([user, repos, contrib]) => ({ user, repos, contrib }));

  const own = repos.filter((r) => !r.fork);
  const stars = repos.reduce((n, r) => n + (r.stargazers_count || 0), 0);

  // language share, weighted by repo size
  const langWeight = {};
  for (const r of own) {
    if (r.language) langWeight[r.language] = (langWeight[r.language] || 0) + Math.max(r.size, 1);
  }
  const topLangs = Object.entries(langWeight).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const langTotal = topLangs.reduce((n, [, w]) => n + w, 0) || 1;

  const ageMs = Date.now() - new Date(user.created_at).getTime();
  const years = Math.floor(ageMs / (365.25 * 24 * 3600e3));
  const days = Math.floor((ageMs % (365.25 * 24 * 3600e3)) / (24 * 3600e3));

  // ---------- left panel: language "cores" ----------
  const barX = 178, barW = 186;
  const cores = topLangs.map(([lang, w], i) => {
    const pct = Math.round((w / langTotal) * 100);
    const y = 108 + i * 38;
    const col = LANG_COLORS[i % LANG_COLORS.length];
    return `
    <text x="34" y="${y}" fill="${C.dim}">C${i}</text>
    <text x="66" y="${y}" fill="${col}" font-weight="bold">${esc(lang.length > 12 ? lang.slice(0, 11) + "…" : lang)}</text>
    <rect x="${barX}" y="${y - 10}" width="${barW}" height="10" rx="5" fill="${C.track}"/>
    <rect class="bar" style="animation-delay:${(0.15 + i * 0.18).toFixed(2)}s" x="${barX}" y="${y - 10}" width="${Math.max(6, Math.round(barW * pct / 100))}" height="10" rx="5" fill="${col}"/>
    <text x="${barX + barW + 12}" y="${y}" fill="${C.text}">${String(pct).padStart(3)}%</text>`;
  }).join("\n");

  // ---------- right panel: system readout ----------
  const sysRows = [
    ["uptime", `${years} yrs ${days} days on github`, C.text],
    ["procs", `${user.public_repos} public repos running`, C.text],
    ["stars", `★ ${stars} collected`, C.yellow],
    ["followers", `${user.followers} humans subscribed`, C.text],
    ...(contrib ? [
      ["commits", `${contrib.total} contributions this year`, C.green],
      ["streak", `${contrib.streak} day${contrib.streak === 1 ? "" : "s"} and counting 🔥`, C.red],
    ] : []),
  ];
  let sys = sysRows.map(([k, v, col], i) => {
    const y = 108 + i * 32;
    return `
    <text x="472" y="${y}" fill="${C.mag}" font-weight="bold">${k}</text>
    <text x="580" y="${y}" fill="${col}">${esc(v)}</text>`;
  }).join("\n");
  const cafY = 108 + sysRows.length * 32;
  sys += `
    <text x="472" y="${cafY}" fill="${C.mag}" font-weight="bold">caffeine</text>
    <rect x="580" y="${cafY - 10}" width="130" height="10" rx="5" fill="${C.track}"/>
    <rect class="bar" style="animation-delay:1.3s" x="580" y="${cafY - 10}" width="122" height="10" rx="5" fill="${C.mag}"/>
    <text x="722" y="${cafY}" fill="${C.mag}">94% ☕</text>`;

  // ---------- bottom: contribution sparkline (last 60 days) ----------
  let spark;
  if (contrib) {
    const last = contrib.days.slice(-60);
    const max = Math.max(1, ...last.map((d) => d.contributionCount));
    const base = 400, maxH = 44, w = 9, gap = 4.4;
    spark = last.map((d, i) => {
      const h = d.contributionCount === 0 ? 3 : Math.max(5, Math.round((d.contributionCount / max) * maxH));
      const col = d.contributionCount === 0 ? C.track : (d.contributionCount >= max * 0.66 ? C.green : d.contributionCount >= max * 0.33 ? C.blue : "#3d59a1");
      return `<rect class="sp" style="animation-delay:${(1.2 + i * 0.02).toFixed(2)}s" x="${(28 + i * (w + gap)).toFixed(1)}" y="${base - h}" width="${w}" height="${h}" rx="2" fill="${col}"/>`;
    }).join("");
    spark = `<text x="28" y="344" fill="${C.dim}">≡ contribution activity <tspan fill="${C.track}">·</tspan> last 60 days</text>` + spark;
  } else {
    spark = `<text x="28" y="344" fill="${C.dim}">≡ contribution activity</text>
    <text x="28" y="380" fill="${C.dim}">telemetry link offline — reconnecting <tspan class="blink" fill="${C.cyan}">⟳</tspan></text>`;
  }

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  const svg = `<svg viewBox="0 0 860 430" width="860" height="430" xmlns="http://www.w3.org/2000/svg" font-family="'Cascadia Code','Fira Code','JetBrains Mono','SF Mono',Consolas,'Liberation Mono',Menlo,monospace" font-size="15">
  <style>
    @keyframes growx { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .bar { transform-box: fill-box; transform-origin: left center; animation: growx 1.1s cubic-bezier(.2,.8,.2,1) both; }
    @keyframes growy { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .sp { transform-box: fill-box; transform-origin: center bottom; animation: growy 0.5s ease-out both; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    .blink { animation: pulse 1.1s step-end infinite; }
    text { white-space: pre; }
  </style>

  <rect x="1.5" y="1.5" width="857" height="427" rx="12" fill="${C.bg}" stroke="${C.border}" stroke-width="1.5"/>
  <path d="M 1.5 13.5 A 12 12 0 0 1 13.5 1.5 H 846.5 A 12 12 0 0 1 858.5 13.5 V 40 H 1.5 Z" fill="${C.chrome}"/>
  <line x1="1.5" y1="40" x2="858.5" y2="40" stroke="${C.border}" stroke-width="1"/>
  <circle cx="24" cy="21" r="6.5" fill="${C.red}"/>
  <circle cx="46" cy="21" r="6.5" fill="${C.yellow}"/>
  <circle cx="68" cy="21" r="6.5" fill="${C.green}"/>
  <text x="430" y="26" text-anchor="middle" fill="${C.dim}" font-size="13">aaditya@harbringe: ~ — btop</text>
  <text x="828" y="26" text-anchor="end" fill="${C.track}" font-size="12">${now} UTC</text>

  <text x="28" y="76" fill="${C.dim}">≡ lang cores</text>
  ${cores}

  <text x="472" y="76" fill="${C.dim}">≡ system</text>
  <text x="828" y="76" text-anchor="end" fill="${C.green}" font-size="13"><tspan class="pulse">●</tspan> online</text>
  ${sys}

  ${spark}

  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="1.5" fill="#000000" opacity="0.09"/>
  </pattern>
  <rect x="1.5" y="1.5" width="857" height="427" rx="12" fill="url(#scan)"/>
</svg>
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, svg);
  console.log(`wrote ${OUT} (${topLangs.length} langs, contrib: ${contrib ? "yes" : "no"})`);
})();
