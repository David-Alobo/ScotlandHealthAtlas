// The link preview image (og.png, 1200 x 630): the opening scene as readers first see it.
// Usage (from web/, with tools/serve.py running): node tools/og.mjs [url]
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://127.0.0.1:8000/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle0" });
await page.waitForSelector("body.ready");
// the preview shows the title and map, not the controls
await page.addStyleTag({ content: ".search, .hint, .legend, .day { display: none !important; }" });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "og.png" });
await browser.close();
console.log("wrote og.png");
