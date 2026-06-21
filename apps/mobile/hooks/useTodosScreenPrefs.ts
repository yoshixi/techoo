import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_LIST_FILTERS,
  type TodosListFilters,
  type TodosViewMode,
} from '@/lib/todosScreenIntent'

const STORAGE_KEY = 'techo-mobile-todos-screen-prefs'

type StoredPrefs = {
  viewMode?: TodosViewMode
  listFilters?: Partial<TodosListFilters>
}

function decodeStored(raw: string | null): StoredPrefs | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredPrefs
  } catch {
    return null
  }
}

export function useTodosScreenPrefs(): {
  viewMode: TodosViewMode
  setViewMode: (mode: TodosViewMode) => void
  listFilters: TodosListFilters
  setListFilters: (next: TodosListFilters | ((prev: TodosListFilters) => TodosListFilters)) => void
  hydrated: boolean
} {
  const [viewMode, setViewModeState] = useState<TodosViewMode>('timeline')
  const [listFilters, setListFiltersState] = useState<TodosListFilters>(DEFAULT_LIST_FILTERS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const stored = decodeStored(raw)
      if (stored?.viewMode) setViewModeState(stored.viewMode)
      if (stored?.listFilters) {
        setListFiltersState({ ...DEFAULT_LIST_FILTERS, ...stored.listFilters })
      }
      setHydrated(true)
    })
  }, [])

  useEffect(() => {
    if (!hydrated) return
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ viewMode, listFilters })
    )
  }, [hydrated, viewMode, listFilters])

  const setViewMode = useCallback((mode: TodosViewMode) => {
    setViewModeState(mode)
  }, [])

  const setListFilters = useCallback(
    (next: TodosListFilters | ((prev: TodosListFilters) => TodosListFilters)) => {
      setListFiltersState(next)
    },
    []
  )

  return { viewMode, setViewMode, listFilters, setListFilters, hydrated }
}
