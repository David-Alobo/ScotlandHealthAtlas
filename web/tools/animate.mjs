// A short looping animation of the story (animated WebP) for READMEs and profiles: frames captured
// from the live page while it moves through the main scenes, encoded with img2webp.
// Usage (from web/, with tools/serve.py running): node tools/animate.mjs <out.webp> [url]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const out = process.argv[2] ?? "atlas.webp";
const url = process.argv[3] ?? "http://127.0.0.1:8000/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const IMG2WEBP = process.env.IMG2WEBP ?? "img2webp";
const SCENES = ["intro", "deprived", "glasgow", "split", "age", "poison-map", "scatter"];
const FPS = 8;
const CROP_X = 330; // the cards are hidden, so frames keep only the visual side
const MOVE = 2.2; // seconds of motion captured after each scroll
const HOLD = 0.8; // seconds of stillness at the end of each scene

const dir = mkdtempSync(join(tmpdir(), "atlas-frames-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.waitForSelector("body.ready");
// the visuals only: no cards, controls or legends (the README gives the words)
await page.addStyleTag({
  content: ".card, .legend, .step.title > *, .search, .area-panel { visibility: hidden !important; }",
});
await new Promise((r) => setTimeout(r, 2500));
let n = 0;
const frame = async () => {
  const top = await page.evaluate(() => window.scrollY);
  await page.screenshot({
    path: join(dir, `${String(n++).padStart(4, "0")}.png`),
    clip: { x: CROP_X, y: top, width: 960 - CROP_X, height: 600 }, // the visual side of the stage
    captureBeyondViewport: false,
  });
};
for (const scene of SCENES) {
  if (scene !== "intro") {
    await page.$$eval(".step", (s, name) => s.find((x) => x.dataset.state === name).scrollIntoView({ block: "center" }), scene);
  }
  const frames = Math.round((scene === "intro" ? HOLD * 2 : MOVE + HOLD) * FPS);
  for (let i = 0; i < frames; i++) {
    await frame();
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }
}
await browser.close();

const files = readdirSync(dir).sort().map((f) => join(dir, f));
mkdirSync(join(out, ".."), { recursive: true });
execFileSync(IMG2WEBP, ["-loop", "0", "-lossy", "-q", "62", "-m", "6", "-d", String(Math.round(1000 / FPS)), ...files, "-o", out]);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${out} from ${files.length} frames`);
