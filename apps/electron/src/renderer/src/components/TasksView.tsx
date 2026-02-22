import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { NowTab } from './tabs/NowTab'
import { UpcomingTab } from './tabs/UpcomingTab'
import { ReviewTab } from './tabs/ReviewTab'
import type { UseTasksDataReturn } from '../hooks/useTasksData'
import type { Task } from '../gen/api'

export type TasksTab = 'now' | 'upcoming' | 'review'

interface TasksViewProps {
  data: UseTasksDataReturn
  filterTagIds: number[]
  onFilterTagIdsChange: (ids: number[]) => void
  onTaskSelect: (task: Task) => void
  quickCaptureInputRef?: React.RefObject<HTMLInputElement | null>
}

export function TasksView({
  data,
  filterTagIds,
  onFilterTagIdsChange,
  onTaskSelect
}: TasksViewProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TasksTab>('now')

  return (
    <div className="flex flex-1 min-h-0 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl w-full flex flex-col min-h-0 flex-1 gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TasksTab)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0 w-fit">
            <TabsTrigger value="now">Now</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="now" className="flex-1 min-h-0 overflow-auto">
            <NowTab
              activeTasks={data.activeTasks}
              activeTimersByTaskId={data.activeTimersByTaskId}
              onStartTimer={data.handleStartTimer}
              onStopTimer={data.handleStopTimer}
              onCreateTaskAndStartTimer={data.handleCreateTaskAndStartTimer}
              onDeleteTask={data.handleDeleteTask}
              onTaskSelect={onTaskSelect}
              filterTagIds={filterTagIds}
            />
          </TabsContent>

          <TabsContent value="upcoming" className="flex-1 min-h-0 overflow-auto">
            <UpcomingTab
              activeTimersByTaskId={data.activeTimersByTaskId}
              onStartTimer={data.handleStartTimer}
              onStopTimer={data.handleStopTimer}
              onToggleCompletion={data.handleToggleTaskCompletion}
              onDeleteTask={data.handleDeleteTask}
              onTaskSelect={onTaskSelect}
              filterTagIds={filterTagIds}
              onFilterTagIdsChange={onFilterTagIdsChange}
            />
          </TabsContent>

          <TabsContent value="review" className="flex-1 min-h-0 overflow-auto">
            <ReviewTab
              allTasks={data.reviewTasks}
              timers={data.reviewTimers}
              timersByTaskId={data.reviewTimersByTaskId}
              onTaskSelect={onTaskSelect}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
