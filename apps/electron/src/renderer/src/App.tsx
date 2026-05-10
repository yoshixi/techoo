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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return
      if (event.key === '1') {
        event.preventDefault()
        setCurrentView('todo')
      } else if (event.key === '2') {
        event.preventDefault()
        setCurrentView('timeline')
      } else if (event.key === '3') {
        event.preventDefault()
        setCurrentView('account')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Topbar */}
      <header
        className="flex items-center justify-between px-5 shrink-0"
        style={{
          height: 48,
          background: 'color-mix(in srgb, var(--panel) 70%, #ffffff 30%)'
        }}
      >
        <span
          className="font-sans text-lg font-semibold tracking-tight"
          style={{ color: 'color-mix(in srgb, var(--text-dark) 72%, var(--text-muted-custom) 28%)' }}
        >
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
        className="flex items-center px-5 gap-1.5 shrink-0"
        style={{
          height: 44,
          background: 'color-mix(in srgb, var(--panel) 42%, transparent)'
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-dark)' : 'var(--text-muted-custom)',
                background: isActive ? 'color-mix(in srgb, var(--card) 86%, #fff 14%)' : 'transparent'
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
