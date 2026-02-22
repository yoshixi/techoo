import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Label } from './components/ui/label'
import { TagCombobox } from './components/TagCombobox'
import {
  postApiTasks,
  type Task
} from './gen/api'
import { TaskSideMenu } from './components/TaskSideMenu'
import { AppSidebar, type View } from './components/Sidebar'
import { AccountView } from './components/AccountView'
import { SettingsView } from './components/SettingsView'
import { SidebarProvider, SidebarInset, useSidebar } from './components/ui/sidebar'
import { Dialog, DialogContent } from './components/ui/dialog'
import { formatDateTimeInput, normalizeDateTime } from './lib/time'
import { CalendarView, type ViewMode } from './components/CalendarView'
import { TaskTimeRangePicker } from './components/TaskTimeRangePicker'
import { useIsNarrow } from './hooks/use-mobile'
import { useTasksData } from './hooks/useTasksData'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { TasksView } from './components/TasksView'
import { NotesView } from './components/NotesView'
import { startOfDay, addDays } from './lib/calendar-utils'

// Keyboard shortcut definitions
type KeyBinding = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

const keyMaps = {
  NEW_TASK: { key: 'n', metaKey: true },
  TOGGLE_SIDEBAR: { key: 'e', metaKey: true },
  TOGGLE_TIMER: { key: ' ' },
  NAVIGATE_NEXT: { key: 'Tab' },
  NAVIGATE_PREV: { key: 'Tab', shiftKey: true }
} as const satisfies Record<string, KeyBinding>

function matchesKeyBinding(e: KeyboardEvent, binding: KeyBinding): boolean {
  const metaOrCtrl = binding.metaKey ? (e.metaKey || e.ctrlKey) : true
  const shift = binding.shiftKey ? e.shiftKey : !e.shiftKey
  return e.key === binding.key && metaOrCtrl && shift
}

// Keyboard shortcut handler component (must be inside SidebarProvider)
function KeyboardShortcuts({
  currentView,
  onNewCalendarTask,
  onToggleTimer,
  onNavigateNext,
  onNavigatePrev
}: {
  currentView: View
  onNewCalendarTask: () => void
  onToggleTimer: () => void
  onNavigateNext: () => void
  onNavigatePrev: () => void
}): null {
  const { toggleSidebar } = useSidebar()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Command/Ctrl + N: New task (calendar view only now, tasks view has Quick Capture)
      if (matchesKeyBinding(e, keyMaps.NEW_TASK)) {
        e.preventDefault()
        if (currentView === 'calendar') {
          onNewCalendarTask()
        }
        return
      }

      // Command/Ctrl + E: Toggle sidebar
      if (matchesKeyBinding(e, keyMaps.TOGGLE_SIDEBAR)) {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Space: Toggle timer
      if (matchesKeyBinding(e, keyMaps.TOGGLE_TIMER)) {
        e.preventDefault()
        onToggleTimer()
        return
      }

      // Tab: Navigate tasks
      if (matchesKeyBinding(e, keyMaps.NAVIGATE_PREV)) {
        e.preventDefault()
        onNavigatePrev()
        return
      }

      if (matchesKeyBinding(e, keyMaps.NAVIGATE_NEXT)) {
        e.preventDefault()
        onNavigateNext()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar, currentView, onNewCalendarTask, onToggleTimer, onNavigateNext, onNavigatePrev])

  return null
}

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<View>('calendar')
  const [showCompleted] = useState(false)
  const [showTodayOnly] = useState(true)
  const [showUnscheduled] = useState(true)
  const [filterTagIds, setFilterTagIds] = useState<number[]>([])
  const [sortBy] = useState<'createdAt' | 'startAt'>('startAt')
  const [calendarViewMode, setCalendarViewMode] = useState<ViewMode>('day')
  const [calendarDraft, setCalendarDraft] = useState<{
    title: string
    description: string
    startAt: string
    endAt: string
    tagIds: number[]
  } | null>(null)
  const [isCreatingCalendarTask, setIsCreatingCalendarTask] = useState(false)
  const [calendarCreateError, setCalendarCreateError] = useState<string | null>(null)

  // Sidebar state controlled by window width
  const isNarrow = useIsNarrow()
  const [sidebarOpen, setSidebarOpen] = useState(!isNarrow)

  // Auto-collapse sidebar when window becomes narrow
  useEffect(() => {
    setSidebarOpen(!isNarrow)
  }, [isNarrow])

  // Shared data layer
  const tasksData = useTasksData({
    currentView,
    showCompleted,
    showTodayOnly,
    showUnscheduled,
    filterTagIds,
    sortBy
  })

  const {
    displayTasks,
    allTasks,
    sidebarActiveTasks,
    tasksLoading,
    tasksError,
    activeTimersByTaskId,
    mutateBothTaskLists,
    handleStartTimer,
    handleStopTimer,
    toggleTaskTimer,
    handleDeleteTask
  } = tasksData

  // Calculate date range for calendar events - fetch a wider window to cover navigation
  // We fetch events for the current month +/- 2 weeks to ensure smooth navigation
  const calendarDateRange = useMemo(() => {
    const now = new Date()
    const startDate = addDays(startOfDay(now), -14) // 2 weeks ago
    const endDate = addDays(startOfDay(now), 45) // ~6 weeks ahead
    return { startDate, endDate }
  }, [])

  // Calendar events data layer
  const {
    events: calendarEvents,
    calendars,
    visibleCalendarIds,
    toggleCalendarVisibility
  } = useCalendarEvents({
    startDate: calendarDateRange.startDate,
    endDate: calendarDateRange.endDate,
    enabled: currentView === 'calendar'
  })

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [focusedTaskIndex, setFocusedTaskIndex] = useState<number>(-1)
  const [scheduleEditingTask, setScheduleEditingTask] = useState<Task | null>(null)
  const [isSchedulePickerOpen, setIsSchedulePickerOpen] = useState(false)

  // Combined list for keyboard navigation
  const allTasksForNavigation = useMemo(() => displayTasks, [displayTasks])

  // Get the focused task
  const focusedTask = useMemo(() => {
    if (focusedTaskIndex >= 0 && focusedTaskIndex < allTasksForNavigation.length) {
      return allTasksForNavigation[focusedTaskIndex]
    }
    return null
  }, [focusedTaskIndex, allTasksForNavigation])

  // Listen for show task detail request from tray menu
  useEffect(() => {
    const unsubscribe = window.api.onShowTaskDetail((taskId: number) => {
      const task = allTasks.find((t) => t.id === taskId)
      if (task) setSelectedTask(task)
    })
    return unsubscribe
  }, [allTasks])

  // Helper to start adding a new task via calendar (opens dialog with current time)
  const startAddingCalendarTask = useCallback(() => {
    const now = new Date()
    const endTime = new Date(now.getTime() + 60 * 60 * 1000)
    const formatLocal = (date: Date): string =>
      new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setCalendarCreateError(null)
    setCalendarDraft({
      title: '',
      description: '',
      startAt: formatLocal(now),
      endAt: formatLocal(endTime),
      tagIds: filterTagIds
    })
  }, [filterTagIds])

  // Handle keyboard timer toggle
  const handleKeyboardToggleTimer = useCallback(() => {
    if (focusedTask) {
      toggleTaskTimer(focusedTask)
      return
    }
    const { inactiveTasks, activeTasks } = tasksData
    if (inactiveTasks.length > 0) {
      setFocusedTaskIndex(activeTasks.length)
      toggleTaskTimer(inactiveTasks[0])
    }
  }, [focusedTask, tasksData, toggleTaskTimer])

  // Navigate to next task
  const handleNavigateNext = useCallback(() => {
    if (allTasksForNavigation.length === 0) return
    setFocusedTaskIndex((prev) => {
      if (prev < 0) return 0
      return (prev + 1) % allTasksForNavigation.length
    })
  }, [allTasksForNavigation.length])

  // Navigate to previous task
  const handleNavigatePrev = useCallback(() => {
    if (allTasksForNavigation.length === 0) return
    setFocusedTaskIndex((prev) => {
      if (prev < 0) return allTasksForNavigation.length - 1
      return (prev - 1 + allTasksForNavigation.length) % allTasksForNavigation.length
    })
  }, [allTasksForNavigation.length])

  const handleCalendarMoveTask = async (
    task: Task,
    range: { startAt: string; endAt: string }
  ): Promise<void> => {
    await tasksData.handleSaveSchedule(task.id, range.startAt, range.endAt)
  }

  const handleCalendarCreate = async (): Promise<void> => {
    if (!calendarDraft || !calendarDraft.title.trim()) return
    setIsCreatingCalendarTask(true)
    setCalendarCreateError(null)
    const payload = {
      title: calendarDraft.title.trim(),
      description: calendarDraft.description.trim() || undefined,
      startAt: normalizeDateTime(calendarDraft.startAt),
      endAt: normalizeDateTime(calendarDraft.endAt),
      tagIds: calendarDraft.tagIds.length > 0 ? calendarDraft.tagIds : undefined
    }

    try {
      await postApiTasks(payload)
      setCalendarDraft(null)
      setCalendarCreateError(null)
      await mutateBothTaskLists()
    } catch (error) {
      console.error('Failed to create task:', error)
      setCalendarCreateError(getErrorMessage(error))
    } finally {
      setIsCreatingCalendarTask(false)
    }
  }

  const handleTaskSelect = useCallback((task: Task) => {
    setSelectedTask(task)
    const index = allTasksForNavigation.findIndex((t) => t.id === task.id)
    setFocusedTaskIndex(index)
  }, [allTasksForNavigation])

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <KeyboardShortcuts
        currentView={currentView}
        onNewCalendarTask={startAddingCalendarTask}
        onToggleTimer={handleKeyboardToggleTimer}
        onNavigateNext={handleNavigateNext}
        onNavigatePrev={handleNavigatePrev}
      />
      <AppSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        activeTasks={sidebarActiveTasks}
        activeTimersByTaskId={activeTimersByTaskId}
        onStopTimer={handleStopTimer}
        onOpenTaskDetail={setSelectedTask}
      />
      <SidebarInset>
        {currentView === 'account' ? (
          <AccountView />
        ) : currentView === 'settings' ? (
          <SettingsView />
        ) : currentView === 'notes' ? (
          <NotesView />
        ) : currentView === 'calendar' ? (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-8">
            <main className="flex min-h-0 flex-1 flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Tags:</span>
                    <TagCombobox
                      selectedTagIds={filterTagIds}
                      onSelectionChange={setFilterTagIds}
                      placeholder="All tags"
                      className="w-48"
                    />
                  </div>
                </div>
              </div>

              {tasksLoading && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  Loading tasks...
                </div>
              )}
              {!tasksLoading && tasksError ? (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  Hmm, couldn&apos;t load tasks. {getErrorMessage(tasksError)}
                </div>
              ) : null}
              {!tasksLoading && !tasksError && (
                <CalendarView
                  className="flex-1 min-h-0"
                  tasks={displayTasks}
                  viewMode={calendarViewMode}
                  onViewModeChange={setCalendarViewMode}
                  onTaskSelect={handleTaskSelect}
                  onTaskEdit={handleTaskSelect}
                  onTaskDelete={(task) => handleDeleteTask(task.id)}
                  onTaskMove={handleCalendarMoveTask}
                  activeTimersByTaskId={activeTimersByTaskId}
                  onTaskStartTimer={handleStartTimer}
                  onTaskStopTimer={handleStopTimer}
                  onCreateRange={({ startAt, endAt }) => {
                    setCalendarCreateError(null)
                    setCalendarDraft({
                      title: '',
                      description: '',
                      startAt,
                      endAt,
                      tagIds: filterTagIds
                    })
                  }}
                  calendarEvents={calendarEvents}
                  calendars={calendars}
                  visibleCalendarIds={visibleCalendarIds}
                  onToggleCalendarVisibility={toggleCalendarVisibility}
                />
              )}
            </main>
          </div>
        ) : (
          <TasksView
            data={tasksData}
            filterTagIds={filterTagIds}
            onFilterTagIdsChange={setFilterTagIds}
            onTaskSelect={handleTaskSelect}
          />
        )}
      </SidebarInset>

      {/* Calendar create task dialog */}
      <Dialog
        open={Boolean(calendarDraft)}
        onOpenChange={(open) => {
          if (!open && !isCreatingCalendarTask) {
            setCalendarDraft(null)
            setCalendarCreateError(null)
          }
        }}
      >
        <DialogContent
          className="max-w-xl w-[95vw]"
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !event.metaKey) return
            event.preventDefault()
            if (isCreatingCalendarTask || !calendarDraft?.title.trim()) return
            handleCalendarCreate()
          }}
        >
          <div className="space-y-4">
            <div className="text-lg font-semibold">New task</div>
            {calendarCreateError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {calendarCreateError}
              </div>
            )}
            <Input
              placeholder="Title"
              value={calendarDraft?.title ?? ''}
              onChange={(event) =>
                setCalendarDraft((prev) =>
                  prev ? { ...prev, title: event.target.value } : prev
                )
              }
              autoFocus
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="calendar-start-at">Start time</Label>
                <Input
                  id="calendar-start-at"
                  type="datetime-local"
                  value={calendarDraft ? formatDateTimeInput(calendarDraft.startAt) : ''}
                  onChange={(event) =>
                    setCalendarDraft((prev) =>
                      prev ? { ...prev, startAt: event.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="calendar-end-at">End time</Label>
                <Input
                  id="calendar-end-at"
                  type="datetime-local"
                  value={calendarDraft ? formatDateTimeInput(calendarDraft.endAt) : ''}
                  onChange={(event) =>
                    setCalendarDraft((prev) =>
                      prev ? { ...prev, endAt: event.target.value } : prev
                    )
                  }
                />
              </div>
            </div>
            <Textarea
              placeholder="Description"
              rows={3}
              value={calendarDraft?.description ?? ''}
              onChange={(event) =>
                setCalendarDraft((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev
                )
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <TagCombobox
                selectedTagIds={calendarDraft?.tagIds ?? []}
                onSelectionChange={(tagIds) =>
                  setCalendarDraft((prev) =>
                    prev ? { ...prev, tagIds } : prev
                  )
                }
                placeholder="Add tags"
                className="w-64"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleCalendarCreate}
                disabled={isCreatingCalendarTask || !calendarDraft?.title.trim()}
              >
                {isCreatingCalendarTask ? (
                  'Creating...'
                ) : (
                  <>
                    <span className="mr-1 text-sm text-primary-foreground/80">
                      {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}\u23CE
                    </span>
                    Create
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCalendarDraft(null)}
                disabled={isCreatingCalendarTask}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task detail dialog */}
      <Dialog
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
      >
        <DialogContent className="max-w-3xl w-[95vw] border-none bg-transparent p-0 focus-visible:outline-none">
          {selectedTask ? (
            <TaskSideMenu
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onTaskUpdated={async (updated) => {
                setSelectedTask(updated)
                await mutateBothTaskLists()
              }}
              tasks={allTasks}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Schedule picker dialog */}
      <Dialog
        open={isSchedulePickerOpen && Boolean(scheduleEditingTask)}
        onOpenChange={(open) => {
          if (!open) setIsSchedulePickerOpen(false)
        }}
      >
        <DialogContent className="max-w-xl w-[95vw]">
          {scheduleEditingTask && (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Schedule</div>
              <TaskTimeRangePicker
                startAt={scheduleEditingTask.startAt}
                endAt={scheduleEditingTask.endAt}
                tasks={allTasks}
                currentTaskId={scheduleEditingTask.id}
                onChange={({ startAt, endAt }) => {
                  setScheduleEditingTask({ ...scheduleEditingTask, startAt, endAt })
                  tasksData.handleSaveSchedule(scheduleEditingTask.id, startAt, endAt)
                }}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsSchedulePickerOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const httpMatch = error.message.match(/^HTTP\s+\d+:\s*(.*)$/i)
    if (httpMatch) {
      const rawMessage = httpMatch[1].trim()
      if (rawMessage) {
        try {
          const parsed = JSON.parse(rawMessage) as { error?: string; message?: string }
          if (parsed.error) return parsed.error
          if (parsed.message) return parsed.message
        } catch {
          return rawMessage
        }
      }
    }
    return error.message
  }
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error?: string }).error
    if (message) return message
  }
  return 'Please try again.'
}

export default App
