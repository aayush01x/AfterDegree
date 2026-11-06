// Records the AfterDegree demo: scripted Chrome session, one screencast per scene, captions and a
// cursor drawn in the page. Run with the app live on :3000 and the engine on :8000.
//   node scripts/demo-video.mjs <outDir> <universityProfileId>
import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";

const OUT = process.argv[2];
const UNI = process.argv[3];
const BASE = "http://localhost:3000";
const LINKEDIN = "https://www.linkedin.com/in/aayush-anand-043756203/";
const W = 1600, H = 900;
const segs = [];
let n = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true, args: ["--no-sandbox", "--disable-gpu", `--window-size=${W},${H}`] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H });

// ---------- overlay: caption + cursor, re-injected after every navigation ----------
const OVERLAY = `
(() => {
  if (document.getElementById("demo-cap")) return;
  const st = document.createElement("style");
  st.textContent = \`
  #demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);z-index:99999;max-width:1100px;
    background:rgba(17,20,28,.92);color:#fff;font:600 21px/1.35 Inter,system-ui,sans-serif;padding:14px 22px;border-radius:10px;
    box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .35s,transform .35s;letter-spacing:.005em;text-align:center}
  #demo-cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #demo-cap b{color:#8fb2ff;font-weight:700;margin-right:8px}
  #demo-cur{position:fixed;left:0;top:0;width:22px;height:22px;z-index:100000;pointer-events:none;transition:transform .55s cubic-bezier(.4,.1,.2,1);
    transform:translate(800px,450px)}
  #demo-cur svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  #demo-cur.click::after{content:"";position:absolute;left:-12px;top:-12px;width:44px;height:44px;border-radius:50%;background:rgba(43,108,255,.35);animation:dp .45s ease-out}
  @keyframes dp{from{transform:scale(.3);opacity:1}to{transform:scale(1.2);opacity:0}}\`;
  document.head.appendChild(st);
  const c = document.createElement("div"); c.id = "demo-cap"; document.body.appendChild(c);
  const k = document.createElement("div"); k.id = "demo-cur";
  k.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(k);
  if (window.__curPos) k.style.transform = "translate(" + window.__curPos[0] + "px," + window.__curPos[1] + "px)";
})();`;
p.on("framenavigated", async (f) => { if (f === p.mainFrame()) { await sleep(300); p.evaluate(OVERLAY).catch(() => {}); } });

async function overlay() { await p.evaluate(OVERLAY).catch(() => {}); }
async function caption(step, text) {
  await overlay();
  await p.evaluate((s, t) => {
    const c = document.getElementById("demo-cap");
    c.classList.remove("on");
    setTimeout(() => { c.innerHTML = (s ? "<b>" + s + "</b>" : "") + t; c.classList.add("on"); }, 120);
  }, step, text);
  await sleep(250);
}
async function hideCaption() { await p.evaluate(() => document.getElementById("demo-cap")?.classList.remove("on")).catch(() => {}); }
async function moveTo(handle) {
  await overlay();
  await handle.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
  await sleep(500);
  const box = await handle.boundingBox();
  if (!box) return null;
  const x = box.x + Math.min(box.width / 2, 120), y = box.y + box.height / 2;
  await p.evaluate((x, y) => { window.__curPos = [x, y]; const k = document.getElementById("demo-cur"); if (k) k.style.transform = `translate(${x}px,${y}px)`; }, x, y);
  await sleep(650);
  return { x, y };
}
async function click(handle) {
  const pt = await moveTo(handle);
  await p.evaluate(() => { const k = document.getElementById("demo-cur"); if (k) { k.classList.remove("click"); void k.offsetWidth; k.classList.add("click"); } });
  if (pt) await p.mouse.click(pt.x, pt.y); else await handle.click();
  await sleep(300);
}
const byText = (sel, re) => p.evaluateHandle((sel, src) => [...document.querySelectorAll(sel)].find((e) => new RegExp(src, "i").test(e.textContent || e.getAttribute("aria-label") || "")) || null, sel, re);
async function has(h) { return h && (await h.evaluate((e) => !!e).catch(() => false)); }
async function scrollBy(px, ms = 1400) {
  await p.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), px);
  await sleep(ms);
}
async function typeInto(handle, text, delay = 28) { await click(handle); await handle.type(text, { delay }); }

// ---------- recording ----------
let rec = null;
async function start(speed = 1) {
  const file = `${OUT}/seg${String(++n).padStart(2, "0")}.webm`;
  rec = await p.screencast({ path: file });
  segs.push({ file, speed });
  await sleep(200);
}
async function stop() { if (rec) { await sleep(150); await rec.stop(); rec = null; } }
async function waitResult(timeout = 300000) {
  await p.waitForFunction(() => {
    const m = document.querySelector("main"); if (!m) return false;
    if (document.querySelector("[aria-label='Working on it']")) return false;
    return !!m.querySelector("[role=tabpanel], [class*=results]") || /didn't finish/.test(m.innerText);
  }, { timeout, polling: 500 });
  await sleep(1200);
}
async function card(html, ms) {
  await p.setContent(`<!doctype html><html><head><style>
  body{margin:0;height:100vh;display:grid;place-items:center;background:#eef1f5;
    background-image:linear-gradient(rgba(150,175,220,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(150,175,220,.35) 1px,transparent 1px);background-size:32px 32px;
    font-family:Inter,system-ui,sans-serif;color:#161b24}
  .c{text-align:center;max-width:1100px;padding:0 40px}
  .mark{display:inline-grid;grid-template-columns:repeat(3,18px);gap:5px;margin-bottom:26px}
  .mark i{width:18px;height:18px;background:#2b5bd7}.mark i:nth-child(5){background:#161b24}
  h1{font-size:76px;margin:0 0 14px;letter-spacing:-.02em}
  p{font-size:28px;line-height:1.4;margin:0;color:#3b4456}
  .s{margin-top:28px;font-size:20px;color:#5b6577;letter-spacing:.08em;text-transform:uppercase;font-weight:600}
  .c{animation:in .8s ease-out both}@keyframes in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  </style></head><body><div class="c"><div class="mark">${"<i></i>".repeat(9)}</div>${html}</div></body></html>`);
  await start(); await sleep(ms); await stop();
}
async function go(path) { await p.goto(BASE + path, { waitUntil: "networkidle2", timeout: 120000 }); await overlay(); }
async function scene(name, fn) {
  log("scene", name);
  try { await fn(); } catch (e) { log("scene failed:", name, String(e).slice(0, 300)); await stop().catch(() => {}); }
}

// ================= SCRIPT =================
await card(`<h1>AfterDegree</h1><p>See where people like you actually ended up,<br>before you bet two years and your savings on a guess.</p><div class="s">Built on Crustdata · ContextCon</div>`, 3800);

// fresh start, Blueprint theme
await p.goto(BASE + "/onboarding", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("afterdegree.theme", "blueprint"); });
await go("/onboarding");

await scene("onboarding-url", async () => {
  await start();
  await caption("1", "Paste your LinkedIn. AfterDegree reads only your own profile, through Crustdata.");
  const input = await p.$("input[placeholder*='linkedin']");
  await typeInto(input, LINKEDIN, 18);
  await sleep(400);
  await click(await byText("button", "^Read my profile"));
  await sleep(1500);
  await stop();
  await p.waitForFunction(() => /Yes, this is me/.test(document.body.innerText), { timeout: 120000 });
  await sleep(800);
  await start();
  await caption("2", "It understands you: IIT Kanpur, Electrical Engineering, class of 2027, still a student.");
  await scrollBy(260, 1800); await scrollBy(-260, 1000);
  await click(await byText("button", "Yes, this is me"));
  await sleep(1200);
  await stop();
});

await scene("onboarding-chat", async () => {
  const replies = [
    "I want a software engineering job in the United States after I graduate in 2027.",
    "Software Engineer, backend or full-stack. The United States first.",
    "I will need visa sponsorship, and I'd like a company that hires Indian graduates.",
    "Nothing else, that's it.",
    "Yes, that's right.",
  ];
  await p.waitForFunction(() => /Your reply|That's right, continue/.test(document.body.innerText), { timeout: 120000 });
  await start(1.8);
  await caption("3", "A short mentor-style chat sets your goal.");
  for (const r of replies) {
    const done = await p.evaluate(() => /That.s right, continue/.test(document.body.innerText));
    if (done) break;
    const inp = await p.$("input[placeholder='Type your answer']");
    await p.waitForFunction(() => { const i = document.querySelector("input[placeholder='Type your answer']"); return i && !i.disabled; }, { timeout: 90000 });
    await typeInto(inp, r, 14);
    await click(await byText("button", "^Send$"));
    await p.waitForFunction(() => { const i = document.querySelector("input[placeholder='Type your answer']"); return (i && !i.disabled) || /That.s right, continue/.test(document.body.innerText); }, { timeout: 90000 });
    await sleep(900);
  }
  const cont = await byText("button", "That.s right, continue");
  if (await has(cont)) await click(cont);
  await sleep(1500);
  await caption("3", "Your goal, confirmed: Software Engineer in the United States, with visa sponsorship.");
  await sleep(2200);
  await stop();
  const go2 = await byText("button", "Show me people like me|Show me where our graduates");
  if (await has(go2)) await go2.click();
  await p.waitForFunction(() => location.pathname.startsWith("/home"), { timeout: 60000 }).catch(() => {});
});

await scene("home", async () => {
  await go("/home");
  await p.waitForFunction(() => /step by step/.test(document.body.innerText), { timeout: 120000 });
  await sleep(2500);
  await start();
  await caption("4", "Your plan: your goal in one line, live counts, and a step-by-step path.");
  await sleep(1800); await scrollBy(420, 1600); await scrollBy(480, 1800);
  await stop();
});

await scene("people-like-me", async () => {
  await go("/tools/people-like-me?match=exact_school");
  await start();
  await caption("5", "People Like Me: the IIT Kanpur EE graduates who sat where you sit now.");
  await sleep(1600);
  await stop();
  await waitResult();
  await p.evaluate(() => window.scrollTo(0, 0));
  await start();
  await caption("5", "Where they are now, with exact counts over every matching profile.");
  await sleep(1500); await scrollBy(520, 1700);
  const us = await p.evaluateHandle(() => [...document.querySelectorAll("button,[role=button]")].find((e) => /^United States/i.test(e.getAttribute("aria-label") || e.textContent || "")) || null);
  await caption("6", "Every number is clickable. Open the people behind United States.");
  if (await has(us)) await click(us);
  await sleep(800);
  await stop();
  await p.waitForFunction(() => location.pathname.startsWith("/explore"), { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector("[data-tile]") || /listing|fewer than 5/i.test(document.body.innerText), { timeout: 240000 });
  await sleep(1500);
  await start();
  await caption("6", "Same filters, one level deeper: cities, employers, roles, and anonymous career paths.");
  await sleep(1400); await scrollBy(500, 1700); await scrollBy(500, 1700);
  const tile = await p.$("[data-tile] [role=button], [data-tile] a, [data-tile] button") || await p.$("[data-tile]");
  if (tile) { await caption("7", "One anonymous path, step by step. No names, no links, years only."); await click(tile); }
  await sleep(900);
  await stop();
  await p.waitForFunction(() => location.pathname.startsWith("/people/"), { timeout: 30000 }).catch(() => {});
  await sleep(4500);
  if (p.url().includes("/people/")) { await start(); await caption("7", "One anonymous path, step by step. No names, no links, years only."); await sleep(1500); await scrollBy(350, 1600); await stop(); }
});

await scene("career-routes", async () => {
  await go("/tools/career-routes?tab=path&role=Software+Engineer&country=United+States");
  await waitResult();
  await start();
  await caption("8", "Career Routes: the paths people took to Software Engineer in the US, ranked by fit for you.");
  await sleep(1800); await scrollBy(560, 1800); await scrollBy(560, 1600);
  const g = await byText("h2,h3", "How the routes connect");
  if (await has(g)) {
    await g.evaluate((e) => e.scrollIntoView({ block: "start", behavior: "smooth" })); await sleep(900);
    await caption("8", "Click any step or line to see exactly who took it.");
    const badge = await p.$("[data-clickable]");
    if (badge) await moveTo(badge);
    await sleep(1700);
  }
  await stop();
  await p.evaluate(() => window.scrollTo(0, 0));
  await click(await byText("[role=tab]", "The way in"));
  await waitResult();
  await start();
  await caption("9", "The way in: which employers, titles and schools people came from.");
  await sleep(1200); await scrollBy(600, 1800);
  await stop();
  await p.evaluate(() => window.scrollTo(0, 0));
  await click(await byText("[role=tab]", "Colleges"));
  await waitResult();
  await p.evaluate(() => window.scrollTo(0, 0));
  await start();
  await caption("10", "Colleges & programmes: which universities lead there, and their success rates.");
  await sleep(1400); await scrollBy(640, 1900);
  await caption("10", "USC: 35% of its recent Indian grads got there. Your college, IIT Kanpur, is always shown.");
  await sleep(2200); await scrollBy(560, 1900);
  await stop();
});

await scene("internship", async () => {
  await go("/tools/internship-to-job?tab=chances&country=United+States");
  await waitResult();
  await start();
  await caption("11", "Internship → Job: how often internships turned into full-time offers for people like you.");
  await sleep(1600); await scrollBy(520, 1700);
  await stop();
  await p.evaluate(() => window.scrollTo(0, 0));
  await click(await byText("[role=tab]", "Companies ranked"));
  await waitResult();
  await p.evaluate(() => window.scrollTo(0, 0));
  await start();
  await caption("11", "And which companies actually keep their interns.");
  await sleep(1000); await scrollBy(560, 1800);
  await stop();
});

await scene("job-postings", async () => {
  await go("/tools/job-postings?role=Software+Engineer&country=United+States");
  await waitResult();
  await start();
  await caption("12", "Job Postings: what employers are asking for right now, from live postings.");
  await sleep(1400); await scrollBy(560, 1800);
  await stop();
});

await scene("indian-friendly", async () => {
  await go("/tools/indian-friendly?country=United+States&role=Software+Engineer");
  await waitResult();
  await start();
  await caption("13", "Indian-Friendly: employers that really hire Indian-educated people, with sponsorship signals.");
  await sleep(1400); await scrollBy(560, 1800);
  await stop();
});

await scene("market-saturation", async () => {
  await go("/tools/market-saturation?role=Software+Engineer&country=United+States");
  await waitResult();
  await start();
  await caption("14", "Market Saturation: how crowded this role is, and where it's easier.");
  await sleep(1400); await scrollBy(560, 1800);
  await stop();
});

if (UNI) await scene("university", async () => {
  const me = await p.evaluate(() => localStorage.getItem("afterdegree.profile_id"));
  await p.evaluate((id) => localStorage.setItem("afterdegree.profile_id", id), UNI);
  await go("/tools/people-like-me?match=exact_school");
  await waitResult();
  await start();
  await caption("15", "For universities: the same tools through an institution lens. Where did our graduates go?");
  await sleep(1800); await scrollBy(560, 1900); await scrollBy(500, 1700);
  await stop();
  await p.evaluate((id) => id && localStorage.setItem("afterdegree.profile_id", id), me);
});

await scene("home-end", async () => {
  await go("/home");
  await p.waitForFunction(() => /step by step/.test(document.body.innerText), { timeout: 120000 });
  await sleep(2000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await start();
  await caption("", "Back on your plan: every check you ran, one headline each.");
  await sleep(1200); await scrollBy(700, 1900);
  await stop();
});

await card(`<h1>AfterDegree</h1><p>Exact counts. Anonymous paths. Every number clickable.</p><div class="s">github.com/aayush01x/AfterDegree</div>`, 3500);

writeFileSync(`${OUT}/segments.json`, JSON.stringify(segs, null, 1));
log("done", segs.length, "segments");
await b.close();
