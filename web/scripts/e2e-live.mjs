// Live-mode end-to-end test: Next.js UI (:3000) against the engine in mock mode (:8000).
// Run:  cd web && node scripts/e2e-live.mjs      (env: WEB=http://localhost:3000, HEADFUL=1, SHOTS=dir)
// Drives the system Chrome via puppeteer-core. Exits 1 on any failure.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = process.env.WEB ?? "http://localhost:3000";
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome-stable";
const SHOTS = process.env.SHOTS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.impeccable/review/live");
mkdirSync(SHOTS, { recursive: true });

const failures = [];
const consoleErrors = [];
const badRequests = [];
const fail = (where, msg) => {
  failures.push(`${where}: ${msg}`);
  console.log(`  FAIL ${where}: ${msg}`);
};
const ok = (msg) => console.log(`  ok   ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: !process.env.HEADFUL,
  args: ["--no-sandbox", "--disable-gpu"],
  defaultViewport: { width: 1280, height: 900 },
});

let current = "start";
async function newPage() {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      // Failed-resource lines are covered by the response listener below (with URL).
      consoleErrors.push(`[${current}] ${t}`);
    }
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${current}] pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (u.includes("/api/") && r.failure()?.errorText !== "net::ERR_ABORTED") badRequests.push(`[${current}] FAILED ${r.method()} ${u} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/") && r.status() >= 400) badRequests.push(`[${current}] ${r.status()} ${r.request().method()} ${u}`);
  });
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const bodyText = (page) => page.evaluate(() => document.body.innerText);

async function checkText(page, where) {
  const t = await bodyText(page);
  for (const re of [/\bundefined\b/, /\bNaN\b/, /\[object /, /\bnull\b/, /Infinity/]) {
    const m = re.exec(t);
    if (m) fail(where, `page text contains "${m[0]}" near: ${t.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, " ")}`);
  }
}
async function alerts(page) {
  return page.$$eval('[role="alert"]', (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
}
async function waitForText(page, text, timeout = 30000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}
async function clickButton(page, label, timeout = 20000) {
  const handle = await page.waitForFunction(
    (l) => [...document.querySelectorAll("button, a")].find((b) => b.innerText.trim() === l && !b.disabled),
    { timeout },
    label,
  );
  await handle.asElement().click();
}

async function onboard(name, { url, replies, uni = false, institution = null }) {
  current = name;
  console.log(`\n== onboarding: ${name}`);
  const page = await newPage();
  await page.evaluate(() => 0);
  await page.goto(`${WEB}/onboarding`, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${WEB}/onboarding`, { waitUntil: "networkidle2" });
  await shot(page, `${name}-1-url`);
  await page.type('input[name="linkedin_url"]', url);
  await clickButton(page, "Read my profile");
  try {
    await waitForText(page, "Is this you?", 30000);
    ok("profile read, review step shown");
  } catch {
    fail(name, `review step not reached; alerts/text: ${(await bodyText(page)).slice(0, 300).replace(/\s+/g, " ")}`);
    return page;
  }
  await shot(page, `${name}-2-review`);
  await checkText(page, `${name}/review`);
  // Exercise an edit: add a skill.
  await page.type('input[placeholder="e.g. Airflow"]', "Airflow");
  await clickButton(page, "Add");
  await waitForText(page, "Airflow", 5000).then(() => ok("added a skill"), () => fail(name, "added skill not shown"));
  await clickButton(page, "Yes, this is me");
  try {
    await waitForText(page, "A few questions about where you", 10000);
    // The UI sends its own opener as the first user turn, so the first mentor reply is already question 2.
    await page.waitForFunction(() => document.querySelectorAll('ol[aria-label="Conversation"] li').length >= 2 && !document.body.innerText.includes("Mentor is writing"), { timeout: 20000 });
    ok("mentor chat opened with first reply");
  } catch {
    fail(name, "chat did not open / no mentor reply: " + (await bodyText(page)).slice(0, 300).replace(/\s+/g, " "));
    await shot(page, `${name}-3-chat-fail`);
    return page;
  }
  for (let i = 0; i < replies.length; i++) {
    const before = await page.$$eval('ol[aria-label="Conversation"] li', (l) => l.length);
    const r = replies[i];
    if (r.type) {
      await page.type('input[placeholder="Type your answer"]', r.type);
      await clickButton(page, "Send");
    } else {
      await clickButton(page, r.tap);
    }
    try {
      await page.waitForFunction(
        (b) => document.querySelectorAll('ol[aria-label="Conversation"] li').length >= b + 2 && !document.body.innerText.includes("Mentor is writing"),
        { timeout: 20000 },
        before,
      );
    } catch {
      fail(name, `no mentor reply after "${r.type ?? r.tap}"`);
      break;
    }
    if (i === 0 && institution) {
      // The mock enrich fixture is a company employee, so the engine guesses the employer as institution; correct it in the goals editor.
      const inp = await page.waitForSelector("#goal-institution", { timeout: 5000 }).catch(() => null);
      if (!inp) fail(name, "persona did not switch to university after the first reply (no institution field)");
      else {
        await inp.focus();
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyA");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");
        await inp.type(institution);
      }
    }
    if (i === 1) await shot(page, `${name}-3-chat-mid`);
  }
  await shot(page, `${name}-3-chat-end`);
  const chatAlerts = await alerts(page);
  if (chatAlerts.length) fail(name, `chat alert: ${chatAlerts.join(" | ")}`);
  await checkText(page, `${name}/chat`);
  try {
    await clickButton(page, "That's right, continue", 5000);
  } catch {
    ok("chat not marked done; using skip link");
    await clickButton(page, "Skip the rest of the questions");
  }
  await waitForText(page, uni ? "Ready to see where your graduates went" : "Ready to see people like you", 10000).catch(() =>
    fail(name, `confirm step heading missing (expected ${uni ? "university" : "student"} variant)`),
  );
  await shot(page, `${name}-4-confirm`);
  await checkText(page, `${name}/confirm`);
  await clickButton(page, uni ? "Show me where our graduates are" : "Show me people like me");
  try {
    await page.waitForFunction(() => location.pathname === "/home", { timeout: 20000 });
    ok("landed on /home");
  } catch {
    fail(name, "did not reach /home: " + (await bodyText(page)).slice(0, 300).replace(/\s+/g, " "));
  }
  return page;
}

async function checkHome(page, name) {
  current = `${name}/home`;
  console.log(`\n== home (${name})`);
  try {
    await page.waitForFunction(
      () => document.querySelector('main svg[role="img"]') && document.querySelector('ul[role="list"][aria-label]') && !/Counting /.test(document.body.innerText),
      { timeout: 90000 },
    );
  } catch {
    fail(current, "home did not finish rendering (GridNumber/waffle) in 90s");
  }
  await sleep(1500); // let the assemble animation settle
  await shot(page, `${name}-5-home`);
  const a = await alerts(page);
  if (a.length) fail(current, `error state: ${a.join(" | ")}`);
  const info = await page.evaluate(() => ({
    gridNumber: [...document.querySelectorAll('svg[role="img"]')].map((s) => s.getAttribute("aria-label")),
    waffleRows: document.querySelectorAll('ul[role="list"][aria-label] > li').length,
    panels: document.querySelectorAll("section[aria-labelledby]").length,
    panelTitles: [...document.querySelectorAll("section[aria-labelledby]")].map((s) => document.getElementById(s.getAttribute("aria-labelledby"))?.innerText),
  }));
  console.log("  ", JSON.stringify(info));
  if (!info.gridNumber.length) fail(current, "no GridNumber");
  if (info.waffleRows < 1) fail(current, "cohort waffle has no rows");
  if (info.panels < 4) fail(current, `expected waffle panel + 3 panels, found ${info.panels}: ${info.panelTitles}`);
  else ok(`GridNumber ${info.gridNumber[0]}, waffle rows ${info.waffleRows}, panels: ${info.panelTitles.join(" / ")}`);
  await checkText(page, current);
}

const TOOLS = ["people-like-me", "internship-chances", "conversion-map", "reverse-gps", "routes-to-position", "job-postings", "indian-friendly", "market-saturation"];
const FILL = { country: "Germany", role: "Data Engineer", city: "Berlin", goal_text: "Data Engineer in Berlin", "scope.country": "Germany", "scope.field": "Computer Science" };

async function fillAndRun(page) {
  // Wait for the form (profile loaded)
  await page.waitForSelector("form", { timeout: 20000 });
  for (const [name, value] of Object.entries(FILL)) {
    const el = await page.$(`input[name="${name}"]`);
    if (!el) continue;
    await el.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await el.type(value);
  }
  await sleep(300);
  // An automatic run may already be in flight; wait for it to settle before pressing Run.
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Running"), { timeout: 90000 }).catch(() => {});
  const btn = await page.$('form button[type="submit"]');
  await btn.click();
}

async function tool(page, slug, tag) {
  current = `${tag}/${slug}`;
  console.log(`\n== tool ${slug} (${tag})`);
  await page.goto(`${WEB}/tools/${slug}`, { waitUntil: "networkidle2" });
  try {
    await fillAndRun(page);
  } catch (e) {
    fail(current, `could not fill/run form: ${e.message}`);
    return;
  }
  // wait for: run started (Working on it / Running) then ended
  await sleep(500);
  try {
    await page.waitForFunction(
      () => {
        const t = document.body.innerText;
        const busy = /Working on it/.test(t) || [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Running");
        const alerts = document.querySelectorAll('[role="alert"]').length;
        const idle = /Fill in what you know and press/.test(t);
        return !busy && !idle || alerts > 0;
      },
      { timeout: 120000, polling: 500 },
    );
  } catch {
    fail(current, "run did not finish in 120s");
  }
  await sleep(1500);
  await shot(page, `${tag}-tool-${slug}`);
  const a = await alerts(page);
  if (a.length) fail(current, `error state: ${a.join(" | ")}`);
  const info = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const panels = [...main.querySelectorAll("section[aria-labelledby]")].map((s) => document.getElementById(s.getAttribute("aria-labelledby"))?.innerText);
    return { panels, empty: /Fill in what you know and press/.test(document.body.innerText), len: main.innerText.length };
  });
  if (info.empty) fail(current, "result never rendered (empty state still showing)");
  else if (info.panels.length < 2) fail(current, `result view looks missing, panels: ${JSON.stringify(info.panels)}`);
  else ok(`result rendered, panels: ${info.panels.join(" / ")}`);
  await checkText(page, current);
}

try {
  // 1+2: student persona
  let page = await onboard("student", {
    url: "https://www.linkedin.com/in/riya-menon",
    replies: [{ tap: "A master's abroad" }, { type: "Germany, mostly Berlin and Munich" }, { tap: "Data Engineer" }, { tap: "Nothing else" }],
  });
  await checkHome(page, "student");
  // 3: all tools
  for (const slug of TOOLS) await tool(page, slug, "student");
  await page.close();

  // 4: university persona (engine mock has one enrich fixture, Riya; persona is chosen via the chat, as the engine's deterministic extractor supports)
  page = await onboard("university", {
    url: "https://www.linkedin.com/in/anjali-iyer-careers",
    uni: true,
    institution: "Vellore Institute of Technology",
    replies: [
      { type: "I run the placement cell at our university and want to see where our graduates went" },
      { type: "Germany" },
      { type: "Data Engineer" },
      { type: "Nothing else" },
    ],
  });
  await checkHome(page, "university");
  for (const slug of ["people-like-me", "conversion-map", "market-saturation"]) await tool(page, slug, "university");
  await page.close();
} catch (e) {
  fail(current, `script error: ${e.stack ?? e}`);
} finally {
  await browser.close();
}

console.log("\n== summary");
console.log(`console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log("  " + e.slice(0, 400)));
console.log(`bad /api requests: ${badRequests.length}`);
badRequests.forEach((e) => console.log("  " + e));
console.log(`failures: ${failures.length}`);
failures.forEach((f) => console.log("  " + f));
console.log(`screenshots: ${SHOTS}`);
process.exit(failures.length || consoleErrors.length || badRequests.length ? 1 : 0);
