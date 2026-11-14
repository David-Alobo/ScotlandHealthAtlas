// Screenshot every scene of the story the way a reader sees it: scroll each step to the middle of
// the screen, wait for the transitions, capture. Usage: node tools/shots.mjs <url> <out dir> [w h]
// (CSS pixels; set DSF=1.5 for a screen at 150% scaling)
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [url = "http://127.0.0.1:8000/", out = "shots", w = "1440", h = "900"] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: Number(process.env.DSF ?? 1) });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle0" });
await page.waitForSelector("body.ready");
const n = await page.$$eval(".step", (s) => s.length);
for (let i = 0; i < n; i++) {
  const state = await page.$$eval(".step", (s, k) => {
    s[k].scrollIntoView({ block: "center" });
    return s[k].dataset.state;
  }, i);
  await new Promise((r) => setTimeout(r, 2600)); // transitions run up to about 2 s
  await page.screenshot({ path: `${out}/${String(i).padStart(2, "0")}-${state}.png` });
}
await browser.close();
console.log(`${n} scenes; errors: ${errors.length ? errors.join(" | ") : "none"}`);
