---
title: "Timer API Specification"
brief_description: "This document describes the Timer API endpoints for the Techoo application."
created_at: "2026-01-16"
update_at: "2026-02-08"
---

# Timer API Specification

This document describes the Timer API endpoints for the Techoo application.

## Overview

The Timer API allows tracking time spent on tasks. Timers have a start time and an optional end time. A timer with no end time is considered "active" (running).

Base URL: `/api`

## Data Models

### TaskTimer

```typescript
{
  id: number;        // SQLite integer ID
  taskId: number;    // SQLite integer ID, references task
  startTime: string; // ISO 8601 datetime
  endTime: string | null; // ISO 8601 datetime, null for active timers
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}
```

**Example:**
```json
{
  "id": 1,
  "taskId": 42,
  "startTime": "2024-01-01T10:00:00.000Z",
  "endTime": "2024-01-01T10:30:00.000Z",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-01T10:30:00.000Z"
}
```

## Endpoints

### GET /timers

List all timers, optionally filtered by task IDs.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| taskIds | number[] | No | Filter timers by task IDs. Can be comma-separated or multiple params. |

**Examples:**
- `/timers` - Get all timers
- `/timers?taskIds=id1,id2` - Filter by multiple task IDs (comma-separated)
- `/timers?taskIds=id1&taskIds=id2` - Filter by multiple task IDs (multiple params)

**Response (200):**
```json
{
  "timers": [TaskTimer],
  "total": number
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

### POST /timers

Create a new timer for a task.

**Request Body:**
```json
{
  "taskId": 42,
  "startTime": "2024-01-01T10:00:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| taskId | number | Yes | ID of the task to track time for |
| startTime | string | Yes | ISO 8601 datetime when the timer started |

**Response (201):**
```json
{
  "timer": TaskTimer
}
```

**Status Codes:**
- `201` - Timer created
- `400` - Invalid request data
- `404` - Task not found
- `500` - Server error

---

### GET /tasks/{taskId}/timers

Get all timers for a specific task.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| taskId | number | ID of the task |

**Response (200):**
```json
{
  "timers": [TaskTimer],
  "total": number
}
```

**Status Codes:**
- `200` - Success
- `404` - Task not found
- `500` - Server error

---

### GET /timers/{id}

Get a specific timer by ID.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | ID of the timer |

**Response (200):**
```json
{
  "timer": TaskTimer
}
```

**Status Codes:**
- `200` - Success
- `404` - Timer not found
- `500` - Server error

---

### PUT /timers/{id}

Update an existing timer.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | ID of the timer |

**Request Body:**
```json
{
  "startTime": "2024-01-01T10:00:00.000Z",
  "endTime": "2024-01-01T10:30:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| startTime | string | No | ISO 8601 datetime when timer started. |
| endTime | string \| null | No | ISO 8601 datetime when timer stopped. Set to `null` to resume. |

**Response (200):**
```json
{
  "timer": TaskTimer
}
```

**Status Codes:**
- `200` - Timer updated
- `404` - Timer not found
- `500` - Server error

---

### DELETE /timers/{id}

Delete a timer.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | number | ID of the timer |

**Response (200):**
```json
{
  "timer": TaskTimer
}
```

**Status Codes:**
- `200` - Timer deleted
- `404` - Timer not found
- `500` - Server error

## Database Schema

The `task_timers` table stores timer data:

```sql
CREATE TABLE task_timers (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  task_id INTEGER NOT NULL,      -- Foreign key to tasks.id (cascade delete)
  start_time INTEGER NOT NULL,   -- Unix timestamp (seconds)
  end_time INTEGER,              -- Unix timestamp (seconds), NULL for active
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX task_timers_task_id_idx ON task_timers(task_id);
```

**Notes:**
- Timestamps are stored as Unix seconds in the database
- API converts to/from ISO 8601 strings
- Cascade delete: timers are deleted when their parent task is deleted

## Business Logic

### Active Timers

A timer is considered "active" (running) when `endTime` is `null`.

### Stopping Timers

The internal function `stopActiveTimersForTask(taskId)` stops all active timers for a task by setting their `endTime` to the current timestamp. This is used when:
- A task is completed

### Timestamp Handling

- **API → Database:** ISO 8601 strings are parsed into `Date` objects
- **Database → API:** `Date` objects are formatted as ISO 8601

```typescript
// Database to API
formatTimestamp(timestamp: Date): string {
  return timestamp.toISOString()
}

// API to Database
parseISOToDate(isoString: string): Date {
  return new Date(isoString)
}
```

## OpenAPI Documentation

The API is self-documented via OpenAPI. Access the interactive documentation at:
- `/api/doc` - Swagger UI

## Related Files

- Routes: `apps/backend/src/app/api/[[...route]]/routes/timers.ts`
- Handlers: `apps/backend/src/app/api/[[...route]]/handlers/timers.ts`
- Database logic: `apps/backend/src/app/core/timers.db.ts`
- Schema: `apps/backend/src/app/db/schema/schema.ts`
