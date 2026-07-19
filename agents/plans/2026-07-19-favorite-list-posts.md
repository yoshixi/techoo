# ADR: Favorites and User Lists for Posts

**Date:** 2026-07-19
**Status:** Accepted
**Branch:** `favorite-list-posts`

---

## Context

Posts in Techoo are currently only organized by time (paginated feed, time-range queries). Users have no way to bookmark interesting posts or group them into named collections. As the post history grows, navigating back to specific posts becomes harder.

Two complementary organizational features were requested:
1. **Favorites** — a quick star toggle so users can mark notable posts
2. **User Lists** — named collections to organize posts thematically (e.g. "Project Alpha", "Weekly wins")

Key constraints surfaced during design:
- Both features must be per-user (no sharing)
- A post can belong to multiple lists simultaneously
- Favorites and lists are independent (no "favorites = a special list") to keep the data model and UI simpler
- The existing `GET /v1/posts` endpoint should absorb the new filters rather than adding separate feed endpoints, keeping the API surface flat

---

## Decision

### Database

Three new tables added to `apps/backend/src/app/db/schema/schema.ts`:

| Table | Columns | Notes |
|---|---|---|
| `post_favorites` | `userId`, `postId`, `createdAt` | composite unique(userId, postId) |
| `post_lists` | `id`, `userId`, `name`, `createdAt` | auto-increment PK |
| `post_list_items` | `listId`, `postId`, `addedAt` | composite unique(listId, postId); cascades on list or post delete |

### API

**Extended `GET /v1/posts`** with two new optional query params:
- `?favorite=true` — filters to posts the authenticated user has starred
- `?listIds=1,2,3` — filters to posts in any of the given lists (OR/union)
- Both params compose freely with existing `from`/`to` and `limit`/`offset` params

**New `PostModel` fields** — every post response now includes:
- `is_favorited: boolean`
- `list_ids: number[]`

These are batch-loaded alongside the existing events/todos relations, so no extra round-trips.

**New endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/posts/{id}/favorite` | Star a post |
| `DELETE` | `/v1/posts/{id}/favorite` | Unstar a post (idempotent) |
| `GET` | `/v1/post-lists` | All lists for the user |
| `POST` | `/v1/post-lists` | Create a list |
| `DELETE` | `/v1/post-lists/{id}` | Delete a list (cascades items) |
| `POST` | `/v1/post-lists/{id}/items` | Add a post to a list (idempotent) |
| `DELETE` | `/v1/post-lists/{id}/items/{postId}` | Remove a post from a list |

### New files

- `apps/backend/src/app/core/post-lists.core.ts` — Zod models
- `apps/backend/src/app/core/post-lists.db.ts` — DB access layer
- `apps/backend/src/app/api/[[...route]]/routes/post-lists.ts` — OpenAPI route definitions
- `apps/backend/src/app/api/[[...route]]/handlers/post-lists.ts` — handlers

### Frontend (planned)

Both mobile (React Native) and Electron (desktop) to be implemented simultaneously:

**PostRow changes:**
- Star icon for favorite toggle with optimistic update
- "Add to list" action (action sheet on mobile, context menu on desktop)

**New hooks:** `usePostFavorite`, `usePostLists`, `usePostListDetail`

**New screens/views:**
- Favorites feed (uses `?favorite=true`)
- Lists index
- List detail (uses `?listIds={id}`)

---

## Consequences

**Positive:**
- Post model is richer without breaking existing consumers — `is_favorited` and `list_ids` default to `false`/`[]`
- Single `GET /v1/posts` entry point keeps client code consistent; filters compose naturally
- Cascade deletes mean no orphan cleanup logic is needed

**Negative / trade-offs:**
- `?listIds=1,2,3` uses comma-separated string parsing rather than repeated params (`&listIds=1&listIds=2`) — simpler for clients but slightly non-standard for OpenAPI array params
- `is_favorited` and `list_ids` are always included in every post response, even when not needed — slight over-fetching accepted for simplicity

**Rejected alternatives:**
- "Favorites as a special system list" — rejected because it adds list-management complexity to a simple toggle and makes the data model harder to reason about
- Separate `/v1/posts/favorites` endpoint — rejected in favor of a query param to keep a single canonical list endpoint
