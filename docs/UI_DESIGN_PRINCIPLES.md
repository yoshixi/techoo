---
title: "UI Design Principles"
brief_description: "Current desktop UI theme and implementation guidance for Techoo."
created_at: "2026-01-17"
update_at: "2026-05-09"
---

# UI Design Principles

This document is the single source of truth for the current desktop UI theme.

Scope: `apps/electron/src/renderer/src`

## Core Identity

- Flat and soft: avoid heavy depth, hard outlines, and high-contrast blocks.
- Border-light and mostly shadowless: hierarchy should come from spacing and subtle surface contrast.
- Warm and calm: warm neutrals plus amber accents over sharp/high-saturation palettes.
- Quiet productivity: reduce visual noise and keep workflows direct.
- Light-only: current desktop theme is optimized for light mode.

## Source of truth

- Design tokens and semantic colors:
  - `apps/electron/src/renderer/src/assets/main.css`
- App shell and tab styling:
  - `apps/electron/src/renderer/src/App.tsx`
- Primary desktop surfaces:
  - `apps/electron/src/renderer/src/components/TodoTabView.tsx`
  - `apps/electron/src/renderer/src/components/TodoView.tsx`
  - `apps/electron/src/renderer/src/components/TimelineView.tsx`
  - `apps/electron/src/renderer/src/components/CalendarView.tsx`

## Color System (Current Desktop)

Use CSS variables from `main.css`. Prefer tokens over hardcoded hex values.

- Base surfaces:
  - `--background`, `--card`, `--panel`
- Text hierarchy:
  - `--foreground`, `--text-dark`, `--text-mid`, `--text-muted-custom`, `--text-hint`
- Borders and input boundaries:
  - `--border`, `--input`, `--border-l`
- Accent system:
  - `--primary` and `--amber` are aligned to the same amber family
  - Primary action buttons should use the unified amber style
- Semantic states:
  - `--success`, `--warning`, `--destructive`

### Practical color rules

- Prefer `color-mix(...)` with tokens for nuanced tone changes.
- Do not add one-off accent colors when an existing token fits.
- Keep destructive color usage scoped to destructive actions/errors.

## Typography

- Body font is `DM Sans` (see base `body` style in `main.css`).
- Default heading style for current desktop surfaces:
  - `font-sans`
  - `font-semibold`
  - `tracking-tight`
- `.font-title` (Playfair Display) remains for legacy screens only; avoid using it in new/updated desktop surfaces.

## Shape, Spacing, and Structure

- Base radius token: `--radius: 1rem`.
- Common shape patterns:
  - pills (`rounded-full`) for tabs/toggles/compact actions
  - soft cards (`rounded-2xl`) for panes and grouped content
- Spacing should be compact but breathable.
- Remove redundant labels where placeholders/grouping already communicate intent.

## No Shadows

- Keep shadows minimal to none on standard surfaces.
- Prefer borders and surface contrast for hierarchy.
- Elevation should mainly come from background tone differences.

## Component Patterns

### App shell

- Use soft two-layer chrome:
  - top bar with subtle panel tint
  - tab row with low-contrast active pill
- Brand/title should be visually calm (not max-contrast emphasis).

### Todo surfaces

- Keep split workspace model: calendar left, todo list right.
- Keep create/edit flows direct and low-friction.
- Dialogs should feel lightweight: soft fills, minimal hard framing.
- For edit dialogs:
  - favor autosave plus subtle status feedback
  - hide redundant visible headers when context is obvious
  - keep accessibility labels (`sr-only`) where needed

### Timeline

- Use the same heading language and typography system as Todo.
- Sidebar and feed should share the same warm-card family.

### Calendar

- Soften grid and controls.
- Prefer ghost/secondary controls unless emphasis is needed.
- `Today` highlight should be state-aware (highlight only when view is not on today).

## Motion and Interaction Tone

- Prefer gentle transitions (`duration-200` range) over attention-grabbing effects.
- Avoid urgent pulse/flash patterns for normal states.
- Interaction feedback should feel immediate but soft.

## Microcopy Tone

- Friendly and calm over strict/system-heavy language.
- Short, plain labels on controls and actions.
- Avoid jargon or overly clinical wording for user-facing copy.

## Do / Don't

### Do

- Use tokens first.
- Keep typography consistent across active desktop tabs.
- Keep actions and editing flows lightweight and immediate.

### Don't

- Reintroduce heavy borders/shadows as defaults.
- Introduce competing accent colors without token updates.
- Mix serif and sans headings inconsistently on the same surface.
