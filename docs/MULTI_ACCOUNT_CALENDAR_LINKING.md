---
title: "Multi-Account Google Calendar Linking"
brief_description: "This document describes how the app links and syncs Google calendars across multiple Google accounts."
created_at: "2026-02-19"
update_at: "2026-02-19"
---

# Multi-Account Google Calendar Linking

This document describes how the app links and syncs Google calendars across multiple Google accounts.

## Goals
- Allow a single Shuchu user to connect multiple Google accounts.
- Keep calendars and events scoped to the Google account that owns them.
- Avoid repeated calls to Google userinfo by storing the provider email at link time.

## User Flow (Electron UI)
1. **Account > Google Accounts > Link Google Account** starts a link flow.
2. The system browser completes Google OAuth.
3. The account is stored and appears in the list of linked accounts.
4. **Settings > Linked account** lets the user pick which Google account to use for calendar operations.
5. **Settings > Available calendars** shows calendars for the selected account.

## Backend Flow (Linking)
1. Electron opens `GET /api/desktop-link` in the system browser with the current session token.
2. The backend calls `POST /api/auth/link-social` to generate the OAuth URL and set the state cookie.
3. The browser completes Google OAuth and returns to `GET /api/auth/callback/google`.
4. better-auth links the account and inserts/updates a row in `accounts`.
5. `databaseHooks.account.create/update.after` fetches Google userinfo using the access token.
6. The account row is updated with `providerEmail`, and `users.image` is refreshed for profile display.

## Data Model
### Accounts (better-auth)
- `accounts.providerId = "google"`
- `accounts.accountId` = Google user ID (provider account ID)
- `accounts.providerEmail` = Google email captured at link time

### Calendars
- `calendars.providerAccountId` = Google account ID (matches `accounts.accountId`)
- `calendars.providerCalendarId` = Calendar ID from Google
- `calendars.providerType = "google"`

This keeps calendars/events tied to the account that owns them.

## API Endpoints
### Linking
- `GET /api/desktop-link?provider=google&port=<port>&session_token=<token>`
  - Opens in the system browser to ensure the OAuth state cookie is stored in the browser.
  - Redirects to Google OAuth and returns to the desktop callback.
- `POST /api/auth/link-social`
  - Called internally by the backend to generate the OAuth URL and state.

### Account Listing
- `GET /api/oauth/google/accounts`
  - Returns linked Google accounts for the current user.
  - Includes `email` when `providerEmail` is stored.

### Account Status
- `GET /api/oauth/google/status?accountId=<providerAccountId>`
  - Checks token validity for a specific linked account.

### Available Calendars (per account)
- `GET /api/calendars/available?accountId=<providerAccountId>`
  - Lists calendars for the selected Google account.

### Add Calendar (per account)
- `POST /api/calendars`
  - Payload requires:
    - `providerAccountId`
    - `providerCalendarId`
    - `name`

## UI Fallbacks
- If `providerEmail` is missing, the UI shows `Account N` and the last 6 chars of `accountId`.
- Email is stored at link time to avoid repeated calls to Google userinfo.

## Notes
- Account linking allows different Google emails for the same user.
- Unlinking from better-auth removes the account entry; calendar data is removed via
  `DELETE /api/oauth/google` (data only, not full unlink).
- Multi-account support is provider-agnostic in schema, but currently implemented for Google.
