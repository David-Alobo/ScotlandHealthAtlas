// The scrolling atlas: one stage, many states, in three layers:
//   #stage-under (SVG): council areas, the map's land and the poisoning map;
//   #dots (canvas): 6,976 neighbourhood dots and about 2,300 death dots, animated smoothly;
//   #stage (SVG): charts, the council scatter and labels.
// Each scroll step sets a state; layouts come from stage.js, text from facts.js (all tested).

import { dumbbell, lineChart } from "./charts.js";
import { DotCanvas, typeColours, zoneColours } from "./dots.js";
import { facts } from "./facts.js";
import { areaFacts, areaHead, areaPanel, councilUnits, localNotes } from "./filter.js";
import { niceTicks } from "./scale.js";
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
// the area filter: a chosen council, and a pinned neighbourhood (index into geo.zones)
const filter = { council: null, zone: null };
let detail = null; // the seven domain ranks per zone, loaded after first paint

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

  // death dots: the three layouts, for whichever dots are shown (Scotland, or one council)
  const a = story.injury_ages;
  const layoutsFor = (units) => {
    const minSide = Math.min(A.w, A.h);
    const count = (t) => units.filter((u) => u.type === t).length;
    const crowd = crowdLayout(units, A.x + A.w / 2, A.y + A.h / 2, (0.44 * minSide) / Math.sqrt(Math.max(units.length, 1)));
    const split = splitLayout(
      units,
      { falls: A.x + A.w * 0.27, poisoning: A.x + A.w * 0.73 },
      A.y + A.h / 2,
      Math.min(A.w * 0.235, A.h * 0.42) / Math.sqrt(Math.max(count("falls"), count("poisoning"), 1)),
    );
    const perBand = (t, b) => units.filter((u) => u.type === t && u.band === b).length;
    const tallest = Math.max(1, ...a.bands.flatMap((b) => [perBand("falls", b), perBand("poisoning", b)]));
    // columns `cols` dots wide: pick the width that makes the dots biggest while the tallest
    // column fits the height and two columns fit each age band
    const fitGap = (c) => Math.min((A.h - 80) / Math.ceil(tallest / c), A.w / a.bands.length / (2 * c * 1.2));
    let cols = 1;
    for (let c = 2; c <= 12; c++) if (fitGap(c) > fitGap(cols)) cols = c;
    const gap = Math.min(fitGap(cols), 9);
    const age = ageLayout(units, a.bands, { x: A.x, y: A.y + 30, w: A.w, h: A.h - 80 }, cols, gap);
    const ageAxis = { base: A.y + 30 + A.h - 80, gap, cols, tallest };
    return { units, crowd, split, age, ageAxis, unitR: Math.max(1.3, gap * 0.42) };
  };
  const national = layoutsFor(deathUnits(a.bands, a.deaths.falls, a.deaths.poisoning));

  // the canvas, sharing the map transform with the council layer
  const dots = new DotCanvas(document.getElementById("dots"), f.W, f.H, geo.zones, national.units, setMap);
  dots.go({ map: base, positions: national.crowd, unitR: national.unitR }, true);

  // a council fills the visual area when chosen
  const councilIndex = new Map(geo.councils.map((c, i) => [c.council, i]));
  const zoomTo = (name) => {
    const [l, t, r, b] = geo.councils[councilIndex.get(name)].bbox;
    const sc = Math.min(k * 9, (0.86 * A.w) / Math.max(r - l, 1), (0.86 * A.h) / Math.max(b - t, 1));
    return { tx: A.x + A.w / 2 - ((l + r) / 2) * sc, ty: A.y + A.h / 2 - ((t + b) / 2) * sc, s: sc };
  };

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
    f, under, svg, base, zoom, zoomTo, councilIndex, councilPaths, dots, layoutsFor, national,
    shown: national, shownFor: null, councilDots, labels, ring, cs, index: gridIndex(geo.zones, 8),
    state: "intro",
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
  const panel = document.getElementById("area-panel");
  panel.classList.toggle("compact", !MAP_STATES.has(name)); // a pill over charts, full over maps
  panel.classList.remove("open");
  st.under.dataset.state = name;
  st.svg.dataset.state = name;
  st.labels.innerHTML = "";
  st.ring.classList.remove("on");
  const legend = document.getElementById("legend");
  legend.innerHTML = "";
  const A = st.f.area;

  // the canvas: neighbourhoods and death dots
  const spotlight = name === "deprived" || name === "glasgow" || name === "end";
  // the dots to show: Scotland's (one a year), or the chosen council's (one per death in 5 years)
  const wanted = filter.council ?? null;
  if (st.shownFor !== wanted) {
    st.shownFor = wanted;
    st.shown = wanted ? st.layoutsFor(councilUnits(story, wanted).units) : st.national;
    st.dots.setUnits(st.shown.units, st.shown.crowd);
  }
  const zoomed = filter.council && (name === "deprived" || name === "end");
  const target = {
    map: name === "glasgow" ? st.zoom : zoomed ? st.zoomTo(filter.council) : st.base,
    focus: filter.council ? st.councilIndex.get(filter.council) : -1,
    unitR: st.shown.unitR,
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
  const pos = { crowd: st.shown.crowd, split: st.shown.split, age: st.shown.age.positions }[name];
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
  if (name === "crowd") {
    const unit = filter.council ? `${filter.council}: 1 dot = 1 death in five years` : "1 dot = 1 death a year";
    label(st, A.x + A.w / 2, A.y + A.h - 4, unit, "centre muted");
  }
  if (["crowd", "split", "age"].includes(name) && st.shown.units.length === 0) {
    label(st, A.x + A.w / 2, A.y + A.h / 2, "Too few deaths to show reliably", "big centre");
  }
  if (name === "split") {
    label(st, A.x + A.w * 0.27, A.y + 34, "Falls", "big centre f");
    label(st, A.x + A.w * 0.73, A.y + 34, "Poisoning", "big centre p");
  }
  if (name === "age") {
    // axes: deaths a year (each row of dots is `cols` deaths) against age band
    const { base, gap, cols, tallest } = st.shown.ageAxis;
    const yOf = (n) => base - (n / cols) * gap;
    const left = A.x - 4;
    const ticks = niceTicks(0, tallest, 4); // none above the tallest column
    const top = yOf(ticks[ticks.length - 1]);
    el("line", { x1: left, x2: A.x + A.w, y1: base + gap, y2: base + gap, class: "axis" }, st.labels);
    el("line", { x1: left, x2: left, y1: top, y2: base + gap, class: "axis" }, st.labels);
    for (const n of ticks) {
      el("line", { x1: left - 4, x2: left, y1: yOf(n), y2: yOf(n), class: "axis" }, st.labels);
      label(st, left - 8, yOf(n) + 4, String(n), "tick end");
    }
    const ty = (top + base) / 2;
    const title = el("text", { x: left - 46, y: ty, class: "stage-label muted centre", transform: `rotate(-90 ${left - 46} ${ty})` }, st.labels);
    title.textContent = filter.council ? "Deaths in five years" : "Deaths a year";
    st.shown.age.bandX.forEach((x, i) => label(st, x, A.y + A.h - 24, story.injury_ages.bands[i], "centre tick"));
    label(st, A.x + A.w / 2, A.y + A.h - 2, "Age", "centre muted");
    label(st, A.x + 40, A.y + 12, "Falls", "f big");
    label(st, A.x + 120, A.y + 12, "Poisoning", "p big");
  }
  if (choropleth) {
    legend.innerHTML = rateLegend();
    const west = new Set(["Inverclyde"]); // labelled on its left, so it clears Glasgow
    const named = ["Glasgow City", "Inverclyde", "Dundee City", "Orkney Islands"];
    if (filter.council && !named.includes(filter.council)) named.push(filter.council);
    for (const n of named) {
      const [x, y] = JSON.parse(st.councilDots.find((d) => d.dataset.council === n).dataset.map);
      const left = west.has(n) && n !== filter.council;
      label(st, left ? x - 9 : x + 9, y + 4, n.replace(" City", "").replace(" Islands", ""), `small halo${left ? " end" : ""}`);
    }
  }
  if (onScatter) {
    const named = ["Glasgow City", "Inverclyde", "Dundee City", "Orkney Islands", "East Renfrewshire"];
    if (filter.council && !named.includes(filter.council)) named.push(filter.council);
    for (const n of named) {
      const [x, y] = JSON.parse(st.councilDots.find((d) => d.dataset.council === n).dataset.scatter);
      label(st, x + 10, y + 4, n.replace(" City", "").replace(" Islands", ""), "small");
    }
  }
  highlightCouncil(st, filter.council ?? "");
}

function rampLegend(q1Only) {
  const names = ["Most deprived fifth", "", "", "", "Least deprived"];
  return (
    `<span class="legend-title">Neighbourhoods · hover a dot · click to pin it and follow it</span>` +
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

/**
 * The area filter: pinning a neighbourhood on the map (click a dot; click it again, or the
 * panel's ×, to unpin) or choosing in "Find your council", and the "your area" panel.
 * Returns { setFilter(council, zone), render }.
 */
function wireFilter(getStage, story, geo, current) {
  const find = document.getElementById("council-select");
  const sentence = document.getElementById("council-sentence");
  const panel = document.getElementById("area-panel");
  const body = document.getElementById("area-panel-body");
  const names = [...story.councils.councils].map((c) => c.council).sort((a, b) => a.localeCompare(b));
  if (find.options.length === 1) for (const n of names) find.add(new Option(n, n));
  // each card gets a line for the chosen area
  for (const card of document.querySelectorAll(".step .card")) {
    const note = document.createElement("p");
    note.className = "local";
    note.hidden = true;
    card.appendChild(note);
  }

  const base = facts(story);
  const render = () => {
    // card figures: the pinned area's where the data has them, highlighted; Scotland's otherwise
    const local = areaFacts(story, filter);
    for (const node of document.querySelectorAll("[data-fact]")) {
      const key = node.dataset.fact;
      node.textContent = local[key] ?? base[key] ?? "";
      // highlight changed figures, not the words around them
      const words = key === "inArea" || key === "deathsUnit" || key === "dayHeading" || key.endsWith("Label");
      node.classList.toggle("is-local", key in local && !words);
    }
    for (const node of document.querySelectorAll("[data-national]")) node.hidden = Boolean(filter.council);
    const notes = localNotes(story, geo, filter);
    for (const step of document.querySelectorAll(".step")) {
      const note = step.querySelector(".local");
      if (!note) continue;
      const text = notes[step.dataset.state] ?? "";
      note.textContent = text;
      note.hidden = !text;
    }
    find.value = filter.council ?? "";
    sentence.textContent = filter.council
      ? councilSentence(filter.council, story.councils.councils, story.councils.scotland)
      : "";
    document.getElementById("area-panel-head").innerHTML = areaHead(story, geo, filter);
    body.innerHTML = areaPanel(story, geo, filter, detail);
    sections();
    document.getElementById("area-panel-title").textContent =
      filter.zone !== null ? `Pinned: ${geo.zone_names[filter.zone]} · ${filter.council}` : filter.council ?? "";
    panel.hidden = !filter.council;
  };

  // the panel's sections: one fills the card at a time; scrolling snaps between them and the
  // tabs show (and choose) which one is in view
  const tabs = document.getElementById("area-panel-tabs");
  let watcher = null;
  let parts = [];
  const go = (k) => {
    const part = parts[Math.max(0, Math.min(parts.length - 1, k))];
    if (part) body.scrollTo({ top: part.offsetTop - body.offsetTop, behavior: "smooth" });
  };
  // one wheel movement inside the card = one section (a wheel step is shorter than a section)
  let wheelLock = 0;
  body.addEventListener(
    "wheel",
    (e) => {
      if (parts.length < 2) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLock || Math.abs(e.deltaY) < 4) return;
      wheelLock = now + 550;
      const at = parts.findIndex((part) => part.offsetTop - body.offsetTop >= body.scrollTop - 4);
      go((at < 0 ? parts.length - 1 : at) + (e.deltaY > 0 ? 1 : -1));
    },
    { passive: false },
  );
  const sections = () => {
    parts = [...body.querySelectorAll("section[data-tab]")];
    tabs.innerHTML = "";
    watcher?.disconnect();
    const buttons = parts.map((part, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = part.dataset.tab;
      b.classList.toggle("on", k === 0);
      b.onclick = () => go(k);
      tabs.appendChild(b);
      return b;
    });
    tabs.hidden = parts.length < 2;
    body.scrollTop = 0;
    watcher = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) buttons.forEach((b, k) => b.classList.toggle("on", parts[k] === e.target));
        }
      },
      { root: body, threshold: 0.6 },
    );
    for (const part of parts) watcher.observe(part);
  };

  const setFilter = (council, zone = null) => {
    filter.council = council || null;
    filter.zone = filter.council ? zone : null;
    const st = getStage();
    st.dots.setPin(filter.zone ?? -1);
    render();
    setState(st, current() || "intro", story);
  };
  find.onchange = () => setFilter(find.value);
  document.getElementById("area-panel-close").onclick = () => setFilter(null); // unpin
  document.getElementById("area-panel-title").onclick = () => panel.classList.toggle("open");
  return { setFilter, render };
}

/**
 * Tooltips. Neighbourhood dots (on the canvas, found by nearest point) get a card with a locator
 * map and the seven domains; any SVG mark with data-tip gets its text. Pointers hover; a tap on a
 * touch screen does the same, and a tap elsewhere closes the card.
 */
function wireTooltips(getStage, geo, pin) {
  const tip = document.getElementById("tooltip");

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
  const panel = document.getElementById("area-panel");
  const showCard = (i, x, y) => {
    panel.classList.add("hovering"); // the pinned panel steps aside while you hover
    tip.className = "zcard";
    tip.innerHTML = zoneCard(geo.zones[i], geo.zone_names[i], geo.councils, detail, i, geo.zones.length);
    tip.setAttribute("aria-label", zoneTip(geo.zones[i], geo.zone_names[i], geo.councils, geo.zones.length));
    tip.hidden = false;
    position(x, y);
  };
  const hide = () => {
    panel.classList.remove("hovering");
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
  window.addEventListener("scroll", hide, { passive: true });
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return; // touch uses taps (below)
    if (!handle(e)) hide();
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest?.(".step, select, button, a, .area-panel")) return;
    const st = getStage();
    if (MAP_STATES.has(st.state) && e.target.closest?.(".stage")) {
      const i = zoneAt(st, e.clientX, e.clientY);
      if (i >= 0) {
        if (i === filter.zone) pin(null); // clicking the pinned dot again unpins it
        else pin(geo.councils[geo.zones[i][5]].council, i); // a click pins it: the panel shows it
        hide();
        return;
      }
    }
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
  for (const [key, html] of Object.entries(tables(story))) document.getElementById(`table-${key}`).innerHTML = html;

  let st = build(story, geo);
  const getStage = () => st;
  let current = () => "intro";
  const { setFilter, render } = wireFilter(getStage, story, geo, () => current());
  render(); // fills every figure in the cards
  wireTooltips(getStage, geo, setFilter);
  fetch("data/domains.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      detail = d;
      render(); // the panel can now name the neighbourhood's most deprived domains
    })
    .catch(() => {});
  for (const b of document.querySelectorAll("[data-go]")) {
    b.addEventListener("click", () => {
      if (b.dataset.go === "top") window.scrollTo({ top: 0, behavior: "smooth" });
      else document.querySelector(`.step[data-state="${b.dataset.go}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  current = wireSteps(getStage, story);
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
      st.dots.setPin(filter.zone ?? -1);
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
