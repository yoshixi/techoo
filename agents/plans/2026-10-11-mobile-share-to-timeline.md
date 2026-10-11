# ADR: Share text into the mobile timeline

**Date:** 2026-10-11
**Status:** Accepted
**Branch:** `cursor/mobile-share-to-timeline-2aff`

---

## Context

People already share text and links from other apps through the system share sheet. Techoo’s timeline is the log of the day, so that share should be able to land there: Techoo shows up as a destination on iPhone and Android, the shared text becomes a post, and the user can optionally file that post into one of their lists.

Constraints:

- The mobile app is Expo SDK 54 (managed workflow, no committed `ios/` or `android/` trees). Share targets need native code, so Expo Go cannot host them.
- Posts already exist (`POST /api/v1/posts`) and lists are an association applied after create (`POST /api/v1/post-lists/:id/posts`). No new backend resource is required for text.
- A share should stay optional about lists. The timeline is the default home; a list is extra filing.

## Decision

Use `expo-share-intent` 5.x (the release line for Expo SDK 54). The config plugin registers:

- iOS share extension for text, web URLs, and web pages. The extension target stays `ShareExtension`. A follow-up config plugin sets the share-sheet label to `techoo`.
- Android `text/*` send intent on `app.techoo`, with `singleTask` so a second share reaches the already-open app.

`xcode@3.0.1` is patched (null-check in `correctForPath`) so the iOS prebuild can add the extension’s resource group. That patch is the one the library documents for SDK 54.

When a share arrives, routing opens `app/shareintent.tsx`:

1. The shared text (and a page title / URL when the payload has them) fills an editable composer.
2. The user may leave the post on the timeline only, pick one existing list, or create a list and select it.
3. Posting calls the existing `createPostWithAssociations` helper, then opens the timeline (the chosen list’s tab when one was selected).
4. If the user is signed out, the composer keeps the payload and asks them to sign in. After auth they return to the same screen.

`resetOnBackground` is off so choosing a list or signing in does not drop the payload. Cancel, post, and system back dismiss the session so the composer does not reopen on its own.

Photos and other file-only shares are declined in the composer. The timeline stores text; there is no media upload on posts.

## Consequences

- A new native build is required before the share target appears (EAS or `expo prebuild` + `expo run`).
- iOS needs the `xcode` patch at install time. Removing it brings back the prebuild crash when the extension target is added.
- File and image shares are out of scope until posts can store media.
- The share extension does not render its own UI. iOS hands the payload to the main app, which is the same path Android uses.
