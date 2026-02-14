# Shuchu - Product Concept

## One-liner

Shuchu makes it incredibly easy to track your planned vs. actual progress for short-term personal tasks.

## The Problem

Knowledge workers plan their day in their head or on paper, then dive in. Hours later they surface with no clear picture of where the time actually went. Existing tools either force heavyweight project management or offer time tracking that feels disconnected from the plan. The gap between "what I intended to do" and "what I actually did" stays invisible.

## Core Insight

If you can see your plan and your actual time side by side -- with almost no friction to record either -- you naturally get better at estimating, prioritizing, and staying focused. The feedback loop should be tight: plan in seconds, track in one click, review at a glance.

## Who It's For

Individual contributors who work on short-term, self-directed tasks: developers on personal projects, freelancers managing client work, students studying for exams, or anyone doing focused knowledge work. Not teams. Not multi-year roadmaps. Just you and your day.

## Design Principles

### 1. Plan-vs-actual is the core axis

Every screen should reinforce the relationship between intended time and actual time. The calendar shows where you planned to work. The timer records where you actually worked. The review shows the delta. This comparison is the product's reason to exist.

### 2. One-click to start working

The distance from "I want to work on this" to "a timer is running" must be exactly one action. Quick Capture creates a task and starts the timer simultaneously. Starting a timer from the calendar or task list is a single click. Anything more and people stop tracking.

### 3. Short-term focus

Shuchu is optimized for today and this week. It is not a backlog, a roadmap, or a project management tool. Tasks have start times and durations, not sprints or milestones. The planning horizon is hours to days, not weeks to months.

### 4. Lightweight structure, rich signal

Tasks have a title, optional time range, and optional tags. That's it. No priority fields, no status columns, no custom fields. The richness comes from timer data: how long you actually worked, when you started and stopped, how many sessions it took. Structure is derived from behavior, not from manual entry.

### 5. Glanceable review

You should be able to answer "how did my day/week go?" in under 5 seconds. Charts and summaries exist to give you that answer, not to generate reports for someone else.

## The Three Modes

Shuchu organizes work into three distinct modes, each optimized for a different mindset:

### Calendar - Visual Planning

The calendar is where you lay out your intentions. Drag to create time blocks, move them around, see your day at a glance. It answers: **"What do I plan to do?"**

- Day and week views
- Drag-to-create and drag-to-move time blocks
- Visual density shows how packed your schedule is
- Active timers are visually distinct (red) so you see plan vs. reality in real time

### Tasks - Execution

The tasks view is where you do the work. It's split into three tabs reflecting the execution lifecycle:

**Now** -- the daily cockpit. Quick Capture to start working immediately. Running tasks with live timers. Today's schedule to see what's next. This is the screen you live in during the workday. It answers: **"What am I doing right now?"**

**Upcoming** -- the planning queue. All scheduled tasks grouped by date (Today, Tomorrow, This Week, Later). Light controls to start timers or mark tasks complete. It answers: **"What's coming up?"**

**Review** -- the feedback loop. Time charts showing daily hours over the past two weeks. Breakdown by tag. Task-level summaries with total time and session count. It answers: **"Where did my time actually go?"**

### Sidebar - Ambient Awareness

The sidebar provides persistent context regardless of which view you're in. Active timers with live elapsed time and comment input are always visible. The system tray mirrors this so you can see what's running even when the app is in the background.

## How Plan-vs-Actual Works

1. **Plan**: Create a task with a time range on the calendar (e.g., "Write proposal, 10:00-11:30").
2. **Execute**: When you start working, click Play or use Quick Capture. A timer begins recording actual time.
3. **Log**: While the timer runs, add comments capturing what you're doing or any blockers. These attach to the task's timeline.
4. **Stop**: When you finish or switch tasks, stop the timer. The actual duration is recorded.
5. **Review**: At the end of the day or week, the Review tab shows your actual hours against your planned blocks. The calendar shows planned blocks alongside timer-derived actual time. The gap between plan and reality becomes visible.

## What Shuchu Is Not

- **Not a team tool.** No shared projects, no assignments, no permissions. Single-user by design.
- **Not a project manager.** No Gantt charts, no dependencies, no status workflows. Tasks are flat.
- **Not a Pomodoro timer.** No forced intervals, no break reminders. You control your own rhythm.
- **Not a habit tracker.** No streaks, no goals, no gamification. Just honest data about how you spend your time.

## Technical Context

- **Desktop app** (Electron) with a Next.js/Hono API backend
- **Offline-capable** with local SQLite, sync to Turso for cloud backup
- **Auto-generated API client** from OpenAPI spec keeps frontend and backend in sync
- **SWR** for data fetching with optimistic updates so the UI never feels slow

## Future Directions (Not Committed)

These are areas where the plan-vs-actual concept could naturally extend. They are not planned work -- they exist here to show the product's natural growth direction and to help evaluate whether proposed features align with the core concept.

- **Daily summary**: An end-of-day view that explicitly compares planned blocks with actual timer sessions, showing over/under time per task.
- **Estimation calibration**: Over time, show the user how accurate their time estimates are (e.g., "You typically spend 1.4x your planned time on tasks tagged 'writing'").
- **Focus score**: A simple metric derived from timer data -- how much of your planned time was actually tracked? High scores mean your plan matched reality.
- **Weekly reflection**: A prompted review at the end of the week encouraging the user to note what went well and what to adjust.
- **Mobile companion**: A lightweight mobile app for quick timer start/stop and comment logging when away from the desktop.
