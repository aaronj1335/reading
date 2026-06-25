"use strict";

// Books come pre-sorted from the build (most recently finished first), but we
// re-sort/filter entirely client-side so the controls feel instant.
const BOOKS = JSON.parse(document.getElementById("books-data").textContent);

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const categoryEl = document.getElementById("category");
const tagEl = document.getElementById("tag");
const sortEl = document.getElementById("sort");

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = parseInt(m, 10) - 1;
  if (!m) return y;
  return `${months[mi]} ${d ? parseInt(d, 10) + ", " : ""}${y}`;
}

const SORTERS = {
  finished: (a, b) => cmpDesc(a.finished || a.started, b.finished || b.started),
  started: (a, b) => cmpDesc(a.started, b.started),
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) => a.author.localeCompare(b.author) || a.title.localeCompare(b.title),
};

function cmpDesc(a, b) {
  // Empty dates sort last; otherwise newest first (ISO strings compare lexically).
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const cat = categoryEl.value;
  const tag = tagEl.value;
  const sort = sortEl.value;

  let books = BOOKS.filter((b) => {
    if (cat && b.category !== cat) return false;
    if (tag && !b.tags.includes(tag)) return false;
    if (q) {
      const hay = (b.title + " " + b.author + " " + b.tags.join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  books = books.slice().sort(SORTERS[sort] || SORTERS.finished);

  countEl.textContent = books.length;
  emptyEl.hidden = books.length > 0;
  listEl.innerHTML = books.map(card).join("");
}

function card(b) {
  const dateLabel = sortEl.value === "started" ? b.started : (b.finished || b.started);
  const datePrefix = sortEl.value === "started" ? "Started " :
                     (b.finished ? "Finished " : "Started ");
  const date = dateLabel ? `<span class="card-date">${datePrefix}${formatDate(dateLabel)}</span>` : "";
  const tags = b.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  return `<li class="card">
    <a class="card-link" href="books/${encodeURIComponent(b.slug)}.html">
      <span class="card-title">${escapeHtml(b.title)}</span>
      <span class="card-author">${escapeHtml(b.author)}</span>
    </a>
    <div class="card-meta">
      <span class="badge badge-${escapeHtml(b.category)}">${escapeHtml(b.category)}</span>
      ${tags}
      ${date}
    </div>
  </li>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

[searchEl, categoryEl, tagEl, sortEl].forEach((el) =>
  el.addEventListener("input", render)
);

render();
