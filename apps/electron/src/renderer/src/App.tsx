import React, { useEffect, useState } from 'react'
import { ListTodo, ScrollText, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { TodoTabView } from './components/TodoTabView'
import { TimelineView } from './components/TimelineView'
import { AccountView } from './components/AccountView'

type View = 'todo' | 'timeline' | 'account'

const tabs: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'todo', label: 'Todo', icon: ListTodo },
  { id: 'timeline', label: 'Timeline', icon: ScrollText },
  { id: 'account', label: 'Settings', icon: User }
]

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function App(): React.JSX.Element {
  const [currentView, setCurrentView] = useState<View>('todo')
  const [todayStr, setTodayStr] = useState(() => formatDate(new Date()))
  useEffect(() => {
    const tick = (): void => setTodayStr(formatDate(new Date()))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Topbar */}
      <header
        className="flex items-center justify-between px-5 shrink-0"
        style={{
          height: 44,
          background: 'var(--panel)',
          borderBottom: '0.5px solid var(--border-l)'
        }}
      >
        <span className="font-title text-lg tracking-wide" style={{ color: 'var(--text-dark)' }}>
          Techo
        </span>
        <span
          className="text-xs px-3 py-1 rounded-full"
          style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)', fontSize: 11 }}
        >
          {todayStr}
        </span>
      </header>

      {/* Tab row */}
      <nav
        className="flex items-end px-5 gap-1 shrink-0"
        style={{
          height: 36,
          background: 'var(--panel)',
          borderBottom: '0.5px solid var(--border-l)'
        }}
      >
        {tabs.map((tab) => {
          const isActive = currentView === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentView(tab.id)}
              className="flex items-center gap-1.5 px-3 pb-2 text-xs transition-colors"
              style={{
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-dark)' : 'var(--text-muted-custom)',
                borderBottom: isActive ? '2px solid var(--amber)' : '2px solid transparent'
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Screen content */}
      <main className="flex flex-col flex-1 min-h-0">
        {currentView === 'todo' && <TodoTabView />}
        {currentView === 'timeline' && <TimelineView />}
        {currentView === 'account' && <AccountView />}
      </main>
    </div>
  )
}

export default App
