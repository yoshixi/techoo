# Google Calendar Integration

This document describes the Google Calendar integration feature for the Shuchu application.

## Overview

The Google Calendar integration allows users to connect their Google Calendar account and import calendar events into Shuchu. This enables users to see their scheduled events alongside their tasks.

**Key Features:**
- OAuth 2.0 authentication with Google (via better-auth)
- Import calendars from Google Calendar
- Sync events from selected calendars
- Query events with date range filters
- Push notifications for real-time updates (webhooks)

**Design Decisions:**
- **OAuth Flow:** Handled by better-auth during Google sign-in (tokens stored in `accounts` table)
- **Import Strategy:** Full replace (clear existing events for a calendar on sync)
- **Provider Agnostic:** Schema designed to support future providers (Outlook, Apple Calendar)

Base URL: `/api`

## Authentication

Google Calendar access is granted when users sign in with Google through better-auth. The OAuth configuration requests calendar scopes (`calendar.readonly` and `calendar.events.readonly`) during the sign-in flow, so users don't need a separate authorization step to connect their calendars.

**How it works:**
1. User signs in with Google via better-auth (`/api/auth/callback/google`)
2. better-auth stores OAuth tokens (including calendar access) in the `accounts` table
3. Calendar API calls use the tokens from the `accounts` table
4. Tokens are automatically refreshed when expired

## Environment Variables

Required environment variables for Google OAuth:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

For push notifications (webhooks), you also need:

```bash
WEBHOOK_BASE_URL=https://your-public-domain.com
```

> **Note:** The webhook URL must be publicly accessible and use HTTPS. For local development, you can use a service like ngrok to expose your local server.

## Data Models

### Calendar

```typescript
{
  id: string;                // Integer ID (auto-increment)
  userId: string;            // Integer, references user
  providerType: string;      // 'google' | 'outlook' | 'apple'
  providerCalendarId: string; // Provider's calendar ID (e.g., 'primary')
  name: string;              // Display name
  color: string | null;      // Calendar color (hex)
  isEnabled: boolean;        // Whether sync is enabled
  lastSyncedAt: string | null; // ISO 8601 datetime
  createdAt: string;         // ISO 8601 datetime
  updatedAt: string;         // ISO 8601 datetime
}
```

**Example:**
```json
{
  "id": "1",
  "userId": "1",
  "providerType": "google",
  "providerCalendarId": "primary",
  "name": "Work Calendar",
  "color": "#4285f4",
  "isEnabled": true,
  "lastSyncedAt": "2024-01-15T10:00:00.000Z",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### CalendarEvent

```typescript
{
  id: string;              // Integer ID (auto-increment)
  calendarId: string;      // Integer, references calendar
  providerType: string;    // 'google' | 'outlook' | 'apple'
  providerEventId: string; // Provider's event ID
  title: string;           // Event title
  description: string | null; // Event description
  startAt: string;         // ISO 8601 datetime
  endAt: string;           // ISO 8601 datetime
  isAllDay: boolean;       // Whether all-day event
  location: string | null; // Event location
  createdAt: string;       // ISO 8601 datetime
  updatedAt: string;       // ISO 8601 datetime
}
```

**Example:**
```json
{
  "id": "1",
  "calendarId": "1",
  "providerType": "google",
  "providerEventId": "abc123xyz",
  "title": "Team Meeting",
  "description": "Weekly team sync",
  "startAt": "2024-01-15T10:00:00.000Z",
  "endAt": "2024-01-15T11:00:00.000Z",
  "isAllDay": false,
  "location": "Conference Room A",
  "createdAt": "2024-01-15T09:00:00.000Z",
  "updatedAt": "2024-01-15T09:00:00.000Z"
}
```

### AvailableCalendar

Returned when listing available calendars from Google.

```typescript
{
  providerCalendarId: string; // Provider's calendar ID
  name: string;               // Calendar display name
  color?: string;             // Calendar color
  isPrimary?: boolean;        // Whether primary calendar
  isAlreadyAdded: boolean;    // Whether already added to Shuchu
}
```

### WatchChannel

Watch channel for push notifications.

```typescript
{
  id: string;           // Integer ID (auto-increment)
  calendarId: string;   // Integer, references calendar
  channelId: string;    // UUID sent to Google for identifying the channel
  resourceId: string;   // Resource ID returned by Google
  providerType: string; // 'google' | 'outlook' | 'apple'
  expiresAt: number;    // Unix timestamp when channel expires
  token: string | null; // Optional verification token
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
}
```

## Endpoints

### OAuth Status

#### GET /auth/google/status

Check if user has a valid Google OAuth connection (via better-auth sign-in).

**Response:**
```json
{
  "connected": true,
  "providerType": "google",
  "expiresAt": "2024-01-15T11:00:00.000Z"
}
```

Or if not connected:
```json
{
  "connected": false
}
```

#### DELETE /auth/google

Disconnect Google Calendar data (removes calendars and events).

> **Note:** This removes calendar data but does not unlink the Google account from better-auth. To fully unlink, use better-auth's unlinkAccount method.

**Response:**
```json
{
  "success": true,
  "message": "Google Calendar data disconnected successfully"
}
```

### Calendar Management

#### GET /calendars/available

List available calendars from Google that can be added.

**Response:**
```json
{
  "calendars": [
    {
      "providerCalendarId": "primary",
      "name": "My Calendar",
      "color": "#4285f4",
      "isPrimary": true,
      "isAlreadyAdded": false
    }
  ]
}
```

#### GET /calendars

List all integrated calendars.

**Response:**
```json
{
  "calendars": [...],
  "total": 2
}
```

#### POST /calendars

Add a calendar to sync.

**Request Body:**
```json
{
  "providerCalendarId": "primary",
  "name": "My Work Calendar",  // Optional, defaults to provider name
  "isEnabled": true            // Optional, defaults to true
}
```

**Response:** Returns the created calendar object.

#### GET /calendars/{id}

Get a specific calendar by ID.

#### PATCH /calendars/{id}

Update a calendar.

**Request Body:**
```json
{
  "name": "Updated Name",  // Optional
  "isEnabled": false       // Optional
}
```

#### DELETE /calendars/{id}

Remove a calendar and all its synced events.

#### POST /calendars/{id}/sync

Sync a specific calendar (imports events for next 30 days).

**Response:**
```json
{
  "success": true,
  "message": "Synced 42 events",
  "eventsCount": 42
}
```

#### POST /calendars/sync

Sync all enabled calendars.

**Response:**
```json
{
  "success": true,
  "message": "Synced 156 events from 3 calendars",
  "eventsCount": 156
}
```

### Push Notifications (Webhooks)

Push notifications allow real-time updates when calendar events change, instead of requiring periodic polling.

#### POST /calendars/{id}/watch

Start watching a calendar for changes. Google will send push notifications to our webhook when events change.

**Response:**
```json
{
  "watchChannel": {
    "id": "1",
    "calendarId": "1",
    "channelId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "resourceId": "AbCdEfGhIjKl",
    "providerType": "google",
    "expiresAt": 1704672000,
    "token": "verification-token-123",
    "createdAt": 1704067200,
    "updatedAt": 1704067200
  }
}
```

> **Note:** Watch channels expire after 7 days (maximum allowed by Google). You should renew them before expiration.

#### GET /calendars/{id}/watch

Get the current watch status for a calendar.

**Response (active watch):**
```json
{
  "isWatching": true,
  "watchChannel": { ... },
  "expiresIn": 604800
}
```

**Response (no active watch):**
```json
{
  "isWatching": false,
  "watchChannel": null,
  "expiresIn": null
}
```

#### DELETE /calendars/{id}/watch

Stop watching a calendar for changes.

**Response:**
```json
{
  "success": true,
  "message": "Watch channel stopped successfully"
}
```

#### POST /webhooks/google-calendar

Webhook endpoint that receives push notifications from Google. This is called automatically by Google when calendar events change.

> **Note:** This endpoint is exempt from JWT authentication since Google's servers call it directly without auth tokens.

**Request Headers (from Google):**
| Header | Description |
|--------|-------------|
| X-Goog-Channel-ID | Channel ID that identifies the watch channel |
| X-Goog-Resource-ID | Resource ID of the watched calendar |
| X-Goog-Resource-State | State of the resource (`sync` or `exists`) |
| X-Goog-Channel-Token | Verification token (if set) |

**Response:** Returns empty JSON `{}` with status 200.

When a notification is received, the system automatically:
1. Validates the channel and token
2. Fetches the latest events from Google Calendar
3. Updates the local database with the new events

### Event Queries

#### GET /events

List events with optional filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| calendarId | string | No | Filter by calendar ID |
| startDate | string | No | Filter events from this date (ISO 8601) |
| endDate | string | No | Filter events until this date (ISO 8601) |

**Examples:**
- `/events` - Get all events
- `/events?calendarId=1` - Get events for specific calendar
- `/events?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z` - Date range

**Response:**
```json
{
  "events": [...],
  "total": 15
}
```

#### GET /events/{id}

Get a specific event by ID.

## Database Schema

### accounts (better-auth)

OAuth tokens are stored in the `accounts` table managed by better-auth.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | PRIMARY KEY (auto-increment) |
| user_id | integer | FOREIGN KEY -> users |
| provider_id | text | Provider name ('google') |
| account_id | text | Provider's user ID |
| access_token | text | OAuth access token |
| refresh_token | text | OAuth refresh token |
| access_token_expires_at | integer | Unix timestamp |
| scope | text | Granted scopes |

### calendars

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY (auto-increment) |
| user_id | integer | NOT NULL, FOREIGN KEY -> users |
| provider_type | text | NOT NULL |
| provider_calendar_id | text | NOT NULL |
| name | text | NOT NULL |
| color | text | NULLABLE |
| is_enabled | integer | NOT NULL, DEFAULT 1 |
| last_synced_at | integer | NULLABLE |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

**Unique constraint:** (user_id, provider_type, provider_calendar_id)

### calendar_events

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY (auto-increment) |
| calendar_id | integer | NOT NULL, FOREIGN KEY -> calendars (CASCADE) |
| provider_type | text | NOT NULL |
| provider_event_id | text | NOT NULL |
| title | text | NOT NULL |
| description | text | NULLABLE |
| start_at | integer | NOT NULL (Unix timestamp) |
| end_at | integer | NOT NULL (Unix timestamp) |
| is_all_day | integer | NOT NULL, DEFAULT 0 |
| location | text | NULLABLE |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

**Unique constraint:** (calendar_id, provider_event_id)

### calendar_watch_channels

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY (auto-increment) |
| calendar_id | integer | NOT NULL, FOREIGN KEY -> calendars (CASCADE) |
| channel_id | text | NOT NULL |
| resource_id | text | NOT NULL |
| provider_type | text | NOT NULL |
| expires_at | integer | NOT NULL (Unix timestamp) |
| token | text | NULLABLE |
| created_at | integer | NOT NULL |
| updated_at | integer | NOT NULL |

**Unique constraint:** (calendar_id, provider_type)

## Architecture

### File Structure

```
apps/web/app/
├── api/[[...route]]/
│   ├── handlers/
│   │   ├── google-auth.ts   # OAuth status handlers
│   │   ├── calendars.ts     # Calendar CRUD + watch handlers
│   │   ├── events.ts        # Event query handlers
│   │   └── webhooks.ts      # Webhook handlers
│   └── routes/
│       ├── google-auth.ts   # OAuth status route definitions
│       ├── calendars.ts     # Calendar + watch route definitions
│       ├── events.ts        # Event route definitions
│       └── webhooks.ts      # Webhook route definitions
├── core/
│   ├── auth.ts              # better-auth configuration (includes calendar scopes)
│   ├── oauth.core.ts        # OAuth Zod schemas
│   ├── oauth.db.ts          # OAuth token access (reads from accounts table)
│   ├── calendars.core.ts    # Calendar Zod schemas
│   ├── calendars.db.ts      # Calendar CRUD
│   ├── events.core.ts       # Event Zod schemas
│   ├── events.db.ts         # Event CRUD
│   ├── watch-channels.db.ts # Watch channel CRUD
│   └── calendar-providers/
│       ├── types.ts         # Provider interface
│       └── google.service.ts # Google API client
└── db/schema/
    └── schema.ts            # Database schema
```

### Sync Strategy

The sync uses a **full replace** strategy:
1. Fetch all events from Google Calendar for the date range
2. Delete all existing events for that calendar in the database
3. Insert all fetched events

This approach is simple and ensures consistency, though it may be less efficient for large calendars with frequent syncs.

### Token Refresh

Access tokens are automatically refreshed when:
- Token expires within 5 minutes of API call
- Refreshed tokens are stored back to the `accounts` table

## How Calendar Sync Works

This section explains the complete flow from connecting a Google account to keeping calendar events updated.

### Step 1: Connect Google Account (One-time)

```
User clicks "Sign in with Google"
         ↓
better-auth redirects to Google OAuth
         ↓
User grants permissions (including calendar.readonly scope)
         ↓
Google redirects back to /api/auth/callback/google
         ↓
better-auth stores tokens in `accounts` table
         ↓
User is now authenticated AND has calendar access
```

### Step 2: Add Calendars to Sync

```
GET /calendars/available
         ↓
Fetches list of calendars from Google Calendar API
(using tokens from accounts table)
         ↓
User selects which calendars to sync
         ↓
POST /calendars { providerCalendarId: "primary" }
         ↓
Calendar record created in `calendars` table
```

### Step 3: Initial Sync (Manual)

```
POST /calendars/{id}/sync
         ↓
Fetch events from Google (next 30 days)
         ↓
Delete existing events for this calendar
         ↓
Insert all fetched events into `calendar_events` table
         ↓
Update lastSyncedAt timestamp
```

### Step 4: Enable Real-time Updates (Push Notifications)

```
POST /calendars/{id}/watch
         ↓
Create watch channel with Google Calendar API
(sends our webhook URL to Google)
         ↓
Google returns channelId + resourceId
         ↓
Store in `calendar_watch_channels` table
         ↓
Google will now notify us of changes
```

### Step 5: Receiving Updates (Automatic)

```
User creates/updates/deletes event in Google Calendar
         ↓
Google sends POST to /api/webhooks/google-calendar
(with X-Goog-Channel-ID, X-Goog-Resource-State headers)
         ↓
Webhook handler validates channel
         ↓
Fetches latest events from Google
         ↓
Updates local database (full replace)
         ↓
Returns 200 OK to Google
```

### Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         SETUP PHASE                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Sign in with Google → tokens stored in accounts table       │
│  2. GET /calendars/available → see available calendars          │
│  3. POST /calendars → add calendar to sync                      │
│  4. POST /calendars/{id}/sync → initial event import            │
│  5. POST /calendars/{id}/watch → enable push notifications      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      ONGOING SYNC                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Google Calendar ←──────────────────────→ Shuchu Backend        │
│       │                                        │                 │
│       │  (User modifies event)                 │                 │
│       │                                        │                 │
│       └──── Push notification ────────────────→│                 │
│             POST /webhooks/google-calendar     │                 │
│                                                │                 │
│       ←──── Fetch latest events ──────────────┘                 │
│             (Google Calendar API)                                │
│                                                │                 │
│                                     Update calendar_events       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Important Notes

- **Watch channels expire after 7 days** - Need to renew them periodically (see Future Considerations)
- **Webhook must be HTTPS** - Google requires a secure, publicly accessible endpoint
- **Tokens refresh automatically** - When access token expires, we use the refresh token
- **Full replace strategy** - On each sync, we delete and re-import all events (simple but not incremental)

## Future Considerations

- **Incremental Sync:** Use Google Calendar's sync tokens for delta updates
- **Multiple Providers:** Add Outlook and Apple Calendar support
- **Watch Channel Renewal:** Automatically renew watch channels before expiration
- **Background Sync:** Periodic automatic sync via cron/scheduler as fallback
