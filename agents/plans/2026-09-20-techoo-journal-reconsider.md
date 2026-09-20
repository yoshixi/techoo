---
title: Techoo as a private journal (not a planner)
date: 2026-09-20
status: Proposed
branch: cursor/techoo-journal-reconsider-e888
---

# Techoo as a private journal

## Context

Techoo shipped as a **daily planner**: calendar to-dos as the plan, posts as a text log of what happened, notes for everything off the timeline. The current surfaces still encode that:

- Mobile home tab is **ToDos**; desktop default tab is **Todo**.
- Posts are **text-only** (`body` + `posted_at`). They can link to todos/events, be starred, and sit in named lists — but they have **no images**, no source/citation, no language fields.
- The composer assumes schedule context (associate a post with today's todos/`#` mentions).
- Notes are free-form pages; they are a dump, not a visual journal or a highlight inbox.

After using the app, the product pull is different:

1. **More journal** — the thing worth opening is the day's writing and pictures, not the task list.
2. **Todos should not be required** — a day with no planned blocks should still be a complete day in Techoo.
3. **Image share, Instagram-ish UI** — capture a photo (page, sign, meal, chalkboard) and browse a visual, private feed. "Share" here means *share into* the journal (Photos / Safari / share sheet), not a public social graph.
4. **Highlights of articles and books** — save a passage with enough source to find it again.
5. **Language learning** — the same capture habit, for sentences and words met in the wild.

The 手帳 metaphor still fits, and actually fits *this* better than the planner reading. A paper techo (Hobonichi, Traveler's Notebook) is a book you carry: dated pages, clippings, quotes, language scraps. The grid of tasks is optional stationery, not the reason the book exists.

`docs/CONCEPT.md` is updated to this product thesis. This ADR records the product and technical decisions so later work does not re-litigate "are we a planner?"

### Constraints

- Keep auth, per-user tenant DBs, and the existing posts/lists/favorites APIs. Do not big-bang a new domain the way `2026-04-11-techo-revamp` did.
- Stay single-user and private. Instagram-ish is **layout and capture**, not followers, likes-from-others, or a public profile.
- Do not become Anki, Readwise, or Day One clones. Those are reference products for *one* job each.
- Existing todo and calendar data stay. Demote, do not delete.

## Decision

### Product thesis

**Techoo is a private journal you carry.** The unit of attention is still *the day*, but the day is told by **entries** (photos, writing, highlights, language scraps), not by a required plan.

Todos and calendar remain available. They are no longer the home screen, and a journal entry does not need a todo to be valid.

### One primitive: journal entry (evolve `posts`)

Do **not** add three new resources (moments / highlights / language cards). Evolve `posts` into journal entries with optional attachments and optional structured fields.

| Field (conceptual) | Role | Required? |
|---|---|---|
| `body` | Caption, quote, or free writing | Soft — empty allowed if an image is present |
| `posted_at` | When it belongs on the day | Yes (defaults to now) |
| images | One or more photos | No |
| `source` | Book / article title, author, URL, page | No — used for highlights |
| `language` | BCP-47 tag of the captured text (e.g. `ja`, `en`, `fr`) | No — used for language learning |
| `gloss` | Translation or note on the captured text | No |
| lists / favorite | Existing collections | Unchanged |
| todo / event links | Optional context | Unchanged, no longer prompted by default |

Soft **intents** (composer presets, not schema enums) so the UI can be specific without fragmenting storage:

- **Moment** — photo-first, short caption.
- **Highlight** — quoted `body` + `source` (+ optional page photo).
- **Language** — `body` in the target language + `gloss` + `language` (+ optional photo of the sign/page).
- **Free** — writing with no extra fields.

Filtering later: `?language=ja`, `?has_source=true`, list tabs already in Timeline. A "French" list plus `language=fr` can coexist; lists stay human-named collections, language is a typed facet.

### Images and Instagram-ish UI

**Capture**

- Attach images on create/update of a post.
- Mobile: camera + library. Desktop: file picker / paste.
- OS share-in (iOS share extension / Android share intent) is the "image share" job: a photo or selected text from Safari/Books lands as a new entry. Treat this as the second slice after in-app attach, not as social posting.

**Browse**

- Home becomes a **visual journal feed**: full-bleed or near-full-bleed image, caption under, date/time quiet, actions (star, list, thread) secondary.
- Text-only entries still belong (a highlight with no photo, a language sentence typed on the train). They use a large-type card, not a tiny log row.
- Keep the warm, private Techo tone from `docs/UI_DESIGN_PRINCIPLES.md`. Instagram-ish means **photo hierarchy and card rhythm**, not black chrome, story rings, or engagement counts.

**Storage (when implemented)**

- Do not base64 images into SQLite. Object storage (R2, already used for APK) + a `post_images` table (`post_id`, `object_key`, `width`, `height`, `sort_order`).
- Serve via authenticated URLs or short-lived signed URLs. Tenant isolation stays the same as post rows.

### Highlights of articles / books

A highlight is a journal entry whose job is **keep the passage and the pointer**.

Minimum useful source:

- `title` (book or article)
- optional `author`, `url`, `locator` (page, chapter, or "12:04 in the essay")

That is enough to reopen the book or the tab. Do not model a bibliographic database, import Kindle/Readwise, or OCR as v1. A photo of the page *is* a valid highlight even if `body` is empty at first (you can type the quote later).

Existing **lists** are the right collection primitive ("Murakami", "New Yorker", "work reading"). Do not add a `books` table until lists plus `source.title` feel insufficient.

### Language learning

Language learning is a **lens on the same entries**, not a study app.

v1 job: **capture in the moment** (sentence on a page, phrase on a sign, line in an article).

- `language` + `gloss` on the entry.
- Timeline filter / tab: "Japanese", "French", or "has language".
- Review later (SRS, quizzes, cloze) is explicitly **out**. If review is added, it should read from these entries, not invent a parallel card deck.

This keeps Techoo from competing with Anki while still being the place sentences *enter* your life.

### Todos are optional

- **Keep** `todos`, calendar sync, and post↔todo links. Data and the later-todos / week grid stay valid.
- **Demote** from primary navigation. Mobile home and desktop default become the journal feed (today's Timeline, visual). Todos move under Library / Settings-adjacent, or a secondary tab.
- **Composer:** do not require or auto-suggest todo association. `#` mentions can remain as power-user linking.
- **Empty day:** a journal with zero todos is a complete product state, not an onboarding gap.

Do not drop the todos schema in this reconsideration. Revisit deletion only if months of journal-first use show the calendar layer unused.

### Notes

Notes stay the **long page**: drafts, reference, writing that is not a dated card. Highlights and language scraps should *not* go to notes by default — they want a timestamp and a feed. Notes are where a highlight *grows* if it becomes an essay.

### Surfaces (target)

| Surface | Role after this shift |
|---|---|
| **Home / Journal** | Visual chronological feed. Primary tab. |
| **Composer** | Photo / highlight / language / free presets. Share-in lands here. |
| **Lists & favorites** | Collections (books, languages, themes). Already built. |
| **Library** | Todos, calendar, notes — available, not the front door. |
| **Settings** | Auth, calendars, later: default language, storage. |

### Implementation slices (not this PR)

This PR is the product decision only. Suggested build order when we implement:

1. **Journal-first chrome** — swap default tab to Timeline/journal; hide todos from the primary tab bar; no schema change.
2. **Images on posts** — `post_images` + R2 + attach in mobile/desktop composers + visual feed cards.
3. **Highlight fields** — `source_*` columns (or a JSON `source` blob) + highlight composer preset + list-oriented "reading" empty states.
4. **Language fields** — `language`, `gloss` + filter tab.
5. **Share-in** — iOS/Android share extension creating a post from image or selected text.

Slice 1 is the cheapest test of the thesis. If the app feels right as a journal without photos, slices 2–5 are extensions. If it feels empty, images were the missing object, not more todo UX.

## Consequences

### What gets better

- The techo metaphor matches how the app is actually being used.
- A day without tasks is still worth opening.
- Photos, quotes, and language scraps share one inbox instead of leaking to Notes, camera roll, or other apps.
- Lists/favorites already paid for collections; highlights and languages reuse them.

### What we give up (for now)

- Planner-first identity in `CONCEPT.md` and the home screen. Calendar-centric users will take an extra tap to reach todos.
- A dedicated SRS / Readwise-class highlight manager. Capture quality first.
- Public sharing. "Instagram-ish" will be misunderstood if we are sloppy in copy; UI chrome must stay private and warm.

### Rejected alternatives

| Alternative | Why not |
|---|---|
| Delete todos now | Calendar + existing data still useful; demote first. |
| New `highlights` + `language_cards` tables | Three inboxes. Posts already have time, lists, favorites, threads. |
| Notes as the journal | Notes have no feed rhythm, no `posted_at` story, no visual card. |
| Full social Instagram | Conflicts with single-user / private techo. |
| Anki-in-Techoo | Different habit (review vs capture). Revisit only after capture works. |
| Second big-bang revamp | Auth, tenant DBs, posts, lists are fine. Evolve posts; do not replace the domain layer. |

### Docs

- `docs/CONCEPT.md` — product thesis (this reconsideration).
- Mobile README still points at CONCEPT; update its one-liner when chrome actually changes (slice 1).
