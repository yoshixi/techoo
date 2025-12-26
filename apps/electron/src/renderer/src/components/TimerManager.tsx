import React, { useState } from 'react';
import {
  useGetApiTimers,
  usePostApiTimers,
  useGetApiTasksTaskIdTimers
} from '../gen/api';

/**
 * Timer Management Component
 * Demonstrates timer-related API integration
 */
export const TimerManager: React.FC<{ taskId?: string }> = ({ taskId }) => {
  const [isStarting, setIsStarting] = useState(false);

  // Fetch timers - call both hooks but enable only the relevant one
  const {
    data: allTimersData,
    error: allTimersError,
    isLoading: allTimersLoading,
    mutate: mutateAllTimers
  } = useGetApiTimers({
    swr: {
      enabled: !taskId
    }
  });

  const {
    data: taskTimersData,
    error: taskTimersError,
    isLoading: taskTimersLoading,
    mutate: mutateTaskTimers
  } = useGetApiTasksTaskIdTimers(taskId ?? '', {
    swr: {
      enabled: !!taskId
    }
  });

  const timersData = taskId ? taskTimersData : allTimersData;
  const timers = timersData?.timers ?? [];
  const timersError = taskId ? taskTimersError : allTimersError;
  const timersLoading = taskId ? taskTimersLoading : allTimersLoading;
  const mutateTimers = taskId ? mutateTaskTimers : mutateAllTimers;

  // Start timer mutation
  const { trigger: createTimer, isMutating: isCreatingTimer } = usePostApiTimers();

  const handleStartTimer = async (forTaskId: string) => {
    if (!forTaskId) return;

    setIsStarting(true);
    try {
      await createTimer({
        taskId: forTaskId,
        startTime: new Date().toISOString()
      });
      mutateTimers(); // Refresh the timers list
    } catch (error) {
      console.error('Failed to start timer:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (timersLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (timersError) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <h3 className="text-red-800 font-semibold mb-2">Failed to Load Timers</h3>
        <p className="text-red-600 text-sm">
          {timersError.error || 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {taskId ? 'Task Timers' : 'All Timers'}
        </h3>
        <div className="text-sm text-gray-500">
          {timers.length} timer(s)
        </div>
      </div>

      {/* Start Timer Button (only show if taskId is provided) */}
      {taskId && (
        <button
          onClick={() => handleStartTimer(taskId)}
          disabled={isStarting || isCreatingTimer}
          className="w-full p-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStarting || isCreatingTimer ? 'Starting Timer...' : '⏱️ Start New Timer'}
        </button>
      )}

      {/* Timers List */}
      <div className="space-y-3">
        {timers.map((timer) => (
          <div key={timer.id} className="p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${timer.endTime ? 'bg-gray-400' : 'bg-green-500 animate-pulse'
                    }`}></span>
                  <span className="font-medium">
                    {timer.endTime ? 'Completed' : 'Running'}
                  </span>
                  <span className="text-sm text-gray-500">
                    Task ID: {timer.taskId}
                  </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Started:</strong> {new Date(timer.startTime).toLocaleString()}
                  </p>
                  {timer.endTime && (
                    <p>
                      <strong>Ended:</strong> {new Date(timer.endTime).toLocaleString()}
                    </p>
                  )}
                  <p>
                    <strong>Duration:</strong> {formatDuration(timer.startTime, timer.endTime)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {formatDuration(timer.startTime, timer.endTime)}
                </div>
                {!timer.endTime && (
                  <div className="text-xs text-green-600">Active</div>
                )}
              </div>
            </div>
          </div>
        ))}

        {timers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No timers found.</p>
            {taskId && (
              <p className="text-sm mt-1">Start your first timer for this task!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimerManager;
