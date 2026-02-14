import React from 'react'
import { CalendarDays, ListTodo, CircleUser } from 'lucide-react'
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

type View = 'tasks' | 'calendar' | 'account'

interface AppSidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  activeTasks: Task[]
  activeTimersByTaskId: Map<number, TaskTimer>
  onStopTimer: (taskId: number, timerId: number) => void
  onOpenTaskDetail: (task: Task) => void
}

const menuItems = [
  { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'account' as const, label: 'Account', icon: CircleUser }
]

export function AppSidebar({
  currentView,
  onViewChange,
  activeTasks,
  activeTimersByTaskId,
  onStopTimer,
  onOpenTaskDetail
}: AppSidebarProps): React.JSX.Element {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">Shuchu</span>
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
