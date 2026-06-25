#!/usr/bin/env python3
"""Build the static "personal Goodreads" site from books/*.md into _site/.

Source of truth is one Markdown file per book under books/, each with YAML
frontmatter (title, author, finished, started, category, tags). This script
parses them and renders:

  _site/index.html        searchable / filterable / sortable list
  _site/books/<slug>.html one page per book
  _site/index.js          copied from static/
  _site/style.css         copied from static/
  _site/.nojekyll         so GitHub Pages serves files verbatim

No template engine: pages are assembled with plain Python string helpers.
"""
import html
import json
import re
import shutil
from pathlib import Path

import markdown
import yaml

ROOT = Path(__file__).parent
BOOKS_DIR = ROOT / "books"
STATIC_DIR = ROOT / "static"
SITE_DIR = ROOT / "_site"

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
    return {
        "slug": path.stem,
        "title": title,
        "author": str(meta.get("author", "")).strip(),
        "finished": finished,
        "started": started,
        "stars": as_stars(meta.get("stars")),
        # sort key: finished if present, else started (the requested fallback)
        "sort_date": finished or started,
        "category": str(meta.get("category", "")).strip(),
        "tags": [str(t).strip() for t in (meta.get("tags") or [])],
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
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<link rel="stylesheet" href="{NORMALIZE_CDN}">
<link rel="stylesheet" href="{prefix}style.css">
{head_extra}
</head>
<body>
{body}
</body>
</html>
"""


def stars_display(n):
    """Render a 1–5 rating as filled/empty stars; empty string when unrated."""
    return "★" * n + "☆" * (5 - n) if n else ""


def render_index(books):
    fields = ("slug", "title", "author", "finished", "started", "sort_date",
              "category", "tags", "stars")
    data = json.dumps([{k: b[k] for k in fields} for b in books], ensure_ascii=False)
    # All distinct tags, for the tag filter.
    tags = sorted({t for b in books for t in b["tags"]})
    tag_options = "".join(f'<option value="{e(t)}">{e(t)}</option>' for t in tags)

    controls = f"""<div class="controls" id="controls">
  <input type="search" id="search" placeholder="Search title, author, tag…" autocomplete="off" aria-label="Search">
  <div class="filters">
    <select id="category" aria-label="Category">
      <option value="">All</option>
      <option value="fiction">Fiction</option>
      <option value="nonfiction">Nonfiction</option>
    </select>
    <select id="tag" aria-label="Tag">
      <option value="">All tags</option>
      {tag_options}
    </select>
    <select id="sort" aria-label="Sort by">
      <option value="finished">Recently finished</option>
      <option value="started">Recently started</option>
      <option value="title">Title</option>
      <option value="author">Author</option>
      <option value="stars">Rating</option>
    </select>
  </div>
</div>"""

    body = f"""<header class="site-header">
  <h1>Reading</h1>
  <p class="count"><span id="count">{len(books)}</span> books</p>
</header>
<main>
  {controls}
  <ul id="list" class="book-list"></ul>
  <p id="empty" class="empty" hidden>No books match.</p>
</main>
<script id="books-data" type="application/json">{data}</script>
<script src="index.js"></script>"""
    return page("Reading", "", body, depth=0)


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
    if book["tags"]:
        meta_rows.append(("Tags", ", ".join(book["tags"])))
    meta_html = "".join(
        f'<div class="meta-row"><span class="meta-label">{e(k)}</span>'
        f'<span class="meta-value">{e(v)}</span></div>'
        for k, v in meta_rows
    )
    body_html = f'<div class="book-body">{book["body_html"]}</div>' if book["body_html"] else ""
    body = f"""<article class="book-page">
  <p><a class="back" href="../index.html">← All books</a></p>
  <h1>{e(book["title"])}</h1>
  <p class="author">{e(book["author"])}</p>
  <div class="meta">{meta_html}</div>
  {body_html}
</article>"""
    return page(book["title"], "", body, depth=1)


def main():
    if SITE_DIR.exists():
        shutil.rmtree(SITE_DIR)
    (SITE_DIR / "books").mkdir(parents=True)

    books = load_books()

    (SITE_DIR / "index.html").write_text(render_index(books), encoding="utf-8")
    for book in books:
        (SITE_DIR / "books" / f"{book['slug']}.html").write_text(
            render_book(book), encoding="utf-8"
        )

    for asset in ("index.js", "style.css"):
        shutil.copy(STATIC_DIR / asset, SITE_DIR / asset)
    (SITE_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print(f"Built {len(books)} books into {SITE_DIR}/")


if __name__ == "__main__":
    main()
