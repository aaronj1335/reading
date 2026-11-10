"use strict";

// Search / filter / sort for the want-to-read page. Unlike the index, the
// cards here are server-rendered (so the page works without JavaScript); each
// carries data-* attributes, and this script only hides and reorders them.

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const categoryEl = document.getElementById("category");
const tagEl = document.getElementById("tag");
const excludeTagEl = document.getElementById("exclude-tag");
const sortEl = document.getElementById("sort");

const DEFAULT_SORT = "added";

const CARDS = Array.from(listEl.children).map((el) => ({
  el,
  order: Number(el.dataset.order),
  title: el.dataset.title,
  author: el.dataset.author,
  category: el.dataset.category,
  tags: JSON.parse(el.dataset.tags || "[]"),
  pages: el.dataset.pages ? Number(el.dataset.pages) : null,
  search: el.dataset.search,
}));

// Books without a page count sort last in either direction.
function byPages(dir) {
  return (a, b) => {
    if (a.pages === b.pages) return a.order - b.order;
    if (a.pages === null) return 1;
    if (b.pages === null) return -1;
    return dir * (a.pages - b.pages);
  };
}

const SORTERS = {
  added: (a, b) => a.order - b.order,
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) => a.author.localeCompare(b.author) || a.title.localeCompare(b.title),
  shortest: byPages(1),
  longest: byPages(-1),
};

function updateUrl() {
  const params = new URLSearchParams();
  const q = searchEl.value.trim();
  if (q) params.set("q", q);
  if (categoryEl.value) params.set("category", categoryEl.value);
  if (tagEl.value) params.set("tag", tagEl.value);
  if (excludeTagEl.value) params.set("exclude", excludeTagEl.value);
  if (sortEl.value && sortEl.value !== DEFAULT_SORT) params.set("sort", sortEl.value);
  const qs = params.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const cat = categoryEl.value;
  const tag = tagEl.value;
  const excludeTag = excludeTagEl.value;

  updateUrl();

  const sorted = CARDS.slice().sort(SORTERS[sortEl.value] || SORTERS[DEFAULT_SORT]);
  let shown = 0;
  for (const b of sorted) {
    const match =
      (!cat || b.category === cat) &&
      (!tag || b.tags.includes(tag)) &&
      (!excludeTag || !b.tags.includes(excludeTag)) &&
      (!q || b.search.includes(q));
    b.el.hidden = !match;
    if (match) shown++;
    listEl.appendChild(b.el); // re-append in sorted order
  }
  emptyEl.hidden = shown > 0 || CARDS.length === 0;
}

if (searchEl) {
  [searchEl, categoryEl, tagEl, excludeTagEl, sortEl].forEach((el) =>
    el.addEventListener("input", render)
  );

  // Restore state from URL query params on load.
  const params = new URLSearchParams(location.search);
  if (params.has("q")) searchEl.value = params.get("q");
  if (params.has("category")) categoryEl.value = params.get("category");
  if (params.has("tag")) tagEl.value = params.get("tag");
  if (params.has("exclude")) excludeTagEl.value = params.get("exclude");
  if (params.has("sort")) sortEl.value = params.get("sort");

  render();
}
