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

### Poems

Write any verse in your notes with Markdown hard line breaks — end each line
with two trailing spaces — either inside a `>` quote block or as a bare
stanza:

```markdown
> Two roads diverged in a yellow wood,··
> And sorry I could not travel both··
```

(`··` = two trailing spaces.) In the publish-on-demand export these blocks
are typeset as poetry: the poem is centered on its longest line, with the
lines left-aligned relative to each other.

## Want to read

`want-to-read.yaml` is the queue of books to get to next: a YAML list whose
entries use the same fields as the frontmatter above, so an entry can be lifted
straight into `books/<slug>.md` once the book is started.

```yaml
- title: Gilead
  author: Marilynne Robinson
  isbn: 9780312424404        # any ISBN; used to find cover art
  pages: 247
  category: fiction          # fiction | nonfiction
  tags: [read-with-kids]
  notes: Markdown, rendered under the entry.
```

Only `title` is required. `notes:` plays the part the Markdown body plays in a
book file, and `finished` / `started` / `stars` are simply the fields a book
picks up on its way into `books/`. Entries keep their file order — newest
first, by convention.

The build renders the list at `_site/want-to-read.html`, a standalone page
linked from the site header, with the same cards as the index. Each card
carries Open Library and Goodreads links for a quick summary — by ISBN when
the entry has one, otherwise a title-and-author search — so nothing extra has
to be recorded per book. That page's
"Add a book" link opens `want-to-read.yaml` in the GitHub web editor, so a
book can be queued from a phone — the same trick as "Edit this page" on a book
page.

When a book gets picked up, move its entry into `books/<slug>.md`; the build
prints a note if a queued title is already there.

## Publish-on-demand export

The build writes `_site/reading.epub`, an EPUB 3 with a cover, title page,
table of contents, and one chapter per book. It validates clean under
[EPUBCheck](https://www.w3.org/publishing/epubcheck/) and can be uploaded
as-is to publish-on-demand services such as Lulu, Kindle Direct Publishing,
or Blurb.

## Build locally

Requires [uv](https://docs.astral.sh/uv/):

```sh
uv run build.py
python3 -m http.server -d _site
open http://localhost:8000
```