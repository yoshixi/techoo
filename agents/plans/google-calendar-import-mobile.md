# Google Calendar Import for Mobile

## Overview

Bring Google Calendar integration from the Electron app to the mobile app. Users can link multiple Google accounts, import calendars, toggle calendar visibility, and see events overlaid on the calendar timeline.

## Implementation

### Backend (Step 1)
- Added `GET /api/mobile-link` endpoint: mirrors `desktop-link` but uses deep link redirect via `redirect_uri` param
- Added `GET /api/mobile-link-callback` endpoint: reads cookie and redirects to `${redirect_uri}?linked=1`
- Added both paths to JWT middleware skip list

### Mobile API Client (Step 2)
- Regenerated OpenAPI schema and mobile API client via `api:generate`
- New endpoints available: calendars CRUD, events, Google OAuth status/accounts
- Fixed `CustomRequestConfig.params` type to accept `number[]`

### OAuth Module (Step 3)
- Added `linkGoogleAccount()` to `lib/oauth.ts`
- Uses `WebBrowser.openAuthSessionAsync` with `mobile-link` endpoint
- Passes `session_token` from SecureStore for auth

### Hooks (Steps 4-5)
- **`useCalendarSettings`**: Ported from Electron. Manages Google accounts, available/synced calendars, add/remove/toggle/sync operations
- **`useCalendarEvents`**: Ported from Electron. Fetches events for date range, manages visibility state via AsyncStorage

### Calendar UI (Steps 6-7)
- **`EventBlock`** component: Semi-transparent block with calendar color indicator, shows event title and time
- **`DayColumn`**: Added `events` and `calendarColorMap` props, renders EventBlocks alongside TaskBlocks
- **`CalendarView`**: Integrated `useCalendarEvents` hook, passes events/colors to DayColumn
- **`calendar-utils.ts`**: Added `EventLayout` type and `calculateEventLayoutsForDay()` function

### Settings UI (Step 8)
- **Google Accounts card**: Lists linked accounts, "Link Google Account" button
- **Calendars card**: Account selector, synced calendars with toggle/sync/delete, available calendars with "Add" button

### Type Fixes (Step 9)
- Fixed ID type mismatches exposed by API client regeneration (task/timer/tag IDs are `number` in schema)
- Updated component prop types: `taskId: string` → `number`, `selectedTagIds: string[]` → `number[]`
- Added route-level conversion: `Number(id)` at the string→number boundary

## Key Files

| File | Change |
|------|--------|
| `apps/backend/src/app/api/[[...route]]/route.ts` | Added mobile-link endpoints |
| `apps/mobile/lib/oauth.ts` | Added `linkGoogleAccount()` |
| `apps/mobile/hooks/useCalendarSettings.ts` | New hook |
| `apps/mobile/hooks/useCalendarEvents.ts` | New hook |
| `apps/mobile/components/calendar/EventBlock.tsx` | New component |
| `apps/mobile/components/calendar/CalendarView.tsx` | Events overlay |
| `apps/mobile/components/calendar/DayColumn.tsx` | Events + calendarColorMap props |
| `apps/mobile/lib/calendar-utils.ts` | Event layout functions |
| `apps/mobile/components/settings/SettingsContent.tsx` | Google Accounts + Calendars UI |
| `apps/mobile/lib/api/mutator.ts` | Params type fix |

## Dependencies Added
- `@react-native-async-storage/async-storage` - for persisting calendar visibility preferences
