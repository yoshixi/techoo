import React from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { PostList } from '../gen/api/schemas'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from './ui/context-menu'

export type TimelineTab =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'list'; listId: number }

function tabKey(tab: TimelineTab): string {
  if (tab.type === 'all') return 'all'
  if (tab.type === 'favorites') return 'favorites'
  return `list:${tab.listId}`
}

export function TimelineTabs({
  lists,
  activeTab,
  onSelect,
  onNewList,
  onEditList,
  onDeleteList
}: {
  lists: PostList[]
  activeTab: TimelineTab
  onSelect: (tab: TimelineTab) => void
  onNewList: () => void
  onEditList: (list: PostList) => void
  onDeleteList: (list: PostList) => void
}): React.JSX.Element {
  const activeKey = tabKey(activeTab)

  const tabButton = (key: string, label: string, tab: TimelineTab): React.JSX.Element => {
    const active = activeKey === key
    return (
      <button
        key={key}
        type="button"
        onClick={() => onSelect(tab)}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors"
        style={{
          fontWeight: active ? 500 : 400,
          color: active ? '#fff' : 'var(--text-muted-custom)',
          background: active ? 'var(--text-dark)' : 'transparent'
        }}
      >
        {label}
      </button>
    )
  }

  const listTabButton = (list: PostList): React.JSX.Element => {
    const key = `list:${list.id}`
    const tab: TimelineTab = { type: 'list', listId: list.id }
    const active = activeKey === key

    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(tab)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors"
            style={{
              fontWeight: active ? 500 : 400,
              color: active ? '#fff' : 'var(--text-muted-custom)',
              background: active ? 'var(--text-dark)' : 'transparent'
            }}
          >
            {list.name}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onEditList(list)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit list
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDeleteList(list)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete list
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <div
      className="mt-2 flex max-w-full flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Timeline collections"
    >
      {tabButton('all', 'All', { type: 'all' })}
      {tabButton('favorites', 'Favorites', { type: 'favorites' })}
      {lists.map((list) => listTabButton(list))}
      <button
        type="button"
        onClick={onNewList}
        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors"
        style={{
          fontWeight: 400,
          color: 'var(--text-muted-custom)',
          background: 'transparent'
        }}
        title="New list"
      >
        <Plus className="h-3.5 w-3.5" />
        New list
      </button>
    </div>
  )
}

export function getTimelineTabLabel(tab: TimelineTab, lists: PostList[]): string {
  if (tab.type === 'all') return 'All posts'
  if (tab.type === 'favorites') return 'Favorites'
  const list = lists.find((item) => item.id === tab.listId)
  return list?.name ?? 'List'
}
