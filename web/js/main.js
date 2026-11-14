// The page: load the data, fill the text, draw the charts, wire tooltips, tables and scroll steps.
// All logic lives in the imported modules; this file only touches the DOM.

import { dotInterval, dumbbell, groupedBars, lineChart } from "./charts.js";
import { facts } from "./facts.js";
import {
  SHARE_LEGEND,
  aeChart,
  ageChart,
  councilChart,
  medicineChart,
  tables,
} from "./scenes.js";

async function load() {
  const res = await fetch("data/story.json");
  if (!res.ok) throw new Error(`story.json: ${res.status}`);
  return res.json();
}

function fillFacts(story) {
  const f = facts(story);
  for (const el of document.querySelectorAll("[data-fact]")) {
    const v = f[el.dataset.fact];
    if (v === undefined) console.warn(`unknown fact: ${el.dataset.fact}`);
    else el.textContent = v;
  }
}

function drawCharts(story) {
  const put = (id, svg) => {
    document.getElementById(id).innerHTML = svg;
  };
  put("chart-ae", lineChart(aeChart(story)));
  put("chart-ages", groupedBars(ageChart(story, "deaths")));
  put("chart-councils", dotInterval(councilChart(story)));
  put("chart-medicines", dumbbell(medicineChart(story)));
  document.getElementById("legend-councils").innerHTML =
    "<span>People in the most deprived fifth:</span>" +
    SHARE_LEGEND.map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");

  const t = tables(story);
  for (const [key, html] of Object.entries(t)) {
    document.getElementById(`table-${key}`).innerHTML = html;
  }
}

function wireTables() {
  for (const btn of document.querySelectorAll("[data-table]")) {
    btn.addEventListener("click", () => {
      const box = document.getElementById(btn.dataset.table);
      const open = box.hidden;
      box.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Hide the numbers" : "Show the numbers";
    });
  }
}

function wireTooltips() {
  const tip = document.getElementById("tooltip");
  const show = (el, x, y) => {
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const pad = 12;
    const w = tip.offsetWidth;
    const left = Math.min(x + pad, window.innerWidth - w - pad);
    tip.style.left = `${Math.max(pad, left)}px`;
    tip.style.top = `${y + pad}px`;
  };
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (el) show(el, e.clientX, e.clientY);
    else tip.hidden = true;
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    show(el, r.right, r.top);
  });
  document.addEventListener("focusout", () => {
    tip.hidden = true;
  });
}

// Scene 3 highlights falls, then poisoning, as its text steps scroll past.
function wireSteps() {
  const chart = document.getElementById("chart-ages");
  const steps = document.querySelectorAll("[data-step]");
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const s of steps) s.classList.toggle("active", s === e.target);
        chart.dataset.highlight = e.target.dataset.step;
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  for (const s of steps) io.observe(s);
}

load()
  .then((story) => {
    fillFacts(story);
    drawCharts(story);
    wireTables();
    wireTooltips();
    wireSteps();
    document.body.classList.add("ready");
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("load-error").hidden = false;
  });
