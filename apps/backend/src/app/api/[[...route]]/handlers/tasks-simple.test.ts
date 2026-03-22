import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppBindings } from '../types';
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
import pino from 'pino';
import { createSqliteLibsqlTestContext, createTestRequest, createTestUser, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils';
import type { DB } from '../../../core/common.db';

type TestUser = { id: number; email: string; name: string };

// Create a test app with task routes
const createTestApp = (getUser: () => TestUser | null, getDb: () => DB) => {
  const app = new OpenAPIHono<AppBindings>();

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

  // Inject test user context (simulates JWT auth middleware)
  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }));
    c.set('requestId', 'test-request-id');
    const user = getUser();
    if (user) {
      c.set('user', user);
      c.set('db', getDb());
    }
    await next();
  });

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
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  let testUser: TestUser | null = null;

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext();
    app = createTestApp(() => testUser, () => testContext.db);
    request = createTestRequest(testContext)(app);
  });

  beforeEach(async () => {
    await testContext.reset();
    const user = await createTestUser(testContext.db);
    testUser = { id: user.id, email: user.email, name: user.name };
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.reset();
      await testContext.stop();
    }
  });

  describe('GET /tasks', () => {
    it('should return empty tasks list initially', async () => {
      const req = new Request('http://localhost/tasks');
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        tasks: [],
        total: 0
      });
    });

    it('should filter tasks by completion status', async () => {
      const createTask = async (title: string) => {
        const res = await request(new Request('http://localhost/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        }));
        expect(res.status).toBe(201);
        const { task } = await res.json();
        return task.id as number;
      };

      const incompleteTaskId = await createTask('Incomplete Task');
      const completedTaskId = await createTask('Completed Task');

      const completionTimestamp = new Date().toISOString();
      const completeRes = await request(new Request(`http://localhost/tasks/${completedTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));
      expect(completeRes.status).toBe(200);

      const completedRes = await request(new Request('http://localhost/tasks?completed=true'));
      expect(completedRes.status).toBe(200);
      const completedData = await completedRes.json();
      expect(completedData.tasks).toHaveLength(1);
      expect(completedData.tasks.every((task: { completedAt: string | null }) => task.completedAt !== null)).toBe(true);
      const completedIds = completedData.tasks.map((task: { id: number }) => task.id);
      expect(completedIds).toContain(completedTaskId);
      expect(completedIds).not.toContain(incompleteTaskId);

      const incompleteRes = await request(new Request('http://localhost/tasks?completed=false'));
      expect(incompleteRes.status).toBe(200);
      const incompleteData = await incompleteRes.json();
      expect(incompleteData.tasks).toHaveLength(1);
      expect(incompleteData.tasks.every((task: { completedAt: string | null }) => task.completedAt === null)).toBe(true);
      const incompleteIds = incompleteData.tasks.map((task: { id: number }) => task.id);
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

      const req = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });
      
      const res = await request(req);

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

      const req = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });
      
      const res = await request(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.task.title).toBe(taskData.title);
      expect(data.task.description).toBe('');
      expect(data.task.dueDate).toBeNull();
      expect(data.task.completedAt).toBeNull();
    });

    it('should reject empty title', async () => {
      const req = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '',
          description: 'Description'
        })
      });
      
      const res = await request(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Complete Task Lifecycle', () => {
    it('should complete create, read, update, delete cycle', async () => {
      // Create task
      const createReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Lifecycle Task',
          description: 'Test task lifecycle'
        })
      });
      
      const createRes = await request(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      const taskId = createData.task.id;

      // Read task
      const readReq = new Request(`http://localhost/tasks/${taskId}`);
      const readRes = await request(readReq);
      expect(readRes.status).toBe(200);
      const readData = await readRes.json();
      expect(readData.task.title).toBe('Lifecycle Task');

      // Update task
      const updateReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Lifecycle Task'
        })
      });
      
      const updateRes = await request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.task.title).toBe('Updated Lifecycle Task');

      // Delete task
      const deleteReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'DELETE'
      });
      
      const deleteRes = await request(deleteReq);
      expect(deleteRes.status).toBe(200);

      // Verify task is deleted
      const verifyReq = new Request(`http://localhost/tasks/${taskId}`);
      const verifyRes = await request(verifyReq);
      expect(verifyRes.status).toBe(404);
    });
  });

  describe('PUT /tasks/{id}', () => {
    it('should set and clear completion timestamp', async () => {
      const createReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Complete me' })
      });
      const createRes = await request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;

      const completionTimestamp = new Date().toISOString();
      const completeReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      });
      const completeRes = await request(completeReq);
      expect(completeRes.status).toBe(200);
      const completeData = await completeRes.json();
      expect(Math.floor(new Date(completeData.task.completedAt).getTime() / 1000)).toBe(
        Math.floor(new Date(completionTimestamp).getTime() / 1000)
      );

      const reopenReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: null })
      });
      const reopenRes = await request(reopenReq);
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

      const req = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      const res = await request(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.task.startAt).toBe(startAt);
      expect(data.task.title).toBe(taskData.title);
    });

    it('should update a task with startAt', async () => {
      const createReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Update start date test' })
      });
      const createRes = await request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;
      expect(task.startAt).toBeNull();

      const startAt = '2024-02-01T10:00:00.000Z';
      const updateReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt: startAt })
      });
      const updateRes = await request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.task.startAt).toBe(startAt);
    });

    it('should clear startAt when set to null', async () => {
      const startAt = '2024-03-01T08:00:00.000Z';
      const createReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Clear start date test', startAt: startAt })
      });
      const createRes = await request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;
      expect(task.startAt).toBe(startAt);

      const clearReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt: null })
      });
      const clearRes = await request(clearReq);
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

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task1Data)
      }));
      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task2Data)
      }));
      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task3Data)
      }));

      const listReq = new Request('http://localhost/tasks?sortBy=startAt');
      const listRes = await request(listReq);
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
      const createTaskReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task with timer' })
      });
      const createTaskRes = await request(createTaskReq);
      expect(createTaskRes.status).toBe(201);
      const { task } = await createTaskRes.json();
      const taskId = task.id;

      // Create an active timer for the task
      const createTimerReq = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });
      const createTimerRes = await request(createTimerReq);
      expect(createTimerRes.status).toBe(201);

      // Verify timer is active (endTime is null)
      const getTimersBeforeReq = new Request(`http://localhost/tasks/${taskId}/timers`);
      const getTimersBeforeRes = await request(getTimersBeforeReq);
      expect(getTimersBeforeRes.status).toBe(200);
      const timersBeforeData = await getTimersBeforeRes.json();
      expect(timersBeforeData.timers).toHaveLength(1);
      expect(timersBeforeData.timers[0].endTime).toBeNull();

      // Complete the task
      const completionTimestamp = new Date().toISOString();
      const completeTaskReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      });
      const completeTaskRes = await request(completeTaskReq);
      expect(completeTaskRes.status).toBe(200);

      // Verify timer is now stopped (endTime is not null)
      const getTimersAfterReq = new Request(`http://localhost/tasks/${taskId}/timers`);
      const getTimersAfterRes = await request(getTimersAfterReq);
      expect(getTimersAfterRes.status).toBe(200);
      const timersAfterData = await getTimersAfterRes.json();
      expect(timersAfterData.timers).toHaveLength(1);
      expect(timersAfterData.timers[0].endTime).not.toBeNull();
    });

    it('should stop multiple active timers when task is completed', async () => {
      // Create a task
      const createTaskReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task with multiple timers' })
      });
      const createTaskRes = await request(createTaskReq);
      expect(createTaskRes.status).toBe(201);
      const { task } = await createTaskRes.json();
      const taskId = task.id;

      // Create two active timers
      await request(new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      }));
      await request(new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          startTime: '2024-01-01T11:00:00.000Z'
        })
      }));

      // Verify both timers are active
      const getTimersBeforeRes = await request(new Request(`http://localhost/tasks/${taskId}/timers`));
      const timersBeforeData = await getTimersBeforeRes.json();
      expect(timersBeforeData.timers).toHaveLength(2);
      expect(timersBeforeData.timers.every((t: { endTime: string | null }) => t.endTime === null)).toBe(true);

      // Complete the task
      const completionTimestamp = new Date().toISOString();
      await request(new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));

      // Verify all timers are now stopped
      const getTimersAfterRes = await request(new Request(`http://localhost/tasks/${taskId}/timers`));
      const timersAfterData = await getTimersAfterRes.json();
      expect(timersAfterData.timers).toHaveLength(2);
      expect(timersAfterData.timers.every((t: { endTime: string | null }) => t.endTime !== null)).toBe(true);
    });

    it('should not affect timers of other tasks when completing a task', async () => {
      // Create two tasks
      const createTask1Res = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task 1' })
      }));
      const task1 = (await createTask1Res.json()).task;

      const createTask2Res = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task 2' })
      }));
      const task2 = (await createTask2Res.json()).task;

      // Create active timer for each task
      await request(new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task1.id,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      }));
      await request(new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task2.id,
          startTime: '2024-01-01T11:00:00.000Z'
        })
      }));

      // Complete task 1
      const completionTimestamp = new Date().toISOString();
      await request(new Request(`http://localhost/tasks/${task1.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));

      // Task 1's timer should be stopped
      const task1TimersRes = await request(new Request(`http://localhost/tasks/${task1.id}/timers`));
      const task1Timers = (await task1TimersRes.json()).timers;
      expect(task1Timers[0].endTime).not.toBeNull();

      // Task 2's timer should still be active
      const task2TimersRes = await request(new Request(`http://localhost/tasks/${task2.id}/timers`));
      const task2Timers = (await task2TimersRes.json()).timers;
      expect(task2Timers[0].endTime).toBeNull();
    });
  });
});
