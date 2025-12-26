import React, { useState } from 'react';
import {
  useGetApiTasks,
  usePostApiTasks,
  usePutApiTasksId,
  useDeleteApiTasksId,
  type Task,
  type CreateTaskRequest
} from '../gen/api';

/**
 * Task Management Component
 * Demonstrates full CRUD operations with SWR hooks
 */
export const TaskManager: React.FC = () => {
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [newTask, setNewTask] = useState<Partial<CreateTaskRequest>>({
    title: '',
    description: '',
  });

  // Fetch all tasks
  const {
    data: tasksResponse,
    error: tasksError,
    isLoading: tasksLoading,
    mutate: mutateTasks
  } = useGetApiTasks();

  const tasks = tasksResponse?.tasks ?? [];

  // Create task mutation
  const { trigger: createTask, isMutating: isCreating } = usePostApiTasks();

  // Update task mutation
  const { trigger: updateTask, isMutating: isUpdating } = usePutApiTasksId();

  // Delete task mutation
  const { trigger: deleteTask, isMutating: isDeleting } = useDeleteApiTasksId();

  const handleCreateTask = async () => {
    if (!newTask.title?.trim()) return;

    try {
      await createTask({
        data: {
          title: newTask.title,
          description: newTask.description || '',
        }
      });
      setNewTask({ title: '', description: '' });
      mutateTasks(); // Refresh the tasks list
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !editingTask.id) return;

    try {
      await updateTask({
        id: editingTask.id,
        data: {
          title: editingTask.title!,
          description: editingTask.description || '',
          status: editingTask.status!,
          priority: editingTask.priority!
        }
      });
      setEditingTask(null);
      mutateTasks(); // Refresh the tasks list
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask({ id: taskId });
      mutateTasks(); // Refresh the tasks list
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  if (tasksLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (tasksError) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <h3 className="text-red-800 font-semibold mb-2">Failed to Load Tasks</h3>
        <p className="text-red-600 text-sm">
          {tasksError.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Task Management</h2>
        <div className="text-sm text-gray-500">
          {tasks.length} task(s)
        </div>
      </div>

      {/* Create New Task */}
      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
        <h3 className="text-blue-800 font-semibold mb-3">Create New Task</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Task title..."
            value={newTask.title || ''}
            onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <textarea
            placeholder="Task description..."
            value={newTask.description || ''}
            onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
          <button
            onClick={handleCreateTask}
            disabled={!newTask.title?.trim() || isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="p-4 border rounded-lg bg-white shadow-sm">
            {editingTask?.id === task.id ? (
              // Edit mode
              <div className="space-y-3">
                <input
                  type="text"
                  value={editingTask.title || ''}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500"
                />
                <textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500"
                  rows={2}
                />
                <div className="flex gap-2">
                  <select
                    value={editingTask.status || 'pending'}
                    onChange={(e) => setEditingTask(prev => ({ ...prev, status: e.target.value as Task['status'] }))}
                    className="p-2 border rounded focus:ring-2 focus:ring-green-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select
                    value={editingTask.priority || 'medium'}
                    onChange={(e) => setEditingTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                    className="p-2 border rounded focus:ring-2 focus:ring-green-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateTask}
                    disabled={isUpdating}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingTask(null)}
                    className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{task.title}</h4>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {task.status?.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                      task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
                {task.description && (
                  <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Created: {new Date(task.createdAt).toLocaleDateString()}
                    {task.updatedAt && task.updatedAt !== task.createdAt && (
                      <span> • Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingTask(task)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      disabled={isDeleting}
                      className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No tasks found. Create your first task above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManager;