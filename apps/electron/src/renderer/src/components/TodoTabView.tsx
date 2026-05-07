import React, { useCallback, useState } from 'react'
import { CalendarTodoWorkspace } from './CalendarView'
import { TodoView } from './TodoView'
import { useTodos } from '../hooks/useTodos'
import type { Todo } from '../gen/api/schemas'

/**
 * Todo tab: calendar workspace (left) + filtered todo list (right), sharing detail selection.
 */
export function TodoTabView(): React.JSX.Element {
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const { todos: resolverTodos } = useTodos({ showAll: true })

  const handleCalendarTodoSelect = useCallback(
    (calTodo: { id: number }) => {
      const match = resolverTodos.find((t) => t.id === calTodo.id)
      if (match) setSelectedTodo(match)
    },
    [resolverTodos]
  )

  return (
    <div className="flex flex-1 min-h-0">
      <CalendarTodoWorkspace
        className="flex-1 min-w-0 border-r border-border"
        showHeaderNew={false}
        onTodoSelect={handleCalendarTodoSelect}
      />
      <TodoView
        variant="column"
        className="w-[min(440px,42vw)] shrink-0 min-h-0 border-l border-border"
        selectedTodo={selectedTodo}
        onSelectedTodoChange={setSelectedTodo}
      />
    </div>
  )
}
