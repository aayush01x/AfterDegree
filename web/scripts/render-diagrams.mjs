import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";
const OUT = "/home/swixzt/afterdegree/docs/diagrams";
const C = { blue: "#a5d8ff", yellow: "#ffec99", green: "#b2f2bb", pink: "#ffc9c9", violet: "#d0bfff", orange: "#ffd8a8", grey: "#e9ecef" };
const box = (id, x, y, w, h, text, bg = C.blue, extra = {}) => ({ type: "rectangle", id, x, y, width: w, height: h, backgroundColor: bg, fillStyle: "solid", strokeWidth: 2, roundness: { type: 3 }, label: { text, fontSize: 18 }, ...extra });
let BOXES = {};
const arrow = (from, to, label) => ({ __arrow: true, from, to, label });
function layoutArrows(list) {
  BOXES = Object.fromEntries(list.filter((e) => e.type === "rectangle").map((e) => [e.id, e]));
  return list.map((e) => {
    if (!e.__arrow) return e;
    const A = BOXES[e.from], B = BOXES[e.to];
    let sx, sy, ex, ey;
    if (B.x >= A.x + A.width) { sx = A.x + A.width; sy = A.y + A.height / 2; ex = B.x; ey = B.y + B.height / 2; }
    else if (B.x + B.width <= A.x) { sx = A.x; sy = A.y + A.height / 2; ex = B.x + B.width; ey = B.y + B.height / 2; }
    else if (B.y >= A.y + A.height) { sx = A.x + A.width / 2; sy = A.y + A.height; ex = B.x + B.width / 2; ey = B.y; }
    else { sx = A.x + A.width / 2; sy = A.y; ex = B.x + B.width / 2; ey = B.y + B.height; }
    // Fan-out/fan-in between rows: aim at the facing edge, nudged toward the other box's centre.
    if (B.y >= A.y + A.height || B.y + B.height <= A.y) {
      sx = Math.min(A.x + A.width - 20, Math.max(A.x + 20, B.x + B.width / 2 + (A.x + A.width / 2 - (B.x + B.width / 2)) * 0.6));
      ex = Math.min(B.x + B.width - 20, Math.max(B.x + 20, A.x + A.width / 2 + (B.x + B.width / 2 - (A.x + A.width / 2)) * 0.6));
    }
    const gap = 6;
    const len = Math.hypot(ex - sx, ey - sy) || 1;
    const ux = (ex - sx) / len, uy = (ey - sy) / len;
    sx += ux * gap; sy += uy * gap; ex -= ux * gap; ey -= uy * gap;
    return {
      type: "arrow", x: sx, y: sy, width: ex - sx, height: ey - sy,
      points: [[0, 0], [ex - sx, ey - sy]], strokeWidth: 2,
      ...(e.label ? { label: { text: e.label, fontSize: 15 } } : {}),
    };
  });
}
const title = (x, y, text, size = 28) => ({ type: "text", x, y, text, fontSize: size });

const diagrams = {
  "user-journey": [
    title(40, 0, "How someone uses AfterDegree"),
    box("url", 40, 70, 230, 90, "Paste your\nLinkedIn URL", C.yellow),
    box("enrich", 340, 70, 250, 90, "Crustdata reads\nyour profile only", C.blue),
    box("chat", 660, 70, 260, 90, "A short chat sets\nyour goal (LLM)", C.violet),
    box("home", 990, 70, 230, 90, "Your plan\n(Home)", C.green),
    arrow("url", "enrich"), arrow("enrich", "chat"), arrow("chat", "home"),
    { type: "rectangle", id: "toolsrow", x: 20, y: 240, width: 1390, height: 160, backgroundColor: "transparent", strokeStyle: "dashed", strokeWidth: 2, roundness: { type: 3 } },
    { type: "text", x: 40, y: 360, text: "Six tools, each answering one question", fontSize: 16 },
    box("plm", 40, 260, 200, 80, "People Like Me", C.orange),
    box("routes", 270, 260, 200, 80, "Career Routes", C.orange),
    box("i2j", 500, 260, 200, 80, "Internship → Job", C.orange),
    box("jobs", 730, 260, 200, 80, "Job Postings", C.orange),
    box("ifc", 960, 260, 200, 80, "Indian-Friendly", C.orange),
    box("sat", 1190, 260, 200, 80, "Market\nSaturation", C.orange),
    arrow("home", "toolsrow"),
    box("click", 470, 460, 460, 80, "Click any number", C.pink),
    arrow("toolsrow", "click"),
    box("country", 40, 630, 220, 80, "Country", C.grey),
    box("city", 330, 630, 220, 80, "City", C.grey),
    box("company", 620, 630, 260, 80, "Company profile", C.grey),
    box("person", 950, 630, 320, 80, "One anonymous\ncareer path", C.green),
    arrow("click", "country"), arrow("country", "city"), arrow("city", "company"), arrow("company", "person"),
    { type: "text", x: 40, y: 750, text: "Every drill keeps the filters of the page you came from.", fontSize: 18 },
  ],
  "architecture": [
    title(40, 0, "What runs where"),
    box("browser", 40, 80, 300, 120, "Browser\nNext.js app (:3000)", C.yellow),
    box("engine", 480, 80, 320, 120, "AfterDegree engine\nFastAPI (:8000)", C.blue),
    arrow("browser", "engine", "/api/* (proxied)"),
    box("jobs", 480, 290, 320, 90, "Job runner\n(each tool run is a job)", C.violet),
    arrow("engine", "jobs"),
    box("tools", 480, 450, 320, 100, "Tools + drill-downs\ncohorts, counts, routes", C.orange),
    arrow("jobs", "tools"),
    box("client", 900, 450, 330, 100, "Crustdata client\nrate limits · budget · cache", C.blue),
    arrow("tools", "client"),
    box("crust", 900, 650, 330, 110, "Crustdata API\npeople · companies · jobs\nweb search", C.green),
    arrow("client", "crust"),
    box("db", 40, 450, 300, 100, "SQLite\nprofiles · jobs · drills", C.grey),
    arrow("tools", "db"),
    box("llm", 900, 80, 330, 120, "OpenRouter\nDeepSeek (onboarding chat\nand write-ups)", C.pink),
    arrow("engine", "llm"),
    { type: "text", x: 40, y: 260, text: "The browser polls\n/api/jobs/{id}\nuntil a run is done.", fontSize: 18 },
  ],
  "how-numbers-are-made": [
    title(40, 0, "How every number is made"),
    box("q", 40, 80, 300, 90, "Your question\n(goal, filters, click path)", C.yellow),
    box("cohort", 420, 80, 330, 90, "Build the group\nschool · field · grad years", C.blue),
    box("widen", 830, 80, 330, 90, "Too few people?\nWiden it and say so", C.pink),
    arrow("q", "cohort"), arrow("cohort", "widen"),
    box("counts", 420, 250, 330, 100, "Exact count-only\nsearches first", C.green),
    arrow("cohort", "counts"),
    box("sample", 830, 250, 330, 100, "Read a small sample\nonly to pick what to count", C.violet),
    arrow("counts", "sample"),
    box("rule", 420, 440, 330, 110, "Each number is an exact total\nor labelled\n\"from N profiles read\"", C.orange),
    arrow("sample", "rule"),
    box("privacy", 830, 440, 330, 110, "Fewer than 5 people?\nFold into \"Other\",\nno names, ever", C.pink),
    arrow("rule", "privacy"),
    box("result", 40, 440, 300, 110, "Result with a\ndrill token on\nevery row", C.green),
    arrow("rule", "result"),
  ],
};

const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("pageerror", String(e)));
await p.setContent(`<!doctype html><html><head>
<script>window.EXCALIDRAW_ASSET_PATH="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/";</script>
<script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js"></script>
</head><body></body></html>`, { waitUntil: "networkidle0", timeout: 120000 });
for (const [name, raw] of Object.entries(diagrams)) {
  const skeleton = layoutArrows(raw);
  const out = await p.evaluate(async (skeleton) => {
    const L = window.ExcalidrawLib;
    const elements = L.convertToExcalidrawElements(skeleton);
    await document.fonts.load("20px Virgil").catch(() => {});
    const appState = { exportBackground: true, viewBackgroundColor: "#ffffff", exportScale: 2 };
    const blob = await L.exportToBlob({ elements, appState, files: null, exportPadding: 32, mimeType: "image/png", quality: 1, getDimensions: (w, h) => ({ width: w * 2, height: h * 2, scale: 2 }) });
    const png = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    const json = L.serializeAsJSON(elements, { viewBackgroundColor: "#ffffff" }, {}, "local");
    return { png, json };
  }, skeleton);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(out.png.split(",")[1], "base64"));
  writeFileSync(`${OUT}/${name}.excalidraw`, out.json);
  console.log("wrote", name);
}
await b.close();
