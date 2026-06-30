"use strict";

(function () {
  const data = JSON.parse(document.getElementById("stats-data").textContent);

  // ── SVG line chart: books finished per year ───────────────────────────────

  function renderYearChart() {
    const container = document.getElementById("year-chart-container");
    if (!container || data.by_year.length < 1) return;

    const W = 560, H = 180;
    const ML = 36, MT = 16, MR = 20, MB = 40;
    const plotW = W - ML - MR;
    const plotH = H - MT - MB;

    const years = data.by_year.map((d) => d.year);
    const counts = data.by_year.map((d) => d.count);
    const maxCount = Math.max(...counts);
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const yearSpan = maxYear - minYear || 1;

    const xScale = (yr) => ML + ((yr - minYear) / yearSpan) * plotW;
    const yScale = (n) => MT + (1 - n / maxCount) * plotH;

    // Y-axis grid lines
    const gridStep = maxCount <= 5 ? 1 : maxCount <= 10 ? 2 : 5;
    let gridLines = "";
    for (let v = 0; v <= maxCount; v += gridStep) {
      const yv = yScale(v).toFixed(1);
      gridLines +=
        `<line x1="${ML}" y1="${yv}" x2="${W - MR}" y2="${yv}" class="chart-grid"/>` +
        `<text x="${ML - 6}" y="${(parseFloat(yv) + 4).toFixed(1)}" ` +
        `text-anchor="end" class="chart-label">${v}</text>`;
    }

    // Polyline points
    const pts = data.by_year
      .map((d) => `${xScale(d.year).toFixed(1)},${yScale(d.count).toFixed(1)}`)
      .join(" ");

    // Area fill polygon: trace line then close along the bottom
    const bottomY = (MT + plotH).toFixed(1);
    const areaPts =
      `${xScale(minYear).toFixed(1)},${bottomY} ${pts} ` +
      `${xScale(maxYear).toFixed(1)},${bottomY}`;

    // Interactive dots
    const dots = data.by_year
      .map(
        (d) =>
          `<circle cx="${xScale(d.year).toFixed(1)}" cy="${yScale(d.count).toFixed(1)}" r="5" ` +
          `class="chart-dot" data-year="${d.year}" tabindex="0" ` +
          `role="button" aria-label="${d.year}: ${d.count} book${d.count !== 1 ? "s" : ""}"` +
          `/>`
      )
      .join("");

    // X-axis year labels
    const xLabels = years
      .map(
        (yr) =>
          `<text x="${xScale(yr).toFixed(1)}" y="${H - MB + 18}" ` +
          `text-anchor="middle" class="chart-label">${yr}</text>`
      )
      .join("");

    container.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" width="100%" class="year-chart-svg" ` +
      `role="img" aria-label="Books finished per year">` +
      `<defs><linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" class="area-stop-top"/>` +
      `<stop offset="100%" class="area-stop-bottom"/>` +
      `</linearGradient></defs>` +
      gridLines +
      `<polygon points="${areaPts}" class="chart-area"/>` +
      `<polyline points="${pts}" class="chart-line"/>` +
      dots +
      xLabels +
      `</svg>`;

    // Clicking a dot scrolls to that year in the year-in-books section
    container.querySelectorAll(".chart-dot").forEach((dot) => {
      const activate = () => {
        const yr = dot.getAttribute("data-year");
        const sel = document.getElementById("year-select");
        if (sel) {
          sel.value = yr;
          sel.dispatchEvent(new Event("change"));
        }
        document
          .querySelector(".stats-section:nth-child(3)")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      dot.addEventListener("click", activate);
      dot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
    });
  }

  // ── Year-in-books book list ───────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function starsDisplay(n) {
    return n ? "★".repeat(n) + "☆".repeat(5 - n) : "";
  }

  function renderYearBooks(year) {
    const list = document.getElementById("year-book-list");
    if (!list) return;

    const books = data.books_by_year[String(year)] || [];
    if (books.length === 0) {
      list.innerHTML =
        `<li style="color:var(--muted);padding:1rem 0;list-style:none">No finished books recorded for ${escapeHtml(year)}.</li>`;
      return;
    }

    list.innerHTML = books
      .map((b) => {
        const stars = b.stars
          ? `<span class="stars" aria-label="${b.stars} of 5 stars">${starsDisplay(b.stars)}</span>`
          : "";
        const catBadge = b.category
          ? `<span class="badge badge-${escapeHtml(b.category)}">${escapeHtml(b.category)}</span>`
          : "";
        const tagBadges = (b.tags || [])
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("");
        const date = b.finished ? `<span class="card-date">${escapeHtml(b.finished)}</span>` : "";
        const slug = encodeURIComponent(b.slug);
        const fallback = `covers/${slug}.svg`;
        const imgSrc = escapeHtml(b.cover || fallback);
        const onerror = b.cover
          ? ` onerror="this.onerror=null;this.src='${fallback}'"`
          : "";
        return (
          `<li class="card">` +
          `<a class="card-link" href="books/${slug}.html">` +
          `<img class="card-cover" src="${imgSrc}"${onerror} alt="" width="300" height="450" loading="lazy">` +
          `<span class="card-text">` +
          `<span class="card-title">${escapeHtml(b.title)}</span>` +
          `<span class="card-author">${escapeHtml(b.author)}</span>` +
          `<span class="card-meta">${catBadge}${stars}${tagBadges}${date}</span>` +
          `</span></a></li>`
        );
      })
      .join("");
  }

  // ── Category bar chart ────────────────────────────────────────────────────

  function renderCategoryChart() {
    const container = document.getElementById("category-chart");
    if (!container) return;

    const { fiction, nonfiction } = data.by_category;
    const total = fiction + nonfiction;
    const cats = [
      { key: "fiction", label: "Fiction", count: fiction },
      { key: "nonfiction", label: "Nonfiction", count: nonfiction },
    ];

    container.innerHTML = cats
      .map(({ key, label, count }) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
        return (
          `<div class="cat-bar-row">` +
          `<span class="cat-bar-label">${label}</span>` +
          `<div class="cat-bar-track" role="meter" aria-valuenow="${count}" aria-valuemax="${total}" aria-label="${label}">` +
          `<div class="cat-bar-fill ${key}" style="width:${pct}%"></div>` +
          `</div>` +
          `<span class="cat-bar-count">${count}</span>` +
          `</div>`
        );
      })
      .join("");

    // Pages breakdown (only shown when pages data exists)
    const { total: pagesTotal, fiction: pagesFiction, nonfiction: pagesNonfiction } = data.pages;
    if (pagesTotal > 0) {
      const pagesSection = document.createElement("div");
      pagesSection.className = "pages-breakdown";
      pagesSection.innerHTML =
        `<h3 class="stats-subsection-heading">Pages</h3>` +
        [
          { key: "fiction", label: "Fiction", count: pagesFiction },
          { key: "nonfiction", label: "Nonfiction", count: pagesNonfiction },
        ]
          .map(({ key, label, count }) => {
            const pct = pagesTotal > 0 ? ((count / pagesTotal) * 100).toFixed(0) : 0;
            return (
              `<div class="cat-bar-row">` +
              `<span class="cat-bar-label">${label}</span>` +
              `<div class="cat-bar-track" role="meter" aria-valuenow="${count}" aria-valuemax="${pagesTotal}" aria-label="${label} pages">` +
              `<div class="cat-bar-fill ${key}" style="width:${pct}%"></div>` +
              `</div>` +
              `<span class="cat-bar-count">${count.toLocaleString()}</span>` +
              `</div>`
            );
          })
          .join("") +
        `<p class="cat-total">${pagesTotal.toLocaleString()} pages total</p>`;
      container.appendChild(pagesSection);
    }
  }

  // ── Rating distribution bar chart ─────────────────────────────────────────

  function renderRatingChart() {
    const container = document.getElementById("rating-chart");
    if (!container || !data.by_rating) return;

    // Highest star ratings on top (5 → 1).
    const rows = [5, 4, 3, 2, 1].map((n) => ({
      stars: n,
      count: data.by_rating[n] || 0,
    }));
    const maxCount = Math.max(1, ...rows.map((r) => r.count));

    container.innerHTML = rows
      .map(({ stars, count }) => {
        const pct = ((count / maxCount) * 100).toFixed(0);
        const label = starsDisplay(stars);
        return (
          `<div class="rating-bar-row">` +
          `<span class="rating-bar-label" aria-hidden="true">${label}</span>` +
          `<div class="rating-bar-track" role="meter" aria-valuenow="${count}" aria-valuemax="${maxCount}" aria-label="${stars} star${stars !== 1 ? "s" : ""}: ${count} book${count !== 1 ? "s" : ""}">` +
          `<div class="rating-bar-fill" style="width:${pct}%"></div>` +
          `</div>` +
          `<span class="rating-bar-count">${count}</span>` +
          `</div>`
        );
      })
      .join("");
  }

  // ── Wire up year selector ─────────────────────────────────────────────────

  const yearSelect = document.getElementById("year-select");
  const yearHeading = document.getElementById("year-section-heading");
  if (yearSelect) {
    yearSelect.addEventListener("change", function () {
      if (yearHeading) yearHeading.textContent = this.value + " in books";
      renderYearBooks(this.value);
    });
    renderYearBooks(yearSelect.value);
  }

  renderYearChart();
  renderCategoryChart();
  renderRatingChart();
})();
