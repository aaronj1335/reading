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
tags: [fiction]           # Must include exactly one of fiction | nonfiction,
                          # plus any other tags: [fiction, read-with-kids].
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