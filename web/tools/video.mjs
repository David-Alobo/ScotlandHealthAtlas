// A tour of the atlas as a video: every scene and every interaction, recorded from the live page
// in headless Chrome (a visible cursor and a short caption name each feature). Frames and their
// timings go to <out>/frames and <out>/frames.txt; tools/video.sh turns them into an MP4.
// Usage (from web/, with tools/serve.py running): node tools/video.mjs <out dir> [url]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const out = process.argv[2] ?? "video";
const url = process.argv[3] ?? "http://127.0.0.1:8000/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const W = 1280;
const H = 720; // CSS pixels; frames are 1.5 times this (1920 x 1080)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(join(out, "frames"), { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1.5 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "networkidle0" });
await page.waitForSelector("body.ready");
const geo = await page.evaluate(() => fetch("data/geo.json").then((r) => r.json()));
const councilIndex = (name) => geo.councils.findIndex((c) => c.council === name);

// A cursor and a caption drawn into the page, since a screencast shows neither
await page.addStyleTag({
  content: `
  #v-cursor { position: fixed; z-index: 9999; left: 0; top: 0; width: 22px; height: 22px;
    pointer-events: none; transform: translate(-3px, -2px); transition: transform 0.12s; }
  #v-cursor.down { transform: translate(-3px, -2px) scale(0.85); }
  #v-ring { position: fixed; z-index: 9998; width: 34px; height: 34px; margin: -17px 0 0 -17px;
    border-radius: 50%; border: 2px solid #a78bfa; pointer-events: none; opacity: 0; }
  #v-ring.go { animation: v-ring 0.5s ease-out; }
  @keyframes v-ring { from { opacity: 1; transform: scale(0.4); } to { opacity: 0; transform: scale(1.4); } }
  #v-cap { position: fixed; z-index: 9997; left: 50%; top: 18px; transform: translateX(-50%);
    font: 500 15px "IBM Plex Sans", system-ui, sans-serif; color: #f4f2ff; letter-spacing: 0.01em;
    background: rgb(18 21 33 / 0.86); border: 1px solid rgb(167 139 250 / 0.45);
    border-radius: 999px; padding: 8px 18px; pointer-events: none; opacity: 0;
    transition: opacity 0.35s; white-space: nowrap; }
  #v-cap.on { opacity: 1; }
  #v-cap b { color: #a78bfa; font-weight: 600; margin-right: 8px; }`,
});
await page.evaluate(() => {
  const cur = document.createElement("div");
  cur.id = "v-cursor";
  cur.innerHTML =
    '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.5 L13.4 19.2 L10.3 12.6 L16.4 12.6 Z" fill="#fff" stroke="#07080c" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const ring = document.createElement("div");
  ring.id = "v-ring";
  const cap = document.createElement("div");
  cap.id = "v-cap";
  document.body.append(cur, ring, cap);
  document.addEventListener("mousemove", (e) => {
    cur.style.left = `${e.clientX}px`;
    cur.style.top = `${e.clientY}px`;
  });
  document.addEventListener("mousedown", (e) => {
    cur.classList.add("down");
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    ring.classList.remove("go");
    void ring.offsetWidth;
    ring.classList.add("go");
  });
  document.addEventListener("mouseup", () => cur.classList.remove("down"));
});

// --- recording ---
const client = await page.createCDPSession();
const frames = [];
let writing = Promise.resolve();
client.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const n = frames.length;
  const file = `frames/${String(n).padStart(5, "0")}.jpg`;
  frames.push({ file, t: metadata.timestamp });
  writing = writing.then(() => writeFileSync(join(out, file), Buffer.from(data, "base64")));
  client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

// --- helpers ---
let mouse = { x: W * 0.62, y: H * 0.5 };
async function moveTo(x, y, ms = 700) {
  const steps = Math.max(2, Math.round(ms / 16));
  const from = { ...mouse };
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in and out
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(16);
  }
  mouse = { x, y };
}
async function click(x, y) {
  await moveTo(x, y);
  await sleep(150);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
}
async function clickOn(selector) {
  const box = await page.$eval(selector, (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await click(box.x, box.y);
}
async function caption(title, text) {
  await page.evaluate(
    (title, text) => {
      const cap = document.getElementById("v-cap");
      cap.innerHTML = text ? `<b>${title}</b>${text}` : `<b>${title}</b>`;
      cap.classList.add("on");
    },
    title,
    text,
  );
}
const uncaption = () => page.evaluate(() => document.getElementById("v-cap").classList.remove("on"));
async function scrollToScene(state, ms = 1600) {
  const target = await page.$$eval(
    ".step",
    (steps, state) => {
      const s = steps.find((x) => x.dataset.state === state);
      return s.offsetTop - Math.max(0, (innerHeight - s.offsetHeight) / 2);
    },
    state,
  );
  const start = await page.evaluate(() => scrollY);
  const steps = Math.round(ms / 16);
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    await page.evaluate((y) => window.scrollTo(0, y), start + (target - start) * e);
    await sleep(16);
  }
}
async function typeSlowly(selector, text) {
  await page.focus(selector);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(110);
  }
}
/** The screen box of a council's outline on the map. */
const councilBox = (name) =>
  page.evaluate((i) => {
    const r = document.querySelectorAll(".layer.map path.council")[i].getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, councilIndex(name));
/** Centres of the chart marks with a tooltip that are on screen and on top, left to right. */
const marks = () =>
  page.$$eval(".stage [data-tip]", (ns) =>
    ns
      .map((n) => {
        const r = n.getBoundingClientRect();
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2;
        const top = document.elementFromPoint(x, y)?.closest("[data-tip]");
        return top === n && r.width > 0 && y > 0 && y < innerHeight ? { x, y } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.x - b.x),
  );
async function hoverMarks(picks, dwell = 1300) {
  const all = await marks();
  for (const k of picks) {
    const m = all[Math.min(all.length - 1, Math.floor(k * (all.length - 1)))];
    if (!m) break;
    await moveTo(m.x, m.y, 600);
    await sleep(dwell);
  }
}

// --- the tour ---
await page.mouse.move(mouse.x, mouse.y);
await client.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1 });
await sleep(3000);

// 1. The opening map: hover neighbourhoods
await caption("Every dot is a neighbourhood", "hover to see its portrait");
let g = await councilBox("Glasgow City");
for (const [fx, fy] of [[0.35, 0.45], [0.55, 0.55], [0.7, 0.4], [0.45, 0.7]]) {
  await moveTo(g.x + g.w * fx, g.y + g.h * fy, 800);
  await sleep(1500);
}
const edin = await councilBox("City of Edinburgh");
await moveTo(edin.x + edin.w * 0.55, edin.y + edin.h * 0.45, 1000);
await sleep(1800);

// 2. Search by postcode, then the pinned card and its sections
await caption("Find your neighbourhood", "search by postcode");
await clickOn("#intro-find");
await sleep(500);
await typeSlowly("#intro-search input", "G51 1BL");
await sleep(500);
await page.keyboard.press("Enter");
await sleep(2200);
await caption("Pinned", "the card follows your neighbourhood through the story");
await sleep(1500);
const tabs = await page.$$("#area-panel-tabs button");
for (let k = 0; k < tabs.length; k++) {
  await clickOn(`#area-panel-tabs button:nth-child(${k + 1})`);
  await sleep(1700);
}
await clickOn("#area-panel-tabs button:nth-child(1)");
await sleep(800);
await uncaption();

// 3. Scroll the story with the pin set
await moveTo(W * 0.5, H * 0.92, 600);
await uncaption();
await scrollToScene("today");
await caption("Every day in Scotland", "the numbers change with the pinned area");
await sleep(3500);
await uncaption();
await scrollToScene("deprived");
await caption("The most deprived fifth", "lit up on the map");
await sleep(3000);
g = await councilBox("Glasgow City");
await caption("Hover while pinned", "the pinned card steps aside");
await moveTo(g.x + g.w * 0.5, g.y + g.h * 0.5, 900);
await sleep(1800);
await moveTo(g.x + g.w * 0.3, g.y + g.h * 0.6, 700);
await sleep(1500);
await moveTo(W * 0.5, H * 0.92, 700);
await sleep(1200);
await uncaption();
await scrollToScene("glasgow");
await caption("Glasgow", "a quarter of Scotland's most deprived neighbourhoods");
await sleep(3500);

await uncaption();
await scrollToScene("ae");
await caption("A&E by deprivation", "hover a point for its value");
await sleep(2200);
await hoverMarks([0.1, 0.55, 0.95]);
await uncaption();
await scrollToScene("ae-ratio");
await caption("Is the gap closing?", "the ratio with what missing data could do");
await sleep(2500);
await hoverMarks([0.2, 0.8]);
await uncaption();
await scrollToScene("waits");
await caption("Waiting longer", "emergency departments against the 4-hour standard");
await sleep(2500);
await hoverMarks([0.3, 0.75]);
await uncaption();
await scrollToScene("waits-12");
await caption("Twelve hours or more", "the longest waits grew fastest");
await sleep(2500);
await uncaption();
await scrollToScene("gp");
await caption("Before A&E: the GP", "GP time per patient by the practice's area");
await sleep(2500);
await hoverMarks([0.0, 0.9]);
await uncaption();
await scrollToScene("crowd");
await caption("A year of injury deaths", "one dot for each death");
await sleep(4000);
await uncaption();
await scrollToScene("split");
await caption("Falls and poisoning", "two different stories");
await sleep(3500);
await uncaption();
await scrollToScene("age");
await caption("Who dies", "falls in old age, poisoning in mid-life");
await sleep(2200);
await hoverMarks([0.15, 0.5, 0.85]);
await uncaption();
await scrollToScene("trend");
await caption("Over ten years", "hover the lines");
await sleep(2500);
await hoverMarks([0.3, 0.6, 0.9]);
await uncaption();
await scrollToScene("poison-map");
await caption("Where poisoning kills", "council rates, small numbers hatched");
await sleep(3500);
g = await councilBox("Glasgow City");
await moveTo(g.x + g.w * 0.5, g.y + g.h * 0.5, 900);
await sleep(1500);
const high = await councilBox("Highland");
await moveTo(high.x + high.w * 0.5, high.y + high.h * 0.45, 900);
await sleep(1500);
await uncaption();
await scrollToScene("scatter");
await caption("Poisoning follows deprivation", "hover a council");
await sleep(2200);
await hoverMarks([0.1, 0.5, 0.9]);
await uncaption();
await scrollToScene("scatter-falls");
await caption("Falls follow it less", "the same comparison for falls");
await sleep(2200);
await hoverMarks([0.2, 0.8]);

// 4. Find your area: a name search and a council
await uncaption();
await scrollToScene("find");
await caption("Find your area", "search by name");
await sleep(1500);
await clickOn('.step[data-state="find"] input');
await typeSlowly('.step[data-state="find"] input', "Leith");
await sleep(1400);
await clickOn('.step[data-state="find"] .search-results li:nth-child(1) button');
await sleep(2500);
await caption("Or choose a council", "and read how it compares");
await clickOn(".picker-button");
await sleep(700);
const dundee = await page.$eval("#council-select", (s) => [...s.options].findIndex((o) => o.value === "Dundee City"));
await page.$eval(`#council-select-option-${dundee}`, (li) => li.scrollIntoView({ block: "center" }));
await sleep(500);
await clickOn(`#council-select-option-${dundee}`);
await sleep(3200);
await caption("Unpin", "or click anywhere to clear");
await clickOn("#area-panel-close");
await sleep(1500);
await uncaption();

// 5. The summary
await moveTo(W * 0.5, H * 0.92, 600);
await uncaption();
await scrollToScene("end", 2000);
await caption("Summary", "same country, different risks");
await sleep(5000);
await caption("david-alobo.github.io/ScotlandHealthAtlas", "");
await sleep(3500);

await client.send("Page.stopScreencast");
await writing;
await browser.close();

// frames.txt for ffmpeg's concat demuxer: each frame shown until the next one arrived
const lines = [];
for (let k = 0; k < frames.length; k++) {
  const next = frames[k + 1]?.t ?? frames[k].t + 1 / 30;
  lines.push(`file '${frames[k].file}'`, `duration ${Math.max(0.001, next - frames[k].t).toFixed(4)}`);
}
lines.push(`file '${frames.at(-1).file}'`);
writeFileSync(join(out, "frames.txt"), `${lines.join("\n")}\n`);
const length = frames.at(-1).t - frames[0].t;
console.log(`${frames.length} frames, ${length.toFixed(1)} s; errors: ${errors.length ? errors.join(" | ") : "none"}`);
