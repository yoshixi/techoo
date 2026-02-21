import { renderHook, act } from '@testing-library/react-native'
import { useTimer, type UseTimerReturn } from '../../hooks/useTimer'

describe('useTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns zero elapsed time when no start time', () => {
    const { result } = renderHook(() => useTimer())
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.formattedTime).toBe('00:00')
    expect(result.current.isRunning).toBe(false)
  })

  it('calculates elapsed time from start time', () => {
    const startTime = new Date(Date.now() - 65000) // 65 seconds ago
    const { result } = renderHook(() =>
      useTimer({ startTime: startTime.toISOString(), isActive: true })
    )

    expect(result.current.elapsedSeconds).toBe(65)
    expect(result.current.formattedTime).toBe('01:05')
    expect(result.current.isRunning).toBe(true)
  })

  it('updates elapsed time on interval when active', () => {
    const startTime = new Date(Date.now() - 10000) // 10 seconds ago
    const { result } = renderHook(() =>
      useTimer({ startTime: startTime.toISOString(), isActive: true })
    )

    expect(result.current.elapsedSeconds).toBe(10)

    // Advance time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(result.current.elapsedSeconds).toBe(15)
  })

  it('does not update when not active', () => {
    const startTime = new Date(Date.now() - 10000) // 10 seconds ago
    const { result } = renderHook(() =>
      useTimer({ startTime: startTime.toISOString(), isActive: false })
    )

    const initialElapsed = result.current.elapsedSeconds

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    // Should not have changed since isActive is false
    expect(result.current.elapsedSeconds).toBe(initialElapsed)
    expect(result.current.isRunning).toBe(false)
  })

  it('formats hours correctly', () => {
    const startTime = new Date(Date.now() - 3665000) // 1 hour, 1 minute, 5 seconds ago
    const { result } = renderHook(() =>
      useTimer({ startTime: startTime.toISOString(), isActive: true })
    )

    expect(result.current.formattedTime).toBe('01:01:05')
  })

  it('accepts Date objects as start time', () => {
    const startTime = new Date(Date.now() - 30000) // 30 seconds ago
    const { result } = renderHook(() => useTimer({ startTime, isActive: true }))

    expect(result.current.elapsedSeconds).toBe(30)
  })

  it('handles null start time', () => {
    const { result } = renderHook(() => useTimer({ startTime: null, isActive: true }))

    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
    const startTime = new Date()
    const { unmount } = renderHook(() =>
      useTimer({ startTime: startTime.toISOString(), isActive: true })
    )

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('recalculates when start time changes', () => {
    const startTime1 = new Date(Date.now() - 10000) // 10 seconds ago
    const startTime2 = new Date(Date.now() - 30000) // 30 seconds ago

    const { result, rerender } = renderHook(
      ({ startTime }) => useTimer({ startTime, isActive: true }),
      { initialProps: { startTime: startTime1.toISOString() } }
    )

    expect(result.current.elapsedSeconds).toBe(10)

    rerender({ startTime: startTime2.toISOString() })

    expect(result.current.elapsedSeconds).toBe(30)
  })
})
