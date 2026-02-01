import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { v7 as uuidv7 } from 'uuid';
import {
  listTasksRoute,
  getTaskRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute
} from '../routes/tasks';
import {
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler
} from './tasks';
import {
  createTimerRoute,
  getTaskTimersRoute
} from '../routes/timers';
import {
  createTimerHandler,
  getTaskTimersHandler
} from './timers';
import { authMiddleware } from '../middleware/auth';
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils';

type TestGlobal = typeof globalThis & { testDb?: SqliteLibsqlTestContext['db'] };

// Mock Clerk's verifyToken to return a test user
// Note: vi.mock is hoisted, so we use literal values here
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn().mockResolvedValue({
    sub: 'test-clerk-user-id',
    sid: 'test-session-id',
    email: 'test@example.com'
  })
}));

// Mock the database connection
vi.mock('../../../core/common.db', () => ({
  getDb: () => (globalThis as TestGlobal).testDb!,
  createId: () => {
    return uuidv7();
  }
}));

// Set CLERK_SECRET_KEY for tests so auth middleware runs normally
process.env.CLERK_SECRET_KEY = 'test-secret-key';

// Helper to create request with auth header
const createAuthRequest = (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer test-token');
  return new Request(url, { ...options, headers });
};

// Create a test app with task routes
const createTestApp = () => {
  const app = new OpenAPIHono();

  // Add CORS middleware like in the main app
  app.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (c.req.method === 'OPTIONS') {
      return c.text('', 200);
    }

    await next();
  });

  // Add auth middleware
  app.use('/*', authMiddleware);

  // Register routes with handlers
  app.openapi(listTasksRoute, listTasksHandler);
  app.openapi(getTaskRoute, getTaskHandler);
  app.openapi(createTaskRoute, createTaskHandler);
  app.openapi(updateTaskRoute, updateTaskHandler);
  app.openapi(deleteTaskRoute, deleteTaskHandler);

  // Register timer routes for integration tests
  app.openapi(createTimerRoute, createTimerHandler);
  app.openapi(getTaskTimersRoute, getTaskTimersHandler);

  return app;
};

describe('Task Handlers (Simplified)', () => {
  let testContext: SqliteLibsqlTestContext;
  let app: OpenAPIHono;

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext();
    // Set the global test database for the mock to use
    (globalThis as TestGlobal).testDb = testContext.db;
    app = createTestApp();
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.reset();
    }
  });

  describe('GET /tasks', () => {
    it('should return empty tasks list initially', async () => {
      const req = createAuthRequest('http://localhost/tasks');
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        tasks: [],
        total: 0
      });
    });

    it('should filter tasks by completion status', async () => {
      const createTask = async (title: string) => {
        const res = await app.request(createAuthRequest('http://localhost/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        }));
        expect(res.status).toBe(201);
        const { task } = await res.json();
        return task.id as string;
      };

      const incompleteTaskId = await createTask('Incomplete Task');
      const completedTaskId = await createTask('Completed Task');

      const completionTimestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      const completeRes = await app.request(createAuthRequest(`http://localhost/tasks/${completedTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));
      expect(completeRes.status).toBe(200);

      const completedRes = await app.request(createAuthRequest('http://localhost/tasks?completed=true'));
      expect(completedRes.status).toBe(200);
      const completedData = await completedRes.json();
      expect(completedData.tasks).toHaveLength(1);
      expect(completedData.tasks.every((task: { completedAt: string | null }) => task.completedAt !== null)).toBe(true);
      const completedIds = completedData.tasks.map((task: { id: string }) => task.id);
      expect(completedIds).toContain(completedTaskId);
      expect(completedIds).not.toContain(incompleteTaskId);

      const incompleteRes = await app.request(createAuthRequest('http://localhost/tasks?completed=false'));
      expect(incompleteRes.status).toBe(200);
      const incompleteData = await incompleteRes.json();
      expect(incompleteData.tasks).toHaveLength(1);
      expect(incompleteData.tasks.every((task: { completedAt: string | null }) => task.completedAt === null)).toBe(true);
      const incompleteIds = incompleteData.tasks.map((task: { id: string }) => task.id);
      expect(incompleteIds).toContain(incompleteTaskId);
      expect(incompleteIds).not.toContain(completedTaskId);
    });
  });

  describe('POST /tasks', () => {
    it('should create a new task with valid data', async () => {
      const taskData = {
        title: 'New Task',
        description: 'New Task Description',
        dueDate: '2024-12-31T23:59:59.000Z'
      };

      const req = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      const res = await app.request(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.task.title).toBe(taskData.title);
      expect(data.task.description).toBe(taskData.description);
      expect(data.task.dueDate).toBe(taskData.dueDate);
      expect(data.task.completedAt).toBeNull();
      expect(data.task.id).toBeTruthy();
      expect(data.task.createdAt).toBeTruthy();
      expect(data.task.updatedAt).toBeTruthy();
    });

    it('should create a task with minimal data', async () => {
      const taskData = {
        title: 'Minimal Task'
      };

      const req = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      const res = await app.request(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.task.title).toBe(taskData.title);
      expect(data.task.description).toBe('');
      expect(data.task.dueDate).toBeNull();
      expect(data.task.completedAt).toBeNull();
    });

    it('should reject empty title', async () => {
      const req = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '',
          description: 'Description'
        })
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Complete Task Lifecycle', () => {
    it('should complete create, read, update, delete cycle', async () => {
      // Create task
      const createReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Lifecycle Task',
          description: 'Test task lifecycle'
        })
      });

      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      const taskId = createData.task.id;

      // Read task
      const readReq = createAuthRequest(`http://localhost/tasks/${taskId}`);
      const readRes = await app.request(readReq);
      expect(readRes.status).toBe(200);
      const readData = await readRes.json();
      expect(readData.task.title).toBe('Lifecycle Task');

      // Update task
      const updateReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Lifecycle Task'
        })
      });

      const updateRes = await app.request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.task.title).toBe('Updated Lifecycle Task');

      // Delete task
      const deleteReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'DELETE'
      });

      const deleteRes = await app.request(deleteReq);
      expect(deleteRes.status).toBe(200);

      // Verify task is deleted
      const verifyReq = createAuthRequest(`http://localhost/tasks/${taskId}`);
      const verifyRes = await app.request(verifyReq);
      expect(verifyRes.status).toBe(404);
    });
  });

  describe('PUT /tasks/{id}', () => {
    it('should set and clear completion timestamp', async () => {
      const createReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Complete me' })
      });
      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;

      const completionTimestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      const completeReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      });
      const completeRes = await app.request(completeReq);
      expect(completeRes.status).toBe(200);
      const completeData = await completeRes.json();
      expect(completeData.task.completedAt).toBe(completionTimestamp);

      const reopenReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: null })
      });
      const reopenRes = await app.request(reopenReq);
      expect(reopenRes.status).toBe(200);
      const reopenData = await reopenRes.json();
      expect(reopenData.task.completedAt).toBeNull();
    });
  });

  describe('Start Date Functionality', () => {
    it('should create a task with startAt', async () => {
      const startAt = '2024-01-15T09:00:00.000Z';
      const taskData = {
        title: 'Task with start date',
        description: 'This task has a start date',
        startAt: startAt
      };

      const req = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      const res = await app.request(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.task.startAt).toBe(startAt);
      expect(data.task.title).toBe(taskData.title);
    });

    it('should update a task with startAt', async () => {
      const createReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Update start date test' })
      });
      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;
      expect(task.startAt).toBeNull();

      const startAt = '2024-02-01T10:00:00.000Z';
      const updateReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt: startAt })
      });
      const updateRes = await app.request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.task.startAt).toBe(startAt);
    });

    it('should clear startAt when set to null', async () => {
      const startAt = '2024-03-01T08:00:00.000Z';
      const createReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Clear start date test', startAt: startAt })
      });
      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;
      expect(task.startAt).toBe(startAt);

      const clearReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt: null })
      });
      const clearRes = await app.request(clearReq);
      expect(clearRes.status).toBe(200);
      const clearData = await clearRes.json();
      expect(clearData.task.startAt).toBeNull();
    });

    it('should sort tasks by startAt', async () => {
      const task1Data = {
        title: 'Task 1',
        startAt: '2024-01-03T09:00:00.000Z'
      };
      const task2Data = {
        title: 'Task 2',
        startAt: '2024-01-01T09:00:00.000Z'
      };
      const task3Data = {
        title: 'Task 3',
        startAt: '2024-01-02T09:00:00.000Z'
      };

      await app.request(createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task1Data)
      }));
      await app.request(createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task2Data)
      }));
      await app.request(createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task3Data)
      }));

      const listReq = createAuthRequest('http://localhost/tasks?sortBy=startAt');
      const listRes = await app.request(listReq);
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.tasks.length).toBeGreaterThanOrEqual(3);

      const sortedTasks = listData.tasks.filter((t: { startAt: string | null }) => t.startAt !== null);
      expect(sortedTasks[0].title).toBe('Task 1');
      expect(sortedTasks[1].title).toBe('Task 3');
      expect(sortedTasks[2].title).toBe('Task 2');
    });
  });

  describe('Task Completion with Active Timers', () => {
    it('should stop active timers when task is completed', async () => {
      // Create a task
      const createTaskReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task with timer' })
      });
      const createTaskRes = await app.request(createTaskReq);
      expect(createTaskRes.status).toBe(201);
      const { task } = await createTaskRes.json();
      const taskId = task.id;

      // Create an active timer for the task
      const createTimerReq = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });
      const createTimerRes = await app.request(createTimerReq);
      expect(createTimerRes.status).toBe(201);

      // Verify timer is active (endTime is null)
      const getTimersBeforeReq = createAuthRequest(`http://localhost/tasks/${taskId}/timers`);
      const getTimersBeforeRes = await app.request(getTimersBeforeReq);
      expect(getTimersBeforeRes.status).toBe(200);
      const timersBeforeData = await getTimersBeforeRes.json();
      expect(timersBeforeData.timers).toHaveLength(1);
      expect(timersBeforeData.timers[0].endTime).toBeNull();

      // Complete the task
      const completionTimestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      const completeTaskReq = createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      });
      const completeTaskRes = await app.request(completeTaskReq);
      expect(completeTaskRes.status).toBe(200);

      // Verify timer is now stopped (endTime is not null)
      const getTimersAfterReq = createAuthRequest(`http://localhost/tasks/${taskId}/timers`);
      const getTimersAfterRes = await app.request(getTimersAfterReq);
      expect(getTimersAfterRes.status).toBe(200);
      const timersAfterData = await getTimersAfterRes.json();
      expect(timersAfterData.timers).toHaveLength(1);
      expect(timersAfterData.timers[0].endTime).not.toBeNull();
    });

    it('should stop multiple active timers when task is completed', async () => {
      // Create a task
      const createTaskReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task with multiple timers' })
      });
      const createTaskRes = await app.request(createTaskReq);
      expect(createTaskRes.status).toBe(201);
      const { task } = await createTaskRes.json();
      const taskId = task.id;

      // Create two active timers
      await app.request(createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      }));
      await app.request(createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          startTime: '2024-01-01T11:00:00.000Z'
        })
      }));

      // Verify both timers are active
      const getTimersBeforeRes = await app.request(createAuthRequest(`http://localhost/tasks/${taskId}/timers`));
      const timersBeforeData = await getTimersBeforeRes.json();
      expect(timersBeforeData.timers).toHaveLength(2);
      expect(timersBeforeData.timers.every((t: { endTime: string | null }) => t.endTime === null)).toBe(true);

      // Complete the task
      const completionTimestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      await app.request(createAuthRequest(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));

      // Verify all timers are now stopped
      const getTimersAfterRes = await app.request(createAuthRequest(`http://localhost/tasks/${taskId}/timers`));
      const timersAfterData = await getTimersAfterRes.json();
      expect(timersAfterData.timers).toHaveLength(2);
      expect(timersAfterData.timers.every((t: { endTime: string | null }) => t.endTime !== null)).toBe(true);
    });

    it('should not affect timers of other tasks when completing a task', async () => {
      // Create two tasks
      const createTask1Res = await app.request(createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task 1' })
      }));
      const task1 = (await createTask1Res.json()).task;

      const createTask2Res = await app.request(createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task 2' })
      }));
      const task2 = (await createTask2Res.json()).task;

      // Create active timer for each task
      await app.request(createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task1.id,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      }));
      await app.request(createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task2.id,
          startTime: '2024-01-01T11:00:00.000Z'
        })
      }));

      // Complete task 1
      const completionTimestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      await app.request(createAuthRequest(`http://localhost/tasks/${task1.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));

      // Task 1's timer should be stopped
      const task1TimersRes = await app.request(createAuthRequest(`http://localhost/tasks/${task1.id}/timers`));
      const task1Timers = (await task1TimersRes.json()).timers;
      expect(task1Timers[0].endTime).not.toBeNull();

      // Task 2's timer should still be active
      const task2TimersRes = await app.request(createAuthRequest(`http://localhost/tasks/${task2.id}/timers`));
      const task2Timers = (await task2TimersRes.json()).timers;
      expect(task2Timers[0].endTime).toBeNull();
    });
  });
});
