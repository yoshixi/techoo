---
title: "Techo - Product Concept"
brief_description: "Techo is a private journal you carry: dated entries, photos, reading highlights, and language scraps. Todos are optional."
created_at: "2026-02-12"
update_at: "2026-09-20"
---

# Techo - Product Concept

## One-liner

Techo is a **private journal you carry**: you keep the day in dated entries — writing, photos, highlights from books and articles, language scraps you meet in the wild. Planning is optional; a day with no to-dos is still a complete day.

## Name and metaphor

**Techo** (手帳) is the everyday book you take with you. The name grows out of **Techoo** and the Japanese word for that kind of notebook. A paper techo is not primarily a task list. It is dated pages, clippings, quotes, and notes in the language you are living in. The app should feel like **writing and pasting into your techo**, not like opening a planner that also has a log.

## The Problem

Photos, passages, and sentences worth keeping scatter across the camera roll, browser highlights, and other apps — or they disappear. A task list does not hold them. A notes dump does not make them browsable as *days*. People who want a personal record of what they saw, read, and learned need one private place that is visual, dated, and light enough to use in the moment.

## Core Insight

If **the journal entry** is the center — a card that can be a photo, a quote, a sentence in another language, or free writing — then the day reads back without requiring a plan. Collections (lists, favorites) and optional calendar/to-dos sit around that, instead of the other way around.

## Who It's For

Individuals keeping a **personal** record: people who journal, save reading, and pick up languages in daily life. Not teams, not a study-system company, not a social network. Just you and the book.

## Core resources

Techo is built around **one kind of dated card**, with optional structure. Other resources stay, but they are not the front door.

### 1. Journal entries (posts) — “what I’m keeping from the day”

An entry is a dated card. It may be:

- a **moment** — photo and a short caption (Instagram-like *layout*, private)
- a **highlight** — a passage from an article or book, with enough source to find it again
- a **language scrap** — a sentence or phrase plus a gloss, tagged by language
- **free writing** — the day’s words with no extra fields

Entries can be starred and filed into named lists. They do not need a to-do or calendar event.

### 2. Lists and favorites — “what I want to find again”

Named collections (a book, a language, a theme) and a star. Same primitives as today’s post lists and favorites.

### 3. To-dos and calendar — optional “what I meant to do”

To-dos can still live on a calendar. They are **not required** to use Techo. External calendar events remain read-only context when you want them.

### 4. Notes — “the long page”

Notes are for writing that is not a dated card: drafts, reference, pages that grow. A highlight that becomes an essay can move here. Everyday capture should not.

## Design Principles

### 1. The day is still the unit of attention

Screens reinforce **today and the recent feed**, not multi-month roadmaps and not a social profile.

### 2. The journal is complete without a plan

Empty to-do lists are a normal state. Entry composers must not require a task, a time block, or a `#` mention.

### 3. Visual first when there is a picture

If an entry has an image, the image leads (full-bleed or near-full-bleed card, caption under). Text-only entries use large type, not a dense log row. The chrome stays warm and private — Instagram-ish **hierarchy**, not Instagram-the-product.

### 4. Capture in the moment, structure later

A photo of a page can land before the quote is typed. A sentence can land before the gloss. Share-into-the-app (camera roll, Safari, selected text) is part of the product, not a side feature.

### 5. Language learning is a lens, not a classroom

Save the sentence where you met it. Filter by language. Spaced repetition and quizzes are not the job of this app unless capture is already habitual.

### 6. Lightweight structure

Prefer a few optional fields (source, language, gloss, images) over new databases for books, decks, or projects. Richness comes from days and lists.

### 7. Posting is the easy thing

If keeping something takes a form, people will not keep it. Capture is **one intent and Post**. Caption, meaning, source, and extract are optional. Date, time, and to-dos are edit-later. If you are already in a list, the new card files there.

## How you post

Home `+` is a **capture sheet**, not a “New Post” form. Three jobs:

1. **Photo + a thought** — shutter, then an optional caption. The feed is the photo with the thought under it.
2. **Article that caught your eye** — Share from the browser, or paste a URL. Techoo is the pocket, not the reader. A quote is optional; the link is enough.
3. **A new phrase** — large phrase field, optional meaning. Language defaults to the last one you used. This is how vocabulary grows: record the phrase when you meet it.

A **page photo or screenshot** is the photo path plus extract: the clipping saves first, then you tap chips for the words you want. Those words become phrase cards, grouped with the page (same list, and threaded to the photo). You pick; the whole page is not dumped into vocabulary.

**Grouping** stays the current Timeline lists: All, Favorites, and names you create (“Vocabulary”, a book, a magazine). No second folder system.

## Primary surfaces (conceptual)

- **Journal / home** — Visual chronological feed. This is the front door. List chips stay.
- **Capture** — Photo, article, phrase. Share-in lands here.
- **Lists & favorites** — Collections you name — same idea as today’s Timeline tabs.
- **Library** — To-dos, calendar, notes: available, secondary.
- **Settings** — Account, calendars, later defaults (e.g. a preferred language).

Exact layouts may evolve; the **roles** stay: journal first, capture easy, planner optional.

## What Techo Is Not

- **Not a team tool.** Single-user: your techo, not a shared workspace.
- **Not a social network.** No followers, public profiles, or engagement counts. “Share” means share *into* your journal.
- **Not a required task manager.** To-dos exist; they are not the product.
- **Not Anki or Readwise.** No review engine and no bibliographic warehouse as the core loop.
- **Not a replacement for every specialist app.** Deep study, publishing, or photo libraries may still live elsewhere.

## Technical Context

- **Desktop app** (Electron) with a Hono API backend (Cloudflare Workers)
- **Mobile companion** (Expo, `apps/mobile`) — the journal feed should be the primary mobile habit
- **Multi-tenant data** with per-user databases; authentication and OAuth for services such as Google Calendar
- **Auto-generated API client** from OpenAPI spec keeps frontend and backend in sync
- **SWR** for data fetching with optimistic updates so the UI stays responsive
- Journal images (when added) belong in object storage, not as blobs in SQLite

## Lineage

Techo started as **Techoo** time-tracking (planned vs actual), then became a **daily planner** (calendar to-dos, posts as logs, notes). This concept is the next turn: **journal-first**. The planner layer is kept but demoted. The dated post is the object that grows — images, sources, language — instead of adding parallel apps inside the app.

Product decision record: [`agents/plans/2026-09-20-techoo-journal-reconsider.md`](../agents/plans/2026-09-20-techoo-journal-reconsider.md).

## Future Directions (Not Committed)

Possible extensions—used to test whether ideas still fit the techo metaphor.

- **Share-in from other apps** — article URL, selected text, or a screenshot becomes an entry in one step.
- **Extract words from a page photo** — OCR/assist, then tap-to-keep chips. Never a gate on saving the photo.
- **Language filter that feels like a section of the notebook** — not a flashcard deck.
- **Deeper “day review”** — a single evening read of the day’s cards (and, if you used them, the plan).
- **Richer linking** — entries that point at a book or a language without becoming a graph database.
