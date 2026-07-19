import React, { useCallback, useState } from 'react'
import { Check, Plus, ListPlus } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import type { Post } from '../gen/api/schemas'
import { usePostLists } from '../hooks/usePostLists'

export function AddPostToListDialog({
  post,
  open,
  onOpenChange
}: {
  post: Post | null
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { lists, isLoading, createList, togglePostInList } = usePostLists()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyListId, setBusyListId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    if (!post || creating) return
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    try {
      const list = await createList(trimmed)
      setNewName('')
      await togglePostInList(post, list.id)
    } catch {
      setError('Could not create list')
    } finally {
      setCreating(false)
    }
  }, [createList, creating, newName, post, togglePostInList])

  const handleToggle = useCallback(
    async (listId: number) => {
      if (!post || busyListId != null) return
      setBusyListId(listId)
      setError(null)
      try {
        await togglePostInList(post, listId)
      } catch {
        setError('Could not update list')
      } finally {
        setBusyListId(null)
      }
    },
    [busyListId, post, togglePostInList]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to list</DialogTitle>
        </DialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading lists…</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {lists.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No lists yet — create one below.</p>
            ) : (
              lists.map((list) => {
                const selected = post?.list_ids.includes(list.id) ?? false
                const busy = busyListId === list.id
                return (
                  <button
                    key={list.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleToggle(list.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <span>{list.name}</span>
                    {busy ? (
                      <span className="text-xs text-muted-foreground">…</span>
                    ) : selected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list name"
            disabled={creating}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCreate()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={creating || !newName.trim()}
            onClick={() => void handleCreate()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PostRowListAction({
  onListDialogOpen
}: {
  onListDialogOpen: () => void
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      onClick={onListDialogOpen}
      title="Add to list"
    >
      <ListPlus className="h-3.5 w-3.5" />
    </Button>
  )
}
