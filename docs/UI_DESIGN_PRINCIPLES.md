---
title: "UI Design Principles"
brief_description: "Charming, character-driven design guidelines for Techoo."
created_at: "2026-01-17"
update_at: "2026-02-22"
---

# UI Design Principles

Techoo's visual identity is warm, emotionally supportive, and charming. The app should feel like a cozy companion helping users focus, not a cold productivity tool.

## Core Identity

- **Warm & Cozy**: Warm beige backgrounds, burnt orange accents, soft orange highlights
- **Encouraging**: Microcopy that feels like a gentle friend, not a drill sergeant
- **Character-Driven**: Animal companion illustrations that react to user activity
- **Light-Only**: Currently optimized for light theme only

## Color Palette

### Foundation
- **Background**: Off-white (`#F4F2EE`)
- **Foreground**: Dark (`#1C1C1C`) — primary text
- **Card**: White-ish (`#FAFAF8`)
- **Border / Divider**: Warm divider (`#E0DDD7`)

### Primary & Accents
- **Primary / Active Icons**: Burnt orange (`#C65A11`)
- **Accent**: Warm beige (`#E7E3DB`)
- **Secondary / Icon Backgrounds**: Soft orange (`#E8CFC2`)
- **Muted**: Inactive tab warm gray (`#D9D6CF`)
- **Muted Text**: Gray (`#8E8A84`)
- **Sidebar Active**: Warm brown (`#D4C8BA`) — distinct from sidebar background

### Semantic Colors
- **Success**: Calming green (`#2E7D32`)
- **Warning**: Golden amber (`#E0A800`)
- **Destructive**: Soft red (`#E04A3A`)
- **Timer Active**: Calming green with breathe animation — not urgent red
- **Celebration**: Golden yellow (`#F4C400`)

### Reserved (Future CTA)
- **Primary CTA**: Golden yellow (`#F4C400`) / amber (`#E0A800`) — for upgrade buttons

### Charts
- Burnt orange, soft orange, golden yellow, soft red, muted gray
- Never all-green or monochromatic

## Typography

- **Font**: Nunito (bundled locally for Electron, Google Fonts for mobile)
- **Weights**: 400 (body), 500 (medium), 600 (semibold headings), 700 (bold emphasis)
- **Character**: Rounded, friendly letterforms that match the warm visual style

## Shape & Rounding

- **Buttons**: Pill-shaped (`rounded-full`)
- **Cards**: Generous rounding (`rounded-3xl`)
- **Inputs**: Soft rounding (`rounded-xl`)
- **Tabs**: Pill-shaped list and triggers (`rounded-full`)
- **Base radius**: `0.875rem` (14px)

## Text Inputs

- **Background**: White (`bg-white`) for clear contrast against card backgrounds
- **Border**: Warm divider color (`#E0DDD7`) at rest
- **Focus**: Primary burnt orange border (`#C65A11`) on focus
- On mobile, focus states are implemented via React Native `style` prop (not Tailwind pseudo-classes)

## No Shadows

- **No shadows anywhere** — the design relies on borders, background contrast, and color to create visual hierarchy
- Use `border` and `ring` utilities for separation between elements
- Elevation is conveyed through background color differences (e.g., card on background)

## Animation

- **Breathe**: 3s scale pulse for active states (replaces harsh red pulse)
- **Gentle Bounce**: 2s translateY for working character
- **Soft Glow**: 2s opacity pulse for celebration/focus states
- Timer indicators use `animate-breathe` (calming) not `animate-pulse` (urgent)
- View transitions: `fade-in` + `slide-up` (0.3s)
- All interactive elements: `transition-all duration-200 ease-in-out`

## Character Companion

A small animal character appears in empty states and celebrations:
- **Idle**: Breathe animation, neutral expression
- **Working**: Gentle bounce, focused expression
- **Celebrating**: Soft glow, happy expression
- **Resting**: Static, sleepy expression
- **Encouraging**: Breathe animation, supportive expression
- **Thinking**: Breathe animation, curious expression

Placeholder SVG shapes (circle body, ears) — intended to be replaced with proper art later.

## Microcopy Guidelines

| Instead of | Use |
|-----------|-----|
| "What are you working on?" | "What would you like to focus on?" |
| "Start" / "Start Timer" | "Let's Go" / "Start Focusing" |
| "Stop" / "Stop Timer" | "Pause" |
| "In Progress" | "Focusing Now" |
| "Running Tasks" | "In the Flow" |
| "Quick Capture" | "Ready to Focus" |
| "No tasks running..." | "All clear! Ready when you are." |
| "No upcoming tasks found." | "Nothing coming up. Enjoy the calm!" |
| "Failed to load..." | "Hmm, couldn't load that. Let's try again." |
| "Account" | "Your Space" |
| "Daily Hours (Last 14 Days)" | "Your Focus Journey (14 Days)" |
| "Task Summary" | "What You Accomplished" |

## What to Avoid

- **No harsh reds**: Timer states use calming green, errors use warm amber
- **No pure white/black**: Always tinted warm
- **No cold grays**: Use cream-tinted neutrals
- **No aggressive animations**: Pulse → breathe, flash → glow
- **No clinical language**: Frame actions as invitations, not commands
