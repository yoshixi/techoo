import { renderHook, act } from '@testing-library/react-native'
import { useAutoSave, type UseAutoSaveReturn } from '../../hooks/useAutoSave'

describe('useAutoSave', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not save immediately on mount', () => {
    const onSave = jest.fn()
    renderHook(() => useAutoSave({ value: 'test', onSave }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves after debounce delay when value changes', async () => {
    const onSave = jest.fn()
    const { rerender } = renderHook(({ value }) => useAutoSave({ value, onSave }), {
      initialProps: { value: 'initial' }
    })

    rerender({ value: 'changed' })

    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(800)
    })

    expect(onSave).toHaveBeenCalledWith('changed')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('respects custom delay', async () => {
    const onSave = jest.fn()
    const { rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave, delay: 500 }),
      { initialProps: { value: 'initial' } }
    )

    rerender({ value: 'changed' })

    await act(async () => {
      jest.advanceTimersByTime(400)
    })
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('debounces multiple rapid changes', async () => {
    const onSave = jest.fn()
    const { rerender } = renderHook(({ value }) => useAutoSave({ value, onSave }), {
      initialProps: { value: 'initial' }
    })

    rerender({ value: 'change1' })
    await act(async () => {
      jest.advanceTimersByTime(400)
    })

    rerender({ value: 'change2' })
    await act(async () => {
      jest.advanceTimersByTime(400)
    })

    rerender({ value: 'change3' })
    await act(async () => {
      jest.advanceTimersByTime(800)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('change3')
  })

  it('shows pending state while debouncing', async () => {
    const onSave = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave }),
      { initialProps: { value: 'initial' } }
    )

    expect(result.current.isPending).toBe(false)

    rerender({ value: 'changed' })
    expect(result.current.isPending).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(800)
    })

    expect(result.current.isPending).toBe(false)
  })

  it('can cancel pending save', async () => {
    const onSave = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave }),
      { initialProps: { value: 'initial' } }
    )

    rerender({ value: 'changed' })
    expect(result.current.isPending).toBe(true)

    act(() => {
      result.current.cancel()
    })

    expect(result.current.isPending).toBe(false)

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(onSave).not.toHaveBeenCalled()
  })

  it('can manually trigger save', async () => {
    const onSave = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave }),
      { initialProps: { value: 'initial' } }
    )

    rerender({ value: 'changed' })

    await act(async () => {
      result.current.save()
    })

    expect(onSave).toHaveBeenCalledWith('changed')
  })

  it('does not save when disabled', async () => {
    const onSave = jest.fn()
    const { rerender } = renderHook(
      ({ value, enabled }) => useAutoSave({ value, onSave, enabled }),
      { initialProps: { value: 'initial', enabled: false } }
    )

    rerender({ value: 'changed', enabled: false })

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(onSave).not.toHaveBeenCalled()
  })

  it('handles async onSave', async () => {
    const onSave = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )
    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave({ value, onSave }),
      { initialProps: { value: 'initial' } }
    )

    rerender({ value: 'changed' })

    await act(async () => {
      jest.advanceTimersByTime(800)
    })

    expect(result.current.isSaving).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current.isSaving).toBe(false)
  })
})
