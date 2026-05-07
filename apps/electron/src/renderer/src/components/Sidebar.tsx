import React from 'react'
import { CircleUser, ListTodo, ScrollText } from 'lucide-react'
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

export type View = 'todo' | 'timeline' | 'account'

interface AppSidebarProps {
  currentView: View
  onViewChange: (view: View) => void
}

const menuItems = [
  { id: 'todo' as const, label: 'Todo', icon: ListTodo },
  { id: 'timeline' as const, label: 'Timeline', icon: ScrollText },
  { id: 'account' as const, label: 'Settings', icon: CircleUser }
]

export function AppSidebar({ currentView, onViewChange }: AppSidebarProps): React.JSX.Element {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">Techo</span>
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
      <SidebarFooter />
    </Sidebar>
  )
}
