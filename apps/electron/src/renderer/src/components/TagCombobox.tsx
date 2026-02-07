import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Plus, Check, ChevronDown } from 'lucide-react'
import { useGetApiTags, postApiTags } from '../gen/api'
import { Badge } from './ui/badge'
import { useErrorToast } from './ui/toast'
import { cn } from '../lib/utils'

interface TagComboboxProps {
  selectedTagIds: string[]
  onSelectionChange: (tagIds: string[]) => void
  onClose?: () => void
  placeholder?: string
  className?: string
}

export const TagCombobox: React.FC<TagComboboxProps> = ({
  selectedTagIds,
  onSelectionChange,
  onClose,
  placeholder = 'Select tags...',
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const showError = useErrorToast()

  const { data: tagsResponse, mutate: mutateTags } = useGetApiTags()
  const tags = tagsResponse?.tags ?? []

  // Filter tags based on search
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  // Check if search value matches any existing tag exactly
  const exactMatch = tags.some(
    (tag) => tag.name.toLowerCase() === searchValue.toLowerCase()
  )

  // Get selected tag objects
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchValue('')
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle Escape key globally when onClose is provided (for inline editing mode)
  useEffect(() => {
    if (!onClose) return

    const handleEscapeKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setSearchValue('')
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [onClose])

  const handleToggleTag = useCallback(
    (tagId: string): void => {
      if (selectedTagIds.includes(tagId)) {
        onSelectionChange(selectedTagIds.filter((id) => id !== tagId))
      } else {
        onSelectionChange([...selectedTagIds, tagId])
      }
    },
    [selectedTagIds, onSelectionChange]
  )

  const handleRemoveTag = useCallback(
    (tagId: string, event: React.MouseEvent): void => {
      event.stopPropagation()
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId))
    },
    [selectedTagIds, onSelectionChange]
  )

  const handleCreateTag = useCallback(async (): Promise<void> => {
    if (!searchValue.trim() || exactMatch || isCreating) return

    setIsCreating(true)
    try {
      const response = await postApiTags({ name: searchValue.trim() })
      await mutateTags()
      // Add the new tag to selection
      onSelectionChange([...selectedTagIds, response.tag.id])
      setSearchValue('')
    } catch (error) {
      showError(error, 'Failed to create tag')
    } finally {
      setIsCreating(false)
    }
  }, [searchValue, exactMatch, isCreating, selectedTagIds, onSelectionChange, mutateTags, showError])

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setSearchValue('')
      onClose?.()
    } else if (event.key === 'Enter' && searchValue && !exactMatch) {
      event.preventDefault()
      handleCreateTag()
    }
  }

  return (
    <div ref={containerRef} className={cn('relative h-10', className)}>
      {/* Trigger / Selected tags display */}
      <div
        className={cn(
          'flex h-full w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-3 text-sm cursor-pointer transition-colors',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring/40',
          isOpen && 'ring-2 ring-ring/40'
        )}
        onClick={() => {
          setIsOpen(true)
          inputRef.current?.focus()
        }}
      >
        <div className="flex flex-1 items-center gap-1 min-w-0 overflow-hidden">
          {selectedTags.length > 0 ? (
            selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="default"
                className="gap-1 pr-1 shrink-0 text-xs py-0"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  className="rounded-full p-0.5 hover:bg-secondary-foreground/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder=""
            className="flex-1 min-w-[30px] bg-transparent outline-none text-sm"
          />
        </div>
        <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-slide-up">
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredTags.length === 0 && !searchValue && (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                No tags yet. Type to create one.
              </div>
            )}

            {filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id)
              return (
                <div
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm cursor-pointer',
                    'hover:bg-secondary hover:text-secondary-foreground',
                    isSelected && 'bg-secondary/50'
                  )}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center',
                      isSelected ? 'bg-primary border-primary' : 'border-input'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  {tag.name}
                </div>
              )
            })}

            {/* Create new tag option */}
            {searchValue && !exactMatch && (
              <>
                {filteredTags.length > 0 && (
                  <div className="mx-1 my-1 h-px bg-muted" />
                )}
                <div
                  onClick={handleCreateTag}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm cursor-pointer',
                    'hover:bg-secondary hover:text-secondary-foreground',
                    isCreating && 'opacity-50 pointer-events-none'
                  )}
                >
                  <Plus className="h-4 w-4" />
                  {isCreating ? 'Creating...' : `Create "${searchValue}"`}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
