**Date:** 2026-02-22
**Status:** Accepted
**Branch:** add-notes-feature

---

# Plan: Add Notes Feature

## Context

Users want a lightweight scratchpad to capture rough ideas that are too early to formalize as tasks. Notes are a first-class resource with CRUD operations and a "Convert to Task" action that promotes a note into the task system when the idea is ready.

## Design Decisions

- **No tags on notes** -- notes are intentionally lightweight. Tags can be assigned after conversion to a task.
- **`archivedAt` field** -- soft-delete semantics for converted notes so users don't lose context.
- **`note_task_conversions` table** -- tracks conversion history (which note became which task, and when). Internal-only, no UI needed for now.
- **Endpoint: `POST /notes/{id}/task_conversions`** -- atomically creates a task, records the conversion, and archives the note.
- **Plain text editing** -- simple textarea, no markdown/rich-text.
- **Sorted by `updatedAt` desc** -- most recently edited notes appear first.

## Implementation

### Backend

1. **Schema** (`apps/backend/src/app/db/schema/schema.ts`): Added `notesTable` and `noteTaskConversionsTable` with indexes.
2. **Core models** (`apps/backend/src/app/core/notes.core.ts`): Zod schemas with OpenAPI for Note, CreateNote, UpdateNote, NoteQueryParams (includeArchived), ConvertNoteToTaskResponse.
3. **DB layer** (`apps/backend/src/app/core/notes.db.ts`): CRUD functions + archiveNote + recordConversion. All scoped by userId.
4. **Routes** (`apps/backend/src/app/api/[[...route]]/routes/notes.ts`): 6 OpenAPI routes (list, get, create, update, delete, convert).
5. **Handlers** (`apps/backend/src/app/api/[[...route]]/handlers/notes.ts`): Handler implementations. Convert handler creates task, records conversion, archives note.
6. **Registration** (`route.ts`, `routes/index.ts`, `handlers/index.ts`): All routes registered.

### Electron Frontend

1. **Data hook** (`apps/electron/src/renderer/src/hooks/useNotesData.ts`): SWR-based with optimistic updates for all mutations.
2. **NotesView** (`apps/electron/src/renderer/src/components/NotesView.tsx`): Quick capture input + note cards with inline title/content editing, convert-to-task button, delete button.
3. **Sidebar** (`Sidebar.tsx`): Added 'notes' to View type, StickyNote icon, menu item between Tasks and Settings.
4. **App** (`App.tsx`): Added NotesView rendering branch.
5. **useTasksData** (`useTasksData.ts`): Updated View type to include 'notes'.
