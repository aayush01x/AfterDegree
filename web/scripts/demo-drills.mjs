// Records the AfterDegree demo: scripted Chrome session, one screencast per scene, captions and a
// cursor drawn in the page. Run with the app live on :3000 and the engine on :8000.
//   node scripts/demo-video.mjs <outDir> <universityProfileId>
import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";

const OUT = process.argv[2];
const ME = process.argv[3];
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


// ================= DRILL SCENES (spliced into the main cut) =================
await p.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
await p.evaluate((id) => { localStorage.setItem("afterdegree.profile_id", id); localStorage.setItem("afterdegree.theme", "blueprint"); }, ME);

async function openPersonFromExplore(step) {
  await p.waitForFunction(() => location.pathname.startsWith("/explore"), { timeout: 30000 });
  await stop();
  await p.waitForFunction(() => document.querySelector("[data-tile]") || /fewer than 5|can't list/i.test(document.body.innerText), { timeout: 300000 });
  await sleep(1500);
  await start();
  await caption(step, "Exactly the people behind that number: their cities, employers and paths.");
  await sleep(1300); await scrollBy(520, 1600); await scrollBy(520, 1600);
  const tile = await p.$("[data-tile] [role=button], [data-tile] a, [data-tile] button") || await p.$("[data-tile]");
  if (tile) { await click(tile); await sleep(700); }
  await stop();
  if (tile) {
    await p.waitForFunction(() => location.pathname.startsWith("/people/"), { timeout: 30000 }).catch(() => {});
    await p.waitForFunction(() => /\d{4}/.test(document.querySelector("main")?.innerText || ""), { timeout: 60000 }).catch(() => {});
    await sleep(2500);
    await start();
    await caption(step, "One anonymous career path, step by step. No names, no links, years only.");
    await sleep(1500); await scrollBy(380, 1700);
    await stop();
  }
}

await scene("drill-route", async () => {
  await go("/tools/career-routes?tab=path&role=Software+Engineer&country=United+States");
  await waitResult();
  const see = await byText("a,button,[role=button]", "^See the \\d* ?people");
  await see.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await sleep(600);
  await start();
  await caption("8", "Click a route to see exactly who took it, step for step.");
  await click(see);
  await openPersonFromExplore("8");
});

await scene("drill-college", async () => {
  await go("/tools/career-routes?tab=colleges&role=Software+Engineer&country=United+States");
  await waitResult();
  const row = await p.evaluateHandle(() => [...document.querySelectorAll("tr[role=button]")].find((e) => /Southern California/.test(e.textContent)) || null);
  await row.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await sleep(600);
  await start();
  await caption("10", "Click a university: its Indian graduates who became Software Engineers in the US.");
  await click(row);
  await openPersonFromExplore("10");
});

await scene("drill-company", async () => {
  await go("/tools/indian-friendly?country=United+States&role=Software+Engineer");
  await waitResult();
  const emp = await p.evaluateHandle(() => [...document.querySelectorAll("tr[role=button],[role=button],button")].find((e) => /see who|see the people|employer/i.test(e.getAttribute("aria-label") || "") && !/^(Other|Elsewhere)/i.test(e.textContent || "")) || null);
  await emp.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await sleep(600);
  await start();
  await caption("13", "Click an employer for its full profile.");
  await click(emp);
  await p.waitForFunction(() => location.pathname.startsWith("/explore"), { timeout: 30000 });
  await stop();
  await p.waitForFunction(() => /Hiring|Offices|headcount|Indian-educated/i.test(document.querySelector("main")?.innerText || "") && !/Working on it/.test(document.body.innerText), { timeout: 300000 });
  await sleep(2000);
  await start();
  await caption("13", "Company profile: headcount, offices, Indian-educated hires, feeder employers, open roles, sponsorship.");
  await sleep(1500); await scrollBy(600, 1800); await scrollBy(600, 1800); await scrollBy(600, 1800);
  await stop();
});

writeFileSync(`${OUT}/segments.json`, JSON.stringify(segs, null, 1));
log("done", segs.length, "segments");
await b.close();
