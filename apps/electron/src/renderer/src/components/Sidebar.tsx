import React, { useMemo } from 'react'
import { CalendarDays, ListTodo, StickyNote, CircleUser, Settings, ClipboardList } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger
} from './ui/sidebar'
import { InProgressPanel } from './InProgressPanel'
import type { Task, TaskTimer } from '../gen/api'

export type View = 'tasks' | 'calendar' | 'notes' | 'account' | 'settings'

interface AppSidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  activeTasks: Task[]
  activeTimersByTaskId: Map<number, TaskTimer>
  onStopTimer: (taskId: number, timerId: number) => void
  onOpenTaskDetail: (task: Task) => void
  onPlanToday?: () => void
  carryoverCount?: number
}

const menuItems = [
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
  { id: 'notes' as const, label: 'Notes', icon: StickyNote },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
  { id: 'account' as const, label: 'Account', icon: CircleUser }
]

function isPlanningTime(): boolean {
  const hour = new Date().getHours()
  return hour >= 4 && hour < 12
}

export function AppSidebar({
  currentView,
  onViewChange,
  activeTasks,
  activeTimersByTaskId,
  onStopTimer,
  onOpenTaskDetail,
  onPlanToday,
  carryoverCount = 0
}: AppSidebarProps): React.JSX.Element {
  const showPlanToday = useMemo(() => isPlanningTime(), [])
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">Techoo</span>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
                    onClick={() => onViewChange(item.id)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {showPlanToday && onPlanToday && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onPlanToday}
                    tooltip="Plan Today"
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span>Plan Today</span>
                    {carryoverCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium h-4 min-w-4 px-1">
                        {carryoverCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-0 mt-auto">
        <InProgressPanel
          tasks={activeTasks}
          activeTimersByTaskId={activeTimersByTaskId}
          onStopTimer={onStopTimer}
          onOpenTaskDetail={onOpenTaskDetail}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
