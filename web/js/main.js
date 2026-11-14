// The scrolling atlas: one stage, many states, in three layers:
//   #stage-under (SVG): council areas, the map's land and the poisoning map;
//   #dots (canvas): 6,976 neighbourhood dots and about 2,300 death dots, animated smoothly;
//   #stage (SVG): charts, the council scatter and labels.
// Each scroll step sets a state; layouts come from stage.js, text from facts.js (all tested).

import { dumbbell, lineChart } from "./charts.js";
import { DotCanvas, typeColours, zoneColours } from "./dots.js";
import { facts } from "./facts.js";
import { aeChart, medicineChart, ratioChart, tables } from "./scenes.js";
import {
  ageLayout,
  binColour,
  councilSentence,
  crowdLayout,
  deathUnits,
  gridIndex,
  nearest,
  scatterLayout,
  splitLayout,
  zoneCard,
  zoneTip,
} from "./stage.js";

const NS = "http://www.w3.org/2000/svg";
// Monstrous Data brand, validated for colour-blind separation on Night (#07080C)
const C = {
  ramp: ["#e4dcff", "#b9a3fc", "#8f6ff0", "#6a4fd0", "#4a3a9a"], // quintile 1 (most deprived) brightest
  q1: "#cbbcff",
  dim: "#2a2e40",
  violet: "#b9a3fc",
  cyan: "#22d3ee",
  falls: "#22d3ee",
  poisoning: "#9b6cf7",
  crowd: "#b8bccb",
  grey: "#3a3f52",
};
const RATE_STEPS = [12, 18, 24, 30]; // poisoning deaths per 100,000 a year, map bins
const RATE_COLOURS = ["#2b2550", "#4a3a9a", "#6a4fd0", "#9b7cf4", "#d8ccff"];
const MAP_STATES = new Set(["intro", "deprived", "glasgow", "end"]);

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const place = (node, [x, y]) => {
  node.style.transform = `translate(${x}px, ${y}px)`;
};

/** The stage size and the area the visuals use, for wide screens and for phones. */
function frame() {
  const wide = window.innerWidth / window.innerHeight > 1.05 && window.innerWidth > 760;
  return wide
    ? { wide, W: 1000, H: 640, area: { x: 400, y: 72, w: 570, h: 540 } } // band above for the legend
    : { wide, W: 600, H: 900, area: { x: 24, y: 24, w: 552, h: 560 } };
}

function build(story, geo) {
  const f = frame();
  const A = f.area;
  const under = document.getElementById("stage-under");
  const svg = document.getElementById("stage");
  for (const s of [under, svg]) {
    s.setAttribute("viewBox", `0 0 ${f.W} ${f.H}`);
    s.innerHTML = "";
  }

  // map transforms: Scotland in the area, and zoomed on Glasgow
  const k = Math.min(A.w / geo.width, A.h / geo.height);
  const base = { tx: A.x + (A.w - geo.width * k) / 2, ty: A.y + (A.h - geo.height * k) / 2, s: k };
  const glasgow = geo.councils.find((c) => c.council === "Glasgow City");
  const z = 5.2;
  const zoom = { tx: A.x + A.w / 2 - glasgow.cx * k * z, ty: A.y + A.h / 2 - glasgow.cy * k * z, s: k * z };

  // council areas, under the dots
  const map = el("g", { class: "layer map" }, under);
  const councilPaths = new Map();
  for (const c of geo.councils) {
    councilPaths.set(c.council, el("path", { d: c.path, class: "council" }, map));
  }
  const setMap = (t) => map.setAttribute("transform", `translate(${t.tx} ${t.ty}) scale(${t.s})`);
  setMap(base);

  // charts, built by the tested chart functions and nested in the top layer
  const charts = el("g", { class: "layer charts" }, svg);
  const nest = (markup, name) => {
    const g = el("g", { class: `chart-layer ${name}` }, charts);
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(markup);
    const h = (A.w * Number(vb[2])) / Number(vb[1]);
    g.innerHTML = markup.replace("<svg ", `<svg x="${A.x}" y="${A.y + (A.h - h) / 2}" width="${A.w}" height="${h}" `);
  };
  const ae = aeChart(story, [C.violet, C.grey, C.grey, C.grey, C.cyan]);
  for (const i of [1, 2, 3]) ae.series[i].label = "";
  const last = story.ae.years.length - 1;
  const q1 = ae.series[0].values[last];
  const q5 = ae.series[4].values[last];
  ae.note = { at: last, from: q1, to: q5, text: `${(q1 / q5).toFixed(1)}×` };
  // charts fill the visual area: their own width is 640 units, so height = 640 * area h / w
  const fill = Math.round((640 * A.h) / A.w);
  nest(lineChart({ ...ae, height: fill }), "ae");
  nest(lineChart({ ...ratioChart(story, { recorded: C.violet, alternative: C.cyan }), height: fill }), "ratio");
  const med = medicineChart(story);
  med.aColour = C.violet;
  med.bColour = C.cyan;
  nest(dumbbell({ ...med, height: fill, values: true }), "medicines");

  // death dots: the three layouts
  const a = story.injury_ages;
  const units = deathUnits(a.bands, a.deaths.falls, a.deaths.poisoning);
  const minSide = Math.min(A.w, A.h);
  const crowd = crowdLayout(units, A.x + A.w / 2, A.y + A.h / 2, (0.44 * minSide) / Math.sqrt(units.length));
  const nMax = Math.max(...["falls", "poisoning"].map((t) => units.filter((u) => u.type === t).length));
  const split = splitLayout(
    units,
    { falls: A.x + A.w * 0.27, poisoning: A.x + A.w * 0.73 },
    A.y + A.h / 2,
    Math.min(A.w * 0.235, A.h * 0.42) / Math.sqrt(nMax),
  );
  const cols = 8;
  const tallest = Math.max(...a.deaths.falls, ...a.deaths.poisoning);
  const gap = Math.min((A.h - 80) / Math.ceil(tallest / cols), A.w / a.bands.length / (2 * cols * 1.2));
  const age = ageLayout(units, a.bands, { x: A.x, y: A.y + 30, w: A.w, h: A.h - 80 }, cols, gap);
  const ageAxis = { base: A.y + 30 + A.h - 80, gap, cols, tallest }; // for the scale in setState

  // the canvas, sharing the map transform with the council layer
  const dots = new DotCanvas(document.getElementById("dots"), f.W, f.H, geo.zones, units, setMap);
  dots.go({ map: base, positions: crowd, unitR: Math.max(1.3, gap * 0.42) }, true);

  // councils as dots: from their place on the map to the scatter
  const cs = story.councils.councils;
  const box = { x: A.x + 56, y: A.y + 20, w: A.w - 80, h: A.h - 90 };
  const scat = scatterLayout(cs, box, 0.5, 45);
  const onMap = (name) => {
    const g = geo.councils.find((c) => c.council === name);
    return [base.tx + g.cx * k, base.ty + g.cy * k];
  };
  const scatter = el("g", { class: "layer scatter" }, svg);
  el("g", { class: "axes" }, scatter).innerHTML = scatterAxes(box);
  const councilDots = cs.map((c, i) => {
    const d = el("circle", { r: 6, class: "cdot" }, scatter);
    d.style.fill = binColour(c.rate, RATE_STEPS, RATE_COLOURS);
    d.dataset.tip = councilSentence(c.council, cs, story.councils.scotland);
    d.dataset.council = c.council;
    d.dataset.scatter = JSON.stringify(scat[i]);
    d.dataset.map = JSON.stringify(onMap(c.council));
    place(d, onMap(c.council));
    return d;
  });

  const labels = el("g", { class: "layer labels" }, svg);
  const ring = el("circle", { r: 5, class: "hover-ring" }, svg);
  return {
    f, under, svg, base, zoom, councilPaths, dots, units, crowd, split, age, ageAxis, councilDots, labels,
    ring, cs, index: gridIndex(geo.zones, 8), state: "intro",
  };
}

/** Axis lines and labels for the council scatter (share in quintile 1 by rate). */
function scatterAxes(box) {
  let s = `<line x1="${box.x}" x2="${box.x + box.w}" y1="${box.y + box.h}" y2="${box.y + box.h}" class="axis"/>`;
  s += `<line x1="${box.x}" x2="${box.x}" y1="${box.y}" y2="${box.y + box.h}" class="axis"/>`;
  for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5]) {
    const x = box.x + (t / 0.5) * box.w;
    s += `<text x="${x}" y="${box.y + box.h + 18}" class="tick-label" text-anchor="middle">${t * 100}%</text>`;
  }
  for (const t of [0, 10, 20, 30, 40]) {
    const y = box.y + box.h - (t / 45) * box.h;
    s += `<text x="${box.x - 8}" y="${y}" class="tick-label" text-anchor="end" dominant-baseline="middle">${t}</text>`;
  }
  s += `<text x="${box.x + box.w / 2}" y="${box.y + box.h + 42}" class="axis-title" text-anchor="middle">People in the most deprived fifth</text>`;
  s += `<text x="${box.x - 40}" y="${box.y + box.h / 2}" class="axis-title" text-anchor="middle" transform="rotate(-90 ${box.x - 40} ${box.y + box.h / 2})">Poisoning deaths per 100,000</text>`;
  return s;
}

function label(st, x, y, text, cls = "") {
  const t = el("text", { x, y, class: `stage-label ${cls}` }, st.labels);
  t.textContent = text;
}

/** Put the stage into a named state. */
function setState(st, name, story) {
  st.state = name;
  st.under.dataset.state = name;
  st.svg.dataset.state = name;
  st.labels.innerHTML = "";
  st.ring.classList.remove("on");
  const legend = document.getElementById("legend");
  legend.innerHTML = "";
  const A = st.f.area;

  // the canvas: neighbourhoods and death dots
  const spotlight = name === "deprived" || name === "glasgow" || name === "end";
  const target = {
    map: name === "glasgow" ? st.zoom : st.base,
    zoneAlpha: MAP_STATES.has(name) ? 1 : 0,
    zoneColours: spotlight
      ? zoneColours([C.q1, C.dim, C.dim, C.dim, C.dim], [1, 0.9, 0.9, 0.9, 0.9])
      : zoneColours(C.ramp),
    unitAlpha: ["crowd", "split", "age"].includes(name) ? 1 : 0,
    unitColours:
      name === "crowd"
        ? typeColours({ falls: C.crowd, poisoning: C.crowd })
        : typeColours({ falls: C.falls, poisoning: C.poisoning }),
  };
  const pos = { crowd: st.crowd, split: st.split, age: st.age.positions }[name];
  if (pos) target.positions = pos;
  st.dots.go(target);

  // council shapes: the poisoning map, else plain land; tooltips only on the poisoning map
  const choropleth = name === "poison-map";
  for (const c of st.cs) {
    const p = st.councilPaths.get(c.council);
    p.style.fill = choropleth ? binColour(c.rate, RATE_STEPS, RATE_COLOURS) : "";
    if (choropleth) p.dataset.tip = councilSentence(c.council, st.cs, story.councils.scotland);
    else delete p.dataset.tip;
  }

  // council dots: on the map until the scatter
  const onScatter = name === "scatter" || name === "find";
  for (const d of st.councilDots) place(d, JSON.parse(onScatter ? d.dataset.scatter : d.dataset.map));

  // labels and legends
  if (MAP_STATES.has(name)) legend.innerHTML = rampLegend(spotlight);
  if (name === "glasgow") label(st, A.x + A.w / 2, A.y + 28, "Glasgow and the Clyde", "big centre");
  if (name === "crowd") label(st, A.x + A.w / 2, A.y + A.h - 4, "1 dot = 1 death a year", "centre muted");
  if (name === "split") {
    label(st, A.x + A.w * 0.27, A.y + 34, "Falls", "big centre f");
    label(st, A.x + A.w * 0.73, A.y + 34, "Poisoning", "big centre p");
  }
  if (name === "age") {
    // axes: deaths a year (each row of dots is `cols` deaths) against age band
    const { base, gap, cols, tallest } = st.ageAxis;
    const yOf = (n) => base - (n / cols) * gap;
    const left = A.x - 4;
    const top = yOf(Math.ceil(tallest / 200) * 200);
    el("line", { x1: left, x2: A.x + A.w, y1: base + gap, y2: base + gap, class: "axis" }, st.labels);
    el("line", { x1: left, x2: left, y1: top, y2: base + gap, class: "axis" }, st.labels);
    for (let n = 0; n <= tallest + 199; n += 200) {
      el("line", { x1: left - 4, x2: left, y1: yOf(n), y2: yOf(n), class: "axis" }, st.labels);
      label(st, left - 8, yOf(n) + 4, String(n), "tick end");
    }
    const ty = (top + base) / 2;
    const title = el("text", { x: left - 46, y: ty, class: "stage-label muted centre", transform: `rotate(-90 ${left - 46} ${ty})` }, st.labels);
    title.textContent = "Deaths a year";
    st.age.bandX.forEach((x, i) => label(st, x, A.y + A.h - 24, story.injury_ages.bands[i], "centre tick"));
    label(st, A.x + A.w / 2, A.y + A.h - 2, "Age", "centre muted");
    label(st, A.x + 40, A.y + 12, "Falls", "f big");
    label(st, A.x + 120, A.y + 12, "Poisoning", "p big");
  }
  if (choropleth) {
    legend.innerHTML = rateLegend();
    const west = new Set(["Inverclyde"]); // labelled on its left, so it clears Glasgow
    for (const n of ["Glasgow City", "Inverclyde", "Dundee City", "Orkney Islands"]) {
      const [x, y] = JSON.parse(st.councilDots.find((d) => d.dataset.council === n).dataset.map);
      const left = west.has(n);
      label(st, left ? x - 9 : x + 9, y + 4, n.replace(" City", "").replace(" Islands", ""), `small halo${left ? " end" : ""}`);
    }
  }
  if (onScatter) {
    for (const n of ["Glasgow City", "Inverclyde", "Dundee City", "Orkney Islands", "East Renfrewshire"]) {
      const [x, y] = JSON.parse(st.councilDots.find((d) => d.dataset.council === n).dataset.scatter);
      label(st, x + 10, y + 4, n.replace(" City", "").replace(" Islands", ""), "small");
    }
  }
  highlightCouncil(st, name === "find" ? document.getElementById("council-select").value : "");
}

function rampLegend(q1Only) {
  const names = ["Most deprived fifth", "", "", "", "Least deprived"];
  return (
    `<span class="legend-title">Neighbourhoods · hover a dot</span>` +
    C.ramp
      .map((c, i) => (q1Only && i > 0 ? "" : `<span><i style="background:${c}"></i>${names[i]}</span>`))
      .join("")
  );
}

function rateLegend() {
  const t = RATE_STEPS;
  const names = [`under ${t[0]}`, `${t[0]}-${t[1]}`, `${t[1]}-${t[2]}`, `${t[2]}-${t[3]}`, `${t[3]}+`];
  return (
    `<span class="legend-title">Poisoning deaths per 100,000 a year · hover a council</span>` +
    RATE_COLOURS.map((c, i) => `<span><i style="background:${c}"></i>${names[i]}</span>`).join("")
  );
}

function highlightCouncil(st, name) {
  for (const d of st.councilDots) d.classList.toggle("chosen", name !== "" && d.dataset.council === name);
  for (const [n, p] of st.councilPaths) p.classList.toggle("chosen", n === name);
}

function wireFind(getStage, story) {
  const sel = document.getElementById("council-select");
  const out = document.getElementById("council-sentence");
  if (sel.options.length === 1) {
    for (const c of [...story.councils.councils].sort((a, b) => a.council.localeCompare(b.council))) {
      sel.add(new Option(c.council, c.council));
    }
  }
  sel.onchange = () => {
    out.textContent = councilSentence(sel.value, story.councils.councils, story.councils.scotland);
    highlightCouncil(getStage(), sel.value);
  };
}

/**
 * Tooltips. Neighbourhood dots (on the canvas, found by nearest point) get a card with a locator
 * map and the seven domains; any SVG mark with data-tip gets its text. Pointers hover; a tap on a
 * touch screen does the same, and a tap elsewhere closes the card.
 */
function wireTooltips(getStage, geo) {
  const tip = document.getElementById("tooltip");
  let detail = null; // the seven domain ranks per zone, loaded after first paint
  fetch("data/domains.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      detail = d;
    })
    .catch(() => {});

  const position = (x, y) => {
    const pad = 12;
    const left = x + 16 + tip.offsetWidth > window.innerWidth - pad ? x - 16 - tip.offsetWidth : x + 16;
    tip.style.left = `${Math.max(pad, left)}px`;
    tip.style.top = `${Math.max(pad, Math.min(y + 16, window.innerHeight - tip.offsetHeight - pad))}px`;
  };
  const showText = (text, x, y) => {
    tip.className = "";
    tip.textContent = text;
    tip.hidden = false;
    position(x, y);
  };
  const showCard = (i, x, y) => {
    tip.className = "zcard";
    tip.innerHTML = zoneCard(geo.zones[i], geo.zone_names[i], geo.councils, detail, i, geo.zones.length);
    tip.setAttribute("aria-label", zoneTip(geo.zones[i], geo.zone_names[i], geo.councils, geo.zones.length));
    tip.hidden = false;
    position(x, y);
  };
  const hide = () => {
    getStage().ring.classList.remove("on");
    tip.hidden = true;
  };

  /** The neighbourhood under a screen point, or -1, and mark it with the ring. */
  const zoneAt = (st, cx, cy) => {
    const pt = st.svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const p = pt.matrixTransform(st.svg.getScreenCTM().inverse()); // stage units
    const m = st.dots.current(performance.now()).map;
    const i = nearest(st.index, (p.x - m.tx) / m.s, (p.y - m.ty) / m.s, 7 / m.s + 1.5);
    if (i >= 0) {
      st.ring.setAttribute("cx", m.tx + geo.zones[i][0] * m.s);
      st.ring.setAttribute("cy", m.ty + geo.zones[i][1] * m.s);
      st.ring.classList.add("on");
    }
    return i;
  };

  const handle = (e) => {
    const st = getStage();
    const marked = e.target.closest?.("[data-tip]");
    if (marked) {
      st.ring.classList.remove("on");
      showText(marked.dataset.tip, e.clientX, e.clientY);
      return true;
    }
    if (MAP_STATES.has(st.state) && e.target.closest?.(".stage")) {
      const i = zoneAt(st, e.clientX, e.clientY);
      if (i >= 0) {
        showCard(i, e.clientX, e.clientY);
        return true;
      }
    }
    return false;
  };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return; // touch uses taps (below)
    if (!handle(e)) hide();
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest?.(".step, select, button, a")) return;
    if (!handle(e)) hide();
  });
}

function wireSteps(getStage, story) {
  const steps = [...document.querySelectorAll(".step")];
  let current = "";
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const s of steps) s.classList.toggle("active", s === e.target);
        const name = e.target.dataset.state;
        if (name !== current) {
          current = name;
          setState(getStage(), name, story);
        }
      }
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );
  for (const s of steps) io.observe(s);
  return () => current;
}

async function main() {
  const [story, geo] = await Promise.all(
    ["data/story.json", "data/geo.json"].map((u) =>
      fetch(u).then((r) => {
        if (!r.ok) throw new Error(`${u}: ${r.status}`);
        return r.json();
      }),
    ),
  );
  const f = facts(story);
  for (const node of document.querySelectorAll("[data-fact]")) node.textContent = f[node.dataset.fact] ?? "";
  for (const [key, html] of Object.entries(tables(story))) document.getElementById(`table-${key}`).innerHTML = html;

  let st = build(story, geo);
  const getStage = () => st;
  wireFind(getStage, story);
  wireTooltips(getStage, geo);
  for (const b of document.querySelectorAll("[data-go]")) {
    b.addEventListener("click", () => {
      if (b.dataset.go === "top") window.scrollTo({ top: 0, behavior: "smooth" });
      else document.querySelector(`.step[data-state="${b.dataset.go}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  const current = wireSteps(getStage, story);
  // ?state=<name> opens a scene directly (for sharing a scene)
  const wanted = new URLSearchParams(location.search).get("state");
  const step = wanted && document.querySelector(`.step[data-state="${CSS.escape(wanted)}"]`);
  if (step) step.scrollIntoView({ block: "center" });
  setState(st, step ? wanted : "intro", story);

  let wasWide = st.f.wide;
  window.addEventListener("resize", () => {
    if (frame().wide !== wasWide) {
      st = build(story, geo); // a new layout on orientation change
      wasWide = st.f.wide;
      setState(st, current() || "intro", story);
    } else {
      st.dots.resize();
    }
  });
  document.body.classList.add("ready");
}

main().catch((err) => {
  console.error(err);
  document.getElementById("load-error").hidden = false;
});
