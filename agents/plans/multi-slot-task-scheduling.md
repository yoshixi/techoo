# Multi-Slot Task Scheduling

## Problem

Currently each todo has a single `startsAt` / `endsAt` pair. If you want to work on the same task across multiple time blocks in a day — e.g. Task A from 10:00–11:00, then again 11:30–12:30 after a meeting — you have to create two separate, unlinked todos. This means:

- Completion state is not shared (marking one done doesn't affect the other)
- Time tracking is split across duplicates
- The Review view shows the same task twice

## Goal

Let a single task appear on the calendar as multiple independent time blocks, while remaining one logical entity.

---

## Data Model: `todo_slots` table

Add a new table that holds time windows. A todo becomes the "what"; slots are the "when".

```
todosTable                 todo_slotsTable
──────────────────         ──────────────────────────
id (PK)                    id (PK)
userId                     todoId → todos.id (FK)
title                      startsAt (unix int)
description                endsAt   (unix int)
done
doneAt
createdAt
```

- `todosTable.startsAt` and `todosTable.endsAt` are kept temporarily for backward compatibility, then deprecated once all clients migrate.
- Each slot can also link to a `taskTimers` entry for per-session time tracking.
- Deleting a todo cascades to all its slots.

---

## UX Design

### Guiding principle

> The creation path adds **one optional step** for the new capability. The common case (new task, single slot) stays identical to today.

---

### 1. Calendar drag-to-create — unchanged for new tasks

```
┌─────────────────────────────────────────────────────────────┐
│  MON 16                                                      │
│  ────────────────────────────────────────────               │
│  10:00 │                                                     │
│        │  [drag here]                                        │
│  11:00 │  ░░░░░░░░░░░░░░░░░░░░░░░░ ← selection highlight    │
│        │                                                     │
│  12:00 │                                                     │
└─────────────────────────────────────────────────────────────┘

     → dialog opens with time pre-filled
```

---

### 2. Creation dialog — "search or create" input

The title input now shows matching existing tasks as you type. The dropdown is **optional** — ignoring it and pressing Enter creates a new task exactly as before.

```
┌──────────────────────────────────────────┐
│  New ToDo                                │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Task A▌                            │  │  ← same input as today
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Task A          today · 1 slot    │  │  ← existing match
│  │  Task AB         tomorrow          │  │
│  │  ─────────────────────────────     │  │
│  │  + Create "Task A"                 │  │  ← always at bottom
│  └────────────────────────────────────┘  │
│                                          │
│  Add schedule  ────────────── [●]        │
│  From  [10:00]   To  [11:00]             │
│                                          │
│              [Cancel]  [Create]          │
└──────────────────────────────────────────┘
```

| Action | Result |
|--------|--------|
| Type name → ignore dropdown → Enter | Creates new task + slot (today's behavior) |
| Type name → select existing task → Enter | Adds a new slot to the existing task |

---

### 3. Calendar rendering — multiple slots for the same task

Each slot renders as its own block. A `×N` badge appears when more than one slot exists for that task.

```
┌─────────────────────────────────────────────────────────────┐
│  MON 16                                                      │
│  ──────────────────────────────────────────────────         │
│  10:00 │ ┌──────────────────────────────────────┐           │
│        │ │  Task A  ×2                    [done] │  ← slot 1│
│  11:00 │ └──────────────────────────────────────┘           │
│        │                                                     │
│  11:00 │ ┌──────────────────────────────┐                   │
│        │ │  Meeting                     │  ← different task │
│  11:30 │ └──────────────────────────────┘                   │
│        │                                                     │
│  11:30 │ ┌──────────────────────────────────────┐           │
│        │ │  Task A  ×2                    [done] │  ← slot 2│
│  12:30 │ └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

- Completing the task from **either** slot marks it done everywhere.
- Both blocks share the same color.
- Clicking either slot opens the same task detail panel.

---

### 4. "Add another slot" from an existing block

Right-click an existing calendar block to add a new slot without opening the creation dialog.

```
┌──────────────────────────────────────────┐
│  Task A  ×2                       [done] │
└──────────────────────────────────────────┘
          │ (right-click)
          ▼
┌──────────────────────┐
│  ✎  Edit             │
│  ＋  Add slot         │  ← drag a new range on the calendar
│  ✕  Delete slot      │
│  ⊗  Delete task      │
└──────────────────────┘
```

Selecting **Add slot** dismisses the menu and puts the calendar into "slot-drop mode": the next drag on the calendar creates a new slot pre-linked to this task.

---

### 5. Task list views (Upcoming / Review)

Tasks appear **once** in list views regardless of slot count. Slot metadata is shown inline.

```
┌──────────────────────────────────────────────────────────┐
│  Upcoming — Mon 16 May                                    │
│  ─────────────────────────────────────────────────       │
│  ○  Task A                                               │
│     10:00–11:00  ·  11:30–12:30  (2 slots, 1.5 h total) │
│                                                          │
│  ○  Meeting                                              │
│     11:00–11:30                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Scope

### Backend
1. Add `todo_slots` table to `schema.ts`
2. Push schema to seed DB and all tenant DBs
3. New API endpoints: `POST /todos/:id/slots`, `PATCH /todos/:id/slots/:slotId`, `DELETE /todos/:id/slots/:slotId`
4. Update `GET /todos` response to include `slots[]` array

### Frontend (Electron renderer)
1. Regenerate API client after schema/route changes
2. Update `CalendarView` — render one block per slot, add `×N` badge
3. Update creation dialog — add search-as-you-type with existing task dropdown
4. Add right-click context menu on calendar blocks
5. Update `Upcoming` / `Review` list views to deduplicate by task and show slot metadata

### Migration
- Existing todos with `startsAt`/`endsAt` get a single slot auto-created on migration
- `startsAt`/`endsAt` on `todosTable` can be removed in a follow-up once the client is fully migrated

---

## Open Questions

- **Timer tracking**: should `taskTimers` attach to a slot or to the parent task? (Per-slot seems more useful for Review.)
- **Completion granularity**: should individual slots be completable independently, or only the parent task? (Parent-only is simpler and avoids confusion.)
- **Slot reordering**: is drag-to-reorder slots within the task detail panel needed at launch?
