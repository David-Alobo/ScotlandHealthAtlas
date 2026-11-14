// A drop-down list in the atlas's own style, in place of the browser's list for a <select>, whose
// look cannot be styled. The <select> stays in the page, hidden, as the source of truth: choosing
// sets its value and fires its "change" event, so code that listens to it does not change; after
// setting its value from code, call sync(). Keyboard: arrows, Home and End move, Enter or Space
// chooses, Escape closes, and typing jumps to the first option that starts with the letters.

/**
 * The option to move to from `index` after a key press.
 * @param {number} index current option (-1 for none)
 * @param {string} key the key's name
 * @param {number} count number of options
 * @returns {number} the new index, kept in range
 */
export function moveIndex(index, key, count) {
  if (count === 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return Math.min(count - 1, index + 1);
  if (key === "ArrowUp") return Math.max(0, index - 1);
  if (key === "PageDown") return Math.min(count - 1, index + 8);
  if (key === "PageUp") return Math.max(0, index - 8);
  return index;
}

/**
 * The first option, from `from` on and wrapping round, whose label starts with `typed`.
 * @param {string[]} labels the options' labels
 * @param {string} typed the letters typed so far
 * @param {number} from where to start looking
 * @returns {number} its index, or -1
 */
export function findTyped(labels, typed, from = 0) {
  const t = typed.toLowerCase();
  if (!t) return -1;
  for (let k = 0; k < labels.length; k++) {
    const i = (from + k) % labels.length;
    if (labels[i].toLowerCase().startsWith(t)) return i;
  }
  return -1;
}

/**
 * Replace a <select>'s list with the atlas's own.
 * @param {HTMLSelectElement} select the select (hidden by this function)
 * @param {string} labelId the id of the element that names it
 * @returns {{sync: () => void, close: () => void}}
 */
export function picker(select, labelId) {
  const wrap = document.createElement("div");
  wrap.className = "picker";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "picker-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-labelledby", `${labelId} ${select.id}-picked`);
  const picked = document.createElement("span");
  picked.id = `${select.id}-picked`;
  button.append(picked);
  const list = document.createElement("ul");
  list.className = "picker-list";
  list.id = `${select.id}-list`;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-labelledby", labelId);
  list.tabIndex = -1;
  list.hidden = true;
  button.setAttribute("aria-controls", list.id);
  wrap.append(button, list);
  select.hidden = true;
  select.tabIndex = -1;
  select.after(wrap);

  let active = -1;
  let typed = "";
  let typedAt = 0;
  const labels = () => [...select.options].map((o) => o.text);
  const items = () => [...list.children];

  const build = () => {
    list.innerHTML = "";
    for (const [k, o] of [...select.options].entries()) {
      const li = document.createElement("li");
      li.id = `${select.id}-option-${k}`;
      li.setAttribute("role", "option");
      li.textContent = o.text;
      li.onclick = () => choose(k);
      li.onpointermove = () => highlight(k, false);
      list.append(li);
    }
  };
  const highlight = (k, scroll = true) => {
    active = k;
    for (const [i, li] of items().entries()) li.classList.toggle("active", i === k);
    const li = items()[k];
    if (li) {
      list.setAttribute("aria-activedescendant", li.id);
      if (scroll) li.scrollIntoView({ block: "nearest" });
    }
  };
  const sync = () => {
    if (list.children.length !== select.options.length) build();
    const k = select.selectedIndex;
    picked.textContent = select.options[k]?.text ?? "";
    for (const [i, li] of items().entries()) li.setAttribute("aria-selected", String(i === k));
  };
  const open = () => {
    sync();
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    highlight(Math.max(0, select.selectedIndex));
    list.focus();
  };
  const close = (refocus = false) => {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (refocus) button.focus();
  };
  const choose = (k) => {
    close(true);
    if (k !== select.selectedIndex) {
      select.selectedIndex = k;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sync();
  };

  button.onclick = () => (list.hidden ? open() : close());
  button.onkeydown = (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      open();
    }
  };
  list.onkeydown = (e) => {
    const count = select.options.length;
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close(e.key === "Escape");
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (active >= 0) choose(active);
    } else if (moveIndex(active, e.key, count) !== active) {
      e.preventDefault();
      highlight(moveIndex(active, e.key, count));
    } else if (e.key.length === 1) {
      const now = performance.now();
      typed = now - typedAt < 700 ? typed + e.key : e.key;
      typedAt = now;
      const k = findTyped(labels(), typed, typed.length === 1 ? active + 1 : active);
      if (k >= 0) highlight(k);
    }
  };
  document.addEventListener("pointerdown", (e) => {
    if (!wrap.contains(e.target)) close();
  });
  window.addEventListener("scroll", () => close(), { passive: true });

  build();
  sync();
  return { sync, close };
}
