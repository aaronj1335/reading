"use strict";

// Books come pre-sorted from the build (most recently finished first), but we
// re-sort/filter entirely client-side so the controls feel instant.
const BOOKS = JSON.parse(document.getElementById("books-data").textContent);

const CATEGORY_TAGS = ["fiction", "nonfiction"];

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const tagBtnEl = document.getElementById("tag-btn");
const tagBtnLabelEl = document.getElementById("tag-btn-label");
const tagMenuEl = document.getElementById("tag-menu");
const tagModeEl = document.getElementById("tag-mode");
const sortEl = document.getElementById("sort");
const tagBoxes = Array.from(tagMenuEl.querySelectorAll('input[type="checkbox"]'));

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
  stars: (a, b) => (b.stars || 0) - (a.stars || 0) ||
                   cmpDesc(a.finished || a.started, b.finished || b.started),
};

// With no tags selected the filter is a no-op; otherwise the mode select
// decides how a book's tags must relate to the selected set.
const TAG_FILTERS = {
  any: (tags, sel) => sel.some((t) => tags.includes(t)),
  all: (tags, sel) => sel.every((t) => tags.includes(t)),
  none: (tags, sel) => !sel.some((t) => tags.includes(t)),
};

function selectedTags() {
  return tagBoxes.filter((box) => box.checked).map((box) => box.value);
}

function starsDisplay(n) {
  return n ? "★".repeat(n) + "☆".repeat(5 - n) : "";
}

function cmpDesc(a, b) {
  // Empty dates sort last; otherwise newest first (ISO strings compare lexically).
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
}

function updateUrl() {
  const params = new URLSearchParams();
  const q = searchEl.value.trim();
  const tags = selectedTags();
  const sort = sortEl.value;
  if (q) params.set("q", q);
  if (tags.length) {
    params.set("tags", tags.join(","));
    if (tagModeEl.value !== "any") params.set("mode", tagModeEl.value);
  }
  if (sort && sort !== "finished") params.set("sort", sort);
  const qs = params.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const sel = selectedTags();
  const tagMatch = TAG_FILTERS[tagModeEl.value] || TAG_FILTERS.any;
  const sort = sortEl.value;

  updateUrl();
  tagBtnLabelEl.textContent = sel.length ? `Tags · ${sel.length}` : "Tags";

  let books = BOOKS.filter((b) => {
    if (sel.length && !tagMatch(b.tags, sel)) return false;
    if (q) {
      const hay = (b.title + " " + b.author + " " + b.tags.join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  books = books.slice().sort(SORTERS[sort] || SORTERS.finished);

  countEl.textContent = `Showing ${books.length} of ${BOOKS.length} books`;
  emptyEl.hidden = books.length > 0;
  listEl.innerHTML = books.map(card).join("");
}

function card(b) {
  const dateLabel = sortEl.value === "started" ? b.started : (b.finished || b.started);
  const datePrefix = sortEl.value === "started" ? "Started " :
                     (b.finished ? "Finished " : "Started ");
  const date = dateLabel ? `<span class="card-date">${datePrefix}${formatDate(dateLabel)}</span>` : "";
  const category = b.tags.find((t) => CATEGORY_TAGS.includes(t)) || "";
  const tags = b.tags.filter((t) => t !== category)
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const stars = b.stars
    ? `<span class="stars" aria-label="${b.stars} of 5 stars">${starsDisplay(b.stars)}</span>`
    : "";
  const slug = encodeURIComponent(b.slug);
  const fallback = `covers/${slug}.svg`;
  const coverSrc = b.cover || fallback;
  const onerror = b.cover
    ? ` onerror="this.onerror=null;this.src='${fallback}'"`
    : "";
  return `<li class="card">
    <a class="card-link" href="books/${slug}.html">
      <img class="card-cover" src="${escapeHtml(coverSrc)}"${onerror} alt="" width="300" height="450" loading="lazy">
      <span class="card-text">
        <span class="card-title">${titleHtml(b.title)}</span>
        <span class="card-author">${escapeHtml(b.author)}</span>
        <span class="card-meta">
          <span class="badge badge-${escapeHtml(category)}">${escapeHtml(category)}</span>
          ${stars}
          ${tags}
          ${date}
        </span>
      </span>
    </a>
  </li>`;
}

// Split an `Everything: after a colon` subtitle onto its own line. Text before
// the first colon is the main title; text after it becomes a `.subtitle` span
// (smaller, italic, not bold). Titles with no colon render unchanged.
function titleHtml(title) {
  const i = title.indexOf(":");
  if (i === -1) return escapeHtml(title);
  const subtitle = title.slice(i + 1).trim();
  if (!subtitle) return escapeHtml(title);
  return `${escapeHtml(title.slice(0, i).trim())}<span class="subtitle">${escapeHtml(subtitle)}</span>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// The tag multiselect is a disclosure: the button reveals a panel of native
// checkboxes. The `hidden` attribute keeps the closed panel out of both the
// tab order and the accessibility tree.
function setTagMenuOpen(open) {
  tagMenuEl.hidden = !open;
  tagBtnEl.setAttribute("aria-expanded", String(open));
}

tagBtnEl.addEventListener("click", () => setTagMenuOpen(tagMenuEl.hidden));

document.addEventListener("click", (ev) => {
  if (!tagMenuEl.hidden && !ev.target.closest(".multiselect")) setTagMenuOpen(false);
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !tagMenuEl.hidden) {
    setTagMenuOpen(false);
    tagBtnEl.focus();
  }
});

tagMenuEl.addEventListener("change", render);
[searchEl, tagModeEl, sortEl].forEach((el) => el.addEventListener("input", render));

// Restore state from URL query params on load.
(function () {
  const params = new URLSearchParams(location.search);
  if (params.has("q")) searchEl.value = params.get("q");
  if (params.has("tags")) {
    const want = new Set(params.get("tags").split(","));
    tagBoxes.forEach((box) => { box.checked = want.has(box.value); });
  }
  if (params.has("mode")) tagModeEl.value = params.get("mode");
  if (params.has("sort")) sortEl.value = params.get("sort");
})();

render();
