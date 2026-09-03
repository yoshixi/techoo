**Date:** 2026-09-03
**Status:** Accepted
**Branch:** cursor/wysiwyg-markdown-editor-ea27

---

# Plan: WYSIWYG Markdown for posts and todo comments

## Context

Timeline posts, thread replies, and todo comments (todo descriptions plus the todo-linked thread) are plain textareas. Users want Markdown **and** a WYSIWYG editing experience so formatting is visible while writing, not only after learning syntax.

Constraints:

- `posts.body` and `todos.description` are already unbounded text columns. No schema migration.
- Existing plain-text rows must keep rendering correctly (plain text is valid Markdown).
- Electron `#` association suggestions and Cmd/Ctrl+Enter submit must keep working.
- Mobile is React Native, so a DOM editor (Tiptap) cannot be reused there.

## Decision

- **Storage:** Keep Markdown source in the existing string fields. Treat historical plain text as Markdown.
- **Desktop (Electron):** Tiptap 3 WYSIWYG editor with official `@tiptap/markdown` serialization. A compact toolbar (bold, italic, strike, heading, lists, quote, code, code block, link, task list). Formatting shortcuts follow Slack: `⌘/Ctrl+B` bold, `⌘/Ctrl+I` italic, `⌘/Ctrl+Shift+X` strike, `⌘/Ctrl+Shift+C` inline code, `⌘/Ctrl+Opt/Alt+Shift+C` code block, `⌘/Ctrl+Shift+U` link, `⌘/Ctrl+Shift+8/7` lists, `⌘/Ctrl+Shift+9` quote, `⌘/Ctrl+Shift+0` checklist, `⌘/Ctrl+Opt/Alt+2` heading. Read views use `react-markdown` + `remark-gfm`.
- **Mobile:** Render Markdown with `react-native-markdown-display`. Compose/edit keep a text field (needed for `#` token / selection) plus a format toolbar that inserts Markdown, with an optional live preview.
- **Backend:** Document that `body` / `description` are Markdown. No API shape change, no client regen required.
- **Out of scope:** Notes stay a plain textarea (already labeled Markdown in the API, but not requested here). No image upload.

## Consequences

- Desktop gets true WYSIWYG; mobile is Markdown-aware with toolbar + preview rather than a WebView editor.
- Serialization whitespace from Tiptap may differ slightly from hand-typed Markdown; that is acceptable as long as the rendered result matches.
- Rejected: storing HTML (harder to share with mobile and existing text). Rejected: Tentap/WebView on React Native for this pass (keyboard and styling risk).
