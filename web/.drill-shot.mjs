// node .drill-shot.mjs <out.png> <path> [width] [fullHeight?]
import puppeteer from "puppeteer-core";
const [out, path, width = "1440", full = "1"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true, args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: Number(width), height: 1000 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("http://localhost:3000/home", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { localStorage.setItem("afterdegree.profile_id", "p_11797dfc31d9"); sessionStorage.setItem("afterdegree.drillmock", "1"); });
await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, Number(process.env.WAIT ?? 4000)));
await p.screenshot({ path: out, fullPage: full === "1" });
console.log("url", p.url());
console.log(errs.slice(0, 8).join("\n"));
await b.close();
