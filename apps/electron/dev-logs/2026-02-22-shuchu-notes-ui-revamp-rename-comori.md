# UI Revamp: Rename to Techo + Charming Design

**Date:** 2026-02-22
**Branch:** shuchu-notes

## What Was Implemented

### Phase 0: Rename Shuchu to Techo
- Updated all user-facing text across Electron and Mobile apps
- Updated build configs: `electron-builder.yml`, `package.json`, `app.json`
- Updated API metadata in backend route, handlers, common core, and tests
- Updated storage keys from `shuchu:` to `techoo:`
- Updated deep link scheme from `shuchu://` to `techoo://` in mobile OAuth
- Updated all documentation files (CLAUDE.md, Spec.md, docs/*.md)
- Left historical dev-logs and agents/plans untouched

### Phase 1: Design Foundation (Electron)
- Bundled Nunito variable font (woff2) locally in `assets/fonts/`
- Replaced CSS variables in `main.css` with warm pastel palette (OKLch)
- Added semantic tokens: `--success`, `--warning`, `--timer-active`, `--timer-active-bg`, `--celebration`
- Added soft shadow variables
- Updated `base.css` font-family from Inter to Nunito
- Increased `--radius` from 0.65rem to 0.875rem
- Commented out `.dark` block (light-only for now)
- Added keyframes in `tailwind.config.ts`: `breathe`, `gentle-bounce`, `soft-glow`

### Phase 2: Core Components (Electron)
- `button.tsx`: `rounded-md` to `rounded-full` (pill), added `shadow-sm` and `duration-200`
- `card.tsx`: Replaced hardcoded `bg-white/90 border-black/5` with semantic `bg-card border-border shadow-sm`
- `badge.tsx`: Updated success/warning variants to use semantic tokens
- `tabs.tsx`: Pill-shaped list and triggers with soft shadow active state
- `input.tsx`: `rounded-md` to `rounded-xl`, warm focus glow
- `textarea.tsx`: Same rounding and focus changes
- `dialog.tsx`: Overlay `bg-black/60` to `bg-foreground/30`, rounder content
- `select.tsx`: Rounder trigger and content
- `tooltip.tsx`: `rounded-xl`
- `skeleton.tsx`: `animate-pulse` to `animate-breathe`

### Phase 3: View-by-View Revamp (Electron)
- Created `lib/microcopy.ts` with warm copy constants
- Created `CharacterIllustration.tsx` with mood-based SVG character
- Updated InProgressPanel: red pulse to green breathe, warm labels
- Updated NowTab: warm empty states with CharacterIllustration
- Updated UpcomingTab: warm empty state, soft delete hover
- Updated CalendarView: warm current time indicator, timer blocks
- Updated TimerManager: warm buttons, breathe animations
- Updated TaskSideMenu: warm container, success text color
- Updated NotesView: warm empty state with character
- Updated AccountView: title "Your Space", semantic colors
- Updated AuthScreen: "Welcome to Techo", character illustration
- Updated CommentsPanel: warm placeholder
- Replaced all `text-red-*`, `bg-red-*` in main views with semantic tokens

### Phase 4: Animation & Polish (Electron)
- Created `CompletionCelebration.tsx` with character + glow overlay
- Integrated celebration into TaskSideMenu on task completion
- Updated TaskSideMenu container to `bg-card`
- Fixed remaining red error states in App.tsx

### Phase 5: Mobile App
- Updated `global.css` with warm HSL palette
- Updated `lib/theme.ts` with warm light theme values
- Updated mobile UI components: pill buttons, rounder cards/inputs
- Updated view components: warm microcopy, semantic colors
- Updated settings footer: "Techo v{ver} — Your cozy focus companion"

### Phase 6: Documentation
- Replaced `docs/UI_DESIGN_PRINCIPLES.md` with new charming design guidelines
- Updated `TECHNICAL_REFERENCE.md` and `API_INTEGRATION.md` gen file references

## Remaining Steps (Manual)

1. **Regenerate API clients** — requires backend running:
   ```sh
   pnpm --filter electron run api:generate
   pnpm --filter mobile run api:generate
   ```
   This will rename `shuchuAPI.gen.ts` to `techoAPI.gen.ts` and update all imports.

2. **Install Nunito font for mobile** (Expo):
   ```sh
   cd apps/mobile
   npx expo install @expo-google-fonts/nunito expo-font
   ```
   Then load in `app/_layout.tsx` with `useFonts`.

3. **Full build verification**:
   ```sh
   pnpm run build
   ```

## Commands Executed
- `devenv shell -- pnpm run check-types` (passed after each phase)
- `curl` to download Nunito font from Google Fonts CDN
