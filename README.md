# Reading

Tracking the books I've read and what I've learned from them.

View the content at https://aaronstacy.com/reading.

A lot of this info is available on [my Goodreads profile](https://www.goodreads.com/user/show/70736164-aaron), but I find this easier to look back on and use for getting recommendations on new books.

## Adding or editing a book

Create `books/<slug>.md` (slug = lowercase, hyphenated title) with this
frontmatter:

```yaml
---
title: Gilead
author: Marilynne Robinson
isbn: 9780312424404       # Any ISBN. This is mostly used for cover tracking.
finished: 2017-10-07       # ISO date, or leave blank: `finished:`
started: 2017-08-24       # ISO date
stars: 5                  # 1–5 Goodreads rating, or leave blank: `stars:`
category: fiction          # fiction | nonfiction
tags: []                  # Leave out if empty, otherwise something like [read-with-kids].
---

Optional notes in Markdown go here; they render on the book's page.
```

## Build locally

Requires [uv](https://docs.astral.sh/uv/):

```sh
uv run build.py
python3 -m http.server -d _site
open http://localhost:8000
```