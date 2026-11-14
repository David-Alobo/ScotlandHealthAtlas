// A one-page static version of the story (A3 landscape PDF and PNG), for entry forms that want a
// file: six scenes captured from the live page, numbers from the same story.json.
// Usage (from web/, with tools/serve.py running): node tools/poster.mjs [out dir] [url]
import { mkdirSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { facts } from "../js/facts.js";

const out = process.argv[2] ?? "../docs/poster";
const url = process.argv[3] ?? "http://127.0.0.1:8000/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const story = JSON.parse(readFileSync(new URL("../data/story.json", import.meta.url), "utf8"));
const f = facts(story);
mkdirSync(out, { recursive: true });

const SCENES = [
  ["deprived", "Where the most deprived neighbourhoods are", `Each dot is a neighbourhood of about 800 people. Lit: the most deprived fifth, ${f.zonesQ1} neighbourhoods; Glasgow holds ${f.glasgowQ1} of them.`],
  ["ae", "Twice as often", `A&E visits per 1,000 people by deprivation fifth, same age and sex: ${f.aeQ1Latest} in the most deprived fifth against ${f.aeQ5Latest} in the least (${f.aeLatestYear}).`],
  ["age", "Two kinds of injury death", `One dot per death a year. ${f.falls75Share} of deaths after a fall are at 75 or over; ${f.poisoning2564Share} of poisoning deaths at 25 to 64.`],
  ["trend", "The rise and fall", `Poisoning deaths rose from ${f.poisonFirst} (${f.trendFirst}) to ${f.poisonPeak} (${f.poisonPeakYear}), then fell to ${f.poisonLast}; deaths after a fall rose to ${f.fallsLast}.`],
  ["poison-map", "Where poisoning kills", `Poisoning death rates by council, ${f.councilPeriod}: ${f.aboveCount} councils clearly above Scotland's rate and ${f.belowCount} clearly below. Hatched: too few deaths.`],
  ["scatter", "Following deprivation", `Councils with more people in the most deprived fifth have more poisoning deaths (rank correlation ${f.rhoPoisoning}); falls admissions much less so (${f.rhoFalls}).`],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const W = 1400;
const H = 900;
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.waitForSelector("body.ready");
await page.addStyleTag({ content: ".card, .step.title > * { visibility: hidden !important; }" });
const shots = {};
for (const [state] of SCENES) {
  await page.$$eval(".step", (steps, s) => steps.find((x) => x.dataset.state === s).scrollIntoView({ block: "center" }), state);
  await new Promise((r) => setTimeout(r, 2800));
  const top = await page.evaluate(() => window.scrollY); // clip is in page coordinates
  // no capture beyond the viewport: enlarging the page would resize (and clear) the dot canvas
  const png = await page.screenshot({
    clip: { x: W * 0.37, y: top, width: W * 0.63, height: H },
    captureBeyondViewport: false,
    encoding: "base64",
  });
  shots[state] = `data:image/png;base64,${png}`;
}

const tile = (n, label) => `<div class="tile"><b>${n}</b><span>${label}</span></div>`;
const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
  @page { size: 420mm 297mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; width: 420mm; height: 297mm; background: #07080c; color: #c9cdd8; font: 400 9.5pt/1.45 "IBM Plex Sans", sans-serif; padding: 14mm 16mm 10mm; display: flex; flex-direction: column; }
  header { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10mm; align-items: end; margin-bottom: 7mm; }
  .eyebrow { font: 500 8pt "IBM Plex Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: #a78bfa; }
  h1 { font: 700 34pt/1.02 "Space Grotesk", sans-serif; color: #eef0f5; margin: 2mm 0 3mm; letter-spacing: -.02em; }
  .lede { font-size: 11pt; color: #c9cdd8; margin: 0; max-width: 150mm; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
  .tile b { display: block; font: 700 20pt/1 "Space Grotesk", sans-serif; background: linear-gradient(100deg,#fff,#a78bfa 55%,#22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tile span { font-size: 8pt; color: #8d94a6; }
  .daylabel { grid-column: 1 / -1; font: 500 7.5pt "IBM Plex Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #8d94a6; }
  .grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr; gap: 5mm; min-height: 0; }
  .panel { background: #0d0f16; border: 1px solid rgb(255 255 255 / .08); border-radius: 4mm; padding: 4mm; display: flex; flex-direction: column; min-height: 0; }
  .panel h2 { font: 600 12pt "Space Grotesk", sans-serif; color: #eef0f5; margin: 0 0 1.5mm; }
  .panel p { margin: 0 0 2mm; font-size: 8.5pt; }
  .panel img { flex: 1; min-height: 0; width: 100%; object-fit: contain; border-radius: 2mm; }
  footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 10mm; margin-top: 6mm; font-size: 8pt; color: #8d94a6; }
  footer b { color: #eef0f5; }
  footer .suggests { font-size: 9.5pt; color: #c9cdd8; }
  a { color: #a78bfa; text-decoration: none; }
</style></head><body>
<header>
  <div><div class="eyebrow">Scotland Health Atlas</div><h1>Same country, different risks</h1>
  <p class="lede">Where you live shapes how often you end up in A&amp;E and your risk of dying of poisoning. How old you are shapes your risk from a fall. Two problems, two groups of people, one health service.</p></div>
  <div class="tiles"><div class="daylabel">Every day in Scotland</div>
    ${tile(f.dayAe, "visits to A&amp;E")}${tile(f.dayAdmissions, "emergency admissions after an accident")}${tile(f.dayDeaths, "deaths from an accident")}${tile(f.dayItems, "prescription items dispensed")}</div>
</header>
<div class="grid">
  ${SCENES.map(([s, h, p]) => `<div class="panel"><h2>${h}</h2><p>${p}</p><img src="${shots[s]}" alt="${h}"></div>`).join("")}
</div>
<footer>
  <div class="suggests"><b>What this suggests.</b> Poisoning deaths are concentrated where deprivation is, so work in those places reaches much of the risk. Falls are spread across older people wherever they live, so they call for help that reaches older people everywhere.</div>
  <div>Data: Public Health Scotland (Data Lab competition package, 2026); NRS small area population estimates; SIMD 2020v2; data zone boundaries 2011, Scottish Government (OGL). Rates standardised for age and sex. Every number is read from the saved analysis tables.
  Explore it and find your neighbourhood: <a href="https://david-alobo.github.io/ScotlandHealthAtlas/">david-alobo.github.io/ScotlandHealthAtlas</a> · David Obeh Alobo, Monstrous Data</div>
</footer>
</body></html>`;

const sheet = await browser.newPage();
await sheet.setViewport({ width: 1587, height: 1123, deviceScaleFactor: 2 }); // A3 at 96 dpi
await sheet.setContent(html, { waitUntil: "networkidle0" });
await sheet.pdf({ path: `${out}/poster.pdf`, width: "420mm", height: "297mm", printBackground: true });
await sheet.screenshot({ path: `${out}/poster.png` });
await browser.close();
console.log(`wrote ${out}/poster.pdf and poster.png`);
