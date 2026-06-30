#!/usr/bin/env python3
"""Build the static "personal Goodreads" site from books/*.md into _site/.

Source of truth is one Markdown file per book under books/, each with YAML
frontmatter (title, author, finished, started, category, tags). This script
parses them and renders:

  _site/index.html        searchable / filterable / sortable list
  _site/stats.html        reading statistics page
  _site/books/<slug>.html one page per book
  _site/index.js          copied from static/
  _site/stats.js          copied from static/
  _site/style.css         copied from static/
  _site/.nojekyll         so GitHub Pages serves files verbatim

The page markup lives in templates/*.template.html. Each template is a plain
string with `{name}` placeholders filled in via str.format — no template engine
is required.
"""
import colorsys
import csv
import hashlib
import html
import io
import json
import re
import shutil
import textwrap
from collections import defaultdict
from datetime import date as _date
from functools import lru_cache
from statistics import median
from pathlib import Path

import markdown
import yaml

ROOT = Path(__file__).parent
BOOKS_DIR = ROOT / "books"
STATIC_DIR = ROOT / "static"
TEMPLATES_DIR = ROOT / "templates"
SITE_DIR = ROOT / "_site"


@lru_cache(maxsize=None)
def template(name):
    """Load templates/<name>, cached for the life of the build."""
    return (TEMPLATES_DIR / name).read_text(encoding="utf-8")

NORMALIZE_CDN = "https://cdn.jsdelivr.net/npm/modern-normalize@3.0.1/modern-normalize.min.css"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?(.*)$", re.DOTALL)


def parse_book(path):
    """Parse a book Markdown file into a dict; body rendered to HTML."""
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError(f"{path.name}: missing YAML frontmatter")
    meta = yaml.safe_load(m.group(1)) or {}
    body_md = m.group(2).strip()

    def as_date(value):
        # PyYAML may parse a date into a date object; normalise to ISO string.
        return value.isoformat() if hasattr(value, "isoformat") else (value or "")

    def as_stars(value):
        # 1–5 Goodreads rating; 0 / blank / unparseable means "unrated".
        try:
            n = int(value)
        except (TypeError, ValueError):
            return 0
        return n if 0 <= n <= 5 else 0

    title = str(meta.get("title", "")).strip()
    finished = as_date(meta.get("finished"))
    started = as_date(meta.get("started"))
    # Real cover art: an explicit `cover:` URL wins; otherwise derive one from
    # `isbn:` via Open Library's by-ISBN cover endpoint. `default=false` makes it
    # 404 (rather than serve a blank placeholder) when no cover exists, so the
    # client can fall back to the generated SVG cover.
    isbn = re.sub(r"[^0-9Xx]", "", str(meta.get("isbn", "")))
    cover = str(meta.get("cover", "")).strip()
    if not cover and isbn:
        cover = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false"
    try:
        pages = int(meta.get("pages") or 0) or None
    except (TypeError, ValueError):
        pages = None

    return {
        "slug": path.stem,
        "title": title,
        "author": str(meta.get("author", "")).strip(),
        "finished": finished,
        "started": started,
        "cover": cover,
        "stars": as_stars(meta.get("stars")),
        # sort key: finished if present, else started (the requested fallback)
        "sort_date": finished or started,
        "category": str(meta.get("category", "")).strip(),
        "tags": [str(t).strip() for t in (meta.get("tags") or [])],
        "pages": pages,
        "body_html": markdown.markdown(body_md) if body_md else "",
    }


def load_books():
    books = [parse_book(p) for p in sorted(BOOKS_DIR.glob("*.md"))]
    # Default order: most recent first by sort_date (finished, else started).
    books.sort(key=lambda b: b["sort_date"], reverse=True)
    return books


def e(s):
    return html.escape(s, quote=True)


def page(title, head_extra, body, depth):
    """Wrap body in the shared HTML shell. `depth` = path depth below site root."""
    prefix = "../" * depth
    return template("page.template.html").format(
        title=e(title),
        normalize_cdn=NORMALIZE_CDN,
        prefix=prefix,
        head_extra=head_extra,
        body=body,
    )


def stars_display(n):
    """Render a 1–5 rating as filled/empty stars; empty string when unrated."""
    return "★" * n + "☆" * (5 - n) if n else ""


def render_index(books):
    fields = ("slug", "title", "author", "finished", "started", "sort_date",
              "category", "tags", "stars", "cover")
    data = json.dumps([{k: b[k] for k in fields} for b in books], ensure_ascii=False)
    # All distinct tags, for the tag filter.
    tags = sorted({t for b in books for t in b["tags"]})
    tag_options = "".join(f'<option value="{e(t)}">{e(t)}</option>' for t in tags)

    controls = template("controls.template.html").format(tag_options=tag_options)
    body = template("index.template.html").format(controls=controls, data=data)
    return page("Reading", "", body, depth=0)


def render_stats(books):
    finished = [b for b in books if b["finished"]]

    by_year = defaultdict(list)
    for b in finished:
        year = int(b["finished"][:4])
        by_year[year].append(b)

    years = sorted(by_year.keys())

    # Chart spans every year in the range, filling gaps with zero counts so the
    # line dips to the axis for years with no finished books.
    chart_years = range(years[0], years[-1] + 1) if years else []
    by_year_data = [
        {
            "year": yr,
            "count": len(by_year[yr]),
            "pages": sum(b["pages"] for b in by_year[yr] if b["pages"]),
            "fiction": sum(1 for b in by_year[yr] if b["category"] == "fiction"),
            "nonfiction": sum(1 for b in by_year[yr] if b["category"] == "nonfiction"),
        }
        for yr in chart_years
    ]

    book_fields = ("slug", "title", "author", "finished", "stars", "category", "tags", "cover", "pages")
    books_by_year = {
        str(yr): [
            {k: b[k] for k in book_fields}
            for b in sorted(by_year[yr], key=lambda b: b["finished"], reverse=True)
        ]
        for yr in years
    }

    fiction_count = sum(1 for b in books if b["category"] == "fiction")
    nonfiction_count = sum(1 for b in books if b["category"] == "nonfiction")

    pages_total = sum(b["pages"] for b in books if b["pages"])
    pages_fiction = sum(b["pages"] for b in books if b["pages"] and b["category"] == "fiction")
    pages_nonfiction = sum(b["pages"] for b in books if b["pages"] and b["category"] == "nonfiction")

    # Median books finished per year, considering only years with at least one
    # finished book (years with zero reads are not tracked in `years`).
    per_year_counts = sorted(len(by_year[yr]) for yr in years)
    median_per_year = round(median(per_year_counts), 1) if per_year_counts else 0
    default_year = str(years[-1]) if years else ""

    # Rating distribution: how many books carry each 1–5 star rating
    # (unrated books, stars == 0, are excluded).
    by_rating = {n: sum(1 for b in books if b["stars"] == n) for n in range(1, 6)}

    stats_data = {
        "total": len(books),
        "finished": len(finished),
        "median_per_year": median_per_year,
        "by_year": by_year_data,
        "by_category": {"fiction": fiction_count, "nonfiction": nonfiction_count},
        "by_rating": by_rating,
        "pages": {"total": pages_total, "fiction": pages_fiction, "nonfiction": pages_nonfiction},
        "books_by_year": books_by_year,
    }
    data = json.dumps(stats_data, ensure_ascii=False)

    year_options = "".join(
        f'<option value="{yr}"{" selected" if str(yr) == default_year else ""}>{yr}</option>'
        for yr in reversed(years)
    )
    year_range = f"{years[0]}–{years[-1]}" if len(years) > 1 else (str(years[0]) if years else "")

    # Show a Books/Pages metric toggle on the year chart only when at least one
    # finished book carries a page count (otherwise "Pages" would be all zero).
    has_year_pages = any(d["pages"] for d in by_year_data)
    year_chart_toggle = (
        template("year-chart-toggle.template.html") if has_year_pages else ""
    )

    body = template("stats.template.html").format(
        year_range=e(year_range),
        finished_count=len(finished),
        total_count=len(books),
        years_count=len(years),
        median_per_year=median_per_year,
        year_chart_toggle=year_chart_toggle,
        default_year=e(default_year),
        year_options=year_options,
        data=data,
    )

    return page("Reading Stats", "", body, depth=0)


def render_book(book):
    meta_rows = []
    if book["stars"]:
        meta_rows.append(("Rating", stars_display(book["stars"])))
    if book["finished"]:
        meta_rows.append(("Finished", book["finished"]))
    if book["started"]:
        meta_rows.append(("Started", book["started"]))
    if book["category"]:
        meta_rows.append(("Category", book["category"]))
    if book["pages"]:
        meta_rows.append(("Pages", str(book["pages"])))
    if book["tags"]:
        meta_rows.append(("Tags", ", ".join(book["tags"])))
    meta_html = "".join(
        f'<div class="meta-row"><span class="meta-label">{e(k)}</span>'
        f'<span class="meta-value">{e(v)}</span></div>'
        for k, v in meta_rows
    )
    body_html = f'<div class="book-body">{book["body_html"]}</div>' if book["body_html"] else ""
    fallback = f"../covers/{e(book['slug'])}.svg"
    cover_src = e(book["cover"]) if book["cover"] else fallback
    onerror = (
        f" onerror=\"this.onerror=null;this.src='{fallback}'\"" if book["cover"] else ""
    )
    body = template("book.template.html").format(
        cover_src=cover_src,
        onerror=onerror,
        title=e(book["title"]),
        author=e(book["author"]),
        meta_html=meta_html,
        body_html=body_html,
    )
    return page(book["title"], "", body, depth=1)


def cover_svg(book):
    """Generate a self-contained SVG cover for a book.

    No real cover art is fetched (the build stays offline and dependency-free);
    instead each book gets a deterministic, readable cover whose colours are
    derived from a hash of its title so the same book always looks the same.
    """
    W, H = 300, 450
    seed = int(hashlib.sha1(book["slug"].encode("utf-8")).hexdigest(), 16)
    hue = (seed % 360) / 360.0
    # Two tones of the same hue for a subtle vertical gradient.
    top = colorsys.hls_to_rgb(hue, 0.34, 0.45)
    bottom = colorsys.hls_to_rgb(hue, 0.22, 0.50)

    def hex_color(rgb):
        return "#" + "".join(f"{int(c * 255):02x}" for c in rgb)

    # Wrap the title to fit the cover width (rough char budget per line).
    title_lines = textwrap.wrap(book["title"], width=16) or [""]
    title_lines = title_lines[:5]
    line_h = 30
    start_y = H / 2 - (len(title_lines) - 1) * line_h / 2 - 20
    title_tspans = "".join(
        f'<tspan x="{W / 2}" y="{start_y + i * line_h:.0f}">{e(line)}</tspan>'
        for i, line in enumerate(title_lines)
    )

    author_lines = textwrap.wrap(book["author"], width=22)[:2]
    author_tspans = "".join(
        f'<tspan x="{W / 2}" y="{H - 46 + i * 20:.0f}">{e(line)}</tspan>'
        for i, line in enumerate(author_lines)
    )

    grad_id = f"g{seed % 100000}"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" \
role="img" aria-label="{e(book['title'])} by {e(book['author'])}">
  <defs>
    <linearGradient id="{grad_id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{hex_color(top)}"/>
      <stop offset="1" stop-color="{hex_color(bottom)}"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#{grad_id})"/>
  <rect x="14" y="14" width="{W - 28}" height="{H - 28}" fill="none" \
stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
  <rect x="0" y="0" width="10" height="{H}" fill="rgba(0,0,0,0.18)"/>
  <text text-anchor="middle" fill="#fff" font-family="Georgia, 'Times New Roman', serif" \
font-size="24" font-weight="600">{title_tspans}</text>
  <text text-anchor="middle" fill="rgba(255,255,255,0.85)" \
font-family="Georgia, 'Times New Roman', serif" font-size="14" \
font-style="italic">{author_tspans}</text>
</svg>
"""


def render_csv(books):
    """Generate a CSV export of all books."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["title", "author", "finished", "started", "category", "tags", "stars", "pages"])
    for book in books:
        writer.writerow([
            book["title"],
            book["author"],
            book["finished"],
            book["started"],
            book["category"],
            ", ".join(book["tags"]),
            book["stars"] or "",
            book["pages"] or "",
        ])
    return out.getvalue()


def render_rss(books):
    """Generate an RSS 2.0 feed of finished books, most recent first."""
    items = []
    for book in books:
        if not book["finished"]:
            continue
        try:
            d = _date.fromisoformat(book["finished"])
            pub_date = d.strftime("%a, %d %b %Y 00:00:00 +0000")
        except ValueError:
            pub_date = ""
        stars_text = f" {stars_display(book['stars'])}" if book["stars"] else ""
        desc = e(f'{book["author"]}{stars_text}')
        items.append(
            f"    <item>\n"
            f"      <title>{e(book['title'])}</title>\n"
            f"      <link>books/{e(book['slug'])}.html</link>\n"
            f"      <description>{desc}</description>\n"
            f"      <pubDate>{pub_date}</pubDate>\n"
            f"      <guid isPermaLink=\"false\">{e(book['slug'])}</guid>\n"
            f"    </item>"
        )
    items_str = "\n".join(items)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        "  <channel>\n"
        "    <title>Reading</title>\n"
        "    <link>index.html</link>\n"
        "    <description>Books I&#39;ve read</description>\n"
        f"{items_str}\n"
        "  </channel>\n"
        "</rss>\n"
    )


def main():
    if SITE_DIR.exists():
        shutil.rmtree(SITE_DIR)
    (SITE_DIR / "books").mkdir(parents=True)

    books = load_books()

    (SITE_DIR / "covers").mkdir()
    for book in books:
        (SITE_DIR / "covers" / f"{book['slug']}.svg").write_text(
            cover_svg(book), encoding="utf-8"
        )

    (SITE_DIR / "index.html").write_text(render_index(books), encoding="utf-8")
    (SITE_DIR / "stats.html").write_text(render_stats(books), encoding="utf-8")
    for book in books:
        (SITE_DIR / "books" / f"{book['slug']}.html").write_text(
            render_book(book), encoding="utf-8"
        )

    (SITE_DIR / "books.csv").write_text(render_csv(books), encoding="utf-8")
    (SITE_DIR / "feed.rss").write_text(render_rss(books), encoding="utf-8")

    for asset in ("index.js", "stats.js", "style.css"):
        shutil.copy(STATIC_DIR / asset, SITE_DIR / asset)
    (SITE_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print(f"Built {len(books)} books into {SITE_DIR}/")


if __name__ == "__main__":
    main()
