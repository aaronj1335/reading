# Reading

A personal Goodreads. Every book I've read is a Markdown file under
[`books/`](books/); a small Python build turns them into a static, mobile-friendly,
searchable site that's deployed to GitHub Pages.

## How it works

- **`books/<slug>.md`** — one file per book, with YAML frontmatter. This is the
  source of truth; edit these by hand.
- **`build.py`** — reads every `books/*.md` and generates `_site/`: an `index.html`
  with a searchable/filterable/sortable list plus one page per book. No template
  engine, no JS frameworks (just a CDN CSS reset).
- **Covers.** Each book shows a real cover when one is available: set `isbn:` in a
  book's frontmatter and the cover is loaded from Open Library
  (`https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg`), or set `cover:` to any
  image URL directly. When neither is set (or Open Library has no cover for that
  ISBN), the page falls back to a generated `_site/covers/<slug>.svg` — a
  self-contained placeholder with the title and author over a colour derived from
  the title. Cover images are only ever fetched by the visitor's browser, so the
  build itself stays offline with no dependency on external services.
- **`.github/workflows/build.yml`** — on every push to `main`, runs the build and
  deploys `_site/` straight to GitHub Pages (no `gh-pages` branch; the site is
  uploaded as a Pages artifact).

The index sorts by finished date by default (falling back to started date when a
book has no finished date).

## Adding or editing a book

Create `books/<slug>.md` (slug = lowercase, hyphenated title) with this
frontmatter:

```yaml
---
title: The Brothers Karamazov
author: Fyodor Dostoevsky
finished: 2025-12-29      # ISO date, or leave blank: `finished:`
started: 2022-04-12       # ISO date
category: fiction         # fiction | nonfiction
tags: [read-with-kids]    # [] if none
isbn: "9780374528379"     # optional; loads a real cover from Open Library
---

Optional notes in Markdown go here; they render on the book's page.
```

Notes on the fields:

- **YAML quoting:** leave values unquoted when possible. Quote with `"..."` only
  when the value would otherwise confuse YAML — most commonly a title containing
  `: ` (e.g. `"Guns, Germs, and Steel: The Fates of Human Societies"`) or a purely
  numeric title (e.g. `"1984"`).
- **`category`** is either `fiction` or `nonfiction`.
- **`tags`** is a YAML list. The current tags are just `read-with-kids`.
- **`isbn`** (optional) loads a real cover from Open Library. Quote it (`"..."`) so
  YAML keeps it a string. Most ISBNs here were seeded from the Goodreads export;
  books whose export row had no ISBN fall back to the generated cover until an
  `isbn:` is filled in.
- **`cover`** (optional) is an explicit image URL that overrides `isbn`. Use it for
  a book that has no ISBN or when you want a specific cover image.

Commit and push to `main` — the workflow rebuilds and redeploys automatically.

## Build locally

Requires [uv](https://docs.astral.sh/uv/):

```sh
uv run build.py
```

Then open `_site/index.html` in a browser.

## One-time setup

In **Settings → Pages**, set the source to **GitHub Actions**.

`goodreads_library_export.csv` is the original Goodreads export the library was
seeded from; it's kept for reference and is not used by the build.
