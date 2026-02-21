import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppBindings } from '../types';
import {
  listTimersRoute,
  getTaskTimersRoute,
  getTimerRoute,
  createTimerRoute,
  updateTimerRoute,
  deleteTimerRoute
} from '../routes/timers';
import {
  listTimersHandler,
  getTaskTimersHandler,
  getTimerHandler,
  createTimerHandler,
  updateTimerHandler,
  deleteTimerHandler
} from './timers';
import { createTaskRoute } from '../routes/tasks';
import { createTaskHandler } from './tasks';
import { createSqliteLibsqlTestContext, createTestRequest, createTestUser, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils';

type TestUser = { id: number; email: string; name: string };

// Create a test app with timer and task routes
const createTestApp = (getUser: () => TestUser | null) => {
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
    const user = getUser();
    if (user) {
      c.set('user', user);
    }
    await next();
  });

  // Register timer routes with handlers
  app.openapi(listTimersRoute, listTimersHandler);
  app.openapi(getTaskTimersRoute, getTaskTimersHandler);
  app.openapi(getTimerRoute, getTimerHandler);
  app.openapi(createTimerRoute, createTimerHandler);
  app.openapi(updateTimerRoute, updateTimerHandler);
  app.openapi(deleteTimerRoute, deleteTimerHandler);

  // Also register task creation for test setup
  app.openapi(createTaskRoute, createTaskHandler);

  return app;
};

describe('Timer Handlers (Simplified)', () => {
  let testContext: SqliteLibsqlTestContext;
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  let sampleTaskId: number;
  let testUser: TestUser | null = null;

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext();
    app = createTestApp(() => testUser);
    request = createTestRequest(testContext)(app);
  });

  beforeEach(async () => {
    await testContext.reset();
    const user = await createTestUser(testContext.db);
    testUser = { id: user.id, email: user.email, name: user.name };

    // Create a sample task for timer tests
    const createTaskReq = new Request('http://localhost/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Sample Task for Timers',
        description: 'This task will have timers'
      })
    });
    
    const createTaskRes = await request(createTaskReq);
    const taskData = await createTaskRes.json();
    sampleTaskId = taskData.task.id;
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.reset();
      await testContext.stop();
    }
  });

  describe('GET /timers', () => {
    it('should return empty timers list initially', async () => {
      const req = new Request('http://localhost/timers');
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        timers: [],
        total: 0
      });
    });

    it('should filter timers by taskIds query', async () => {
      const secondTaskReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Second Task'
        })
      });
      const secondTaskRes = await request(secondTaskReq);
      const secondTaskData = await secondTaskRes.json();
      const secondTaskId = secondTaskData.task.id;

      const createTimerReqA = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: sampleTaskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });
      const createTimerReqB = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: secondTaskId,
          startTime: '2024-01-01T11:00:00.000Z'
        })
      });

      await request(createTimerReqA);
      await request(createTimerReqB);

      const query = new URLSearchParams([['taskIds', String(sampleTaskId)]]);
      const req = new Request(`http://localhost/timers?${query.toString()}`);
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timers).toHaveLength(1);
      expect(data.timers[0].taskId).toBe(sampleTaskId);
    });

    it('should return timers for multiple taskIds', async () => {
      const secondTaskReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Second Task'
        })
      });
      const secondTaskRes = await request(secondTaskReq);
      const secondTaskData = await secondTaskRes.json();
      const secondTaskId = secondTaskData.task.id;

      await request(
        new Request('http://localhost/timers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: sampleTaskId,
            startTime: '2024-01-01T10:00:00.000Z'
          })
        })
      );
      await request(
        new Request('http://localhost/timers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: secondTaskId,
            startTime: '2024-01-01T11:00:00.000Z'
          })
        })
      );

      const query = new URLSearchParams([
        ['taskIds', String(sampleTaskId)],
        ['taskIds', String(secondTaskId)]
      ]);
      const req = new Request(`http://localhost/timers?${query.toString()}`);
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timers).toHaveLength(2);
      const taskIds = data.timers.map((timer: { taskId: number }) => timer.taskId);
      expect(taskIds).toContain(sampleTaskId);
      expect(taskIds).toContain(secondTaskId);
    });
  });

  describe('POST /timers', () => {
    it('should create a new timer with valid data', async () => {
      const timerData = {
        taskId: sampleTaskId,
        startTime: '2024-01-01T10:00:00.000Z'
      };

      const req = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timerData)
      });

      const res = await request(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.timer.taskId).toBe(timerData.taskId);
      expect(data.timer.startTime).toBe(timerData.startTime);
      expect(data.timer.endTime).toBeNull();
      expect(data.timer.id).toBeTruthy();
      expect(data.timer.createdAt).toBeTruthy();
      expect(data.timer.updatedAt).toBeTruthy();
    });

    it('should reject timer for non-existent task', async () => {
      const req = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 999999,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });

      const res = await request(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
      expect(data.message).toBe('Task not found');
    });
  });

  describe('GET /tasks/{taskId}/timers', () => {
    it('should return empty timers list for task with no timers', async () => {
      const req = new Request(`http://localhost/tasks/${sampleTaskId}/timers`);
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        timers: [],
        total: 0
      });
    });

    it('should return timers for specific task', async () => {
      // Create a timer for the task
      const createTimerReq = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: sampleTaskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });

      await request(createTimerReq);

      // Get timers for the task
      const getTimersReq = new Request(`http://localhost/tasks/${sampleTaskId}/timers`);
      const res = await request(getTimersReq);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timers).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.timers[0].taskId).toBe(sampleTaskId);
    });

    it('should return 404 for non-existent task', async () => {
      const req = new Request('http://localhost/tasks/999999/timers');
      const res = await request(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
      expect(data.message).toBe('Task not found');
    });
  });

  describe('Complete Timer Lifecycle', () => {
    it('should complete create, update, and delete cycle', async () => {
      // Create timer
      const createReq = new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: sampleTaskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });
      
      const createRes = await request(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      const timerId = createData.timer.id;

      // Read timer
      const readReq = new Request(`http://localhost/timers/${timerId}`);
      const readRes = await request(readReq);
      expect(readRes.status).toBe(200);
      const readData = await readRes.json();
      expect(readData.timer.id).toBe(timerId);
      expect(readData.timer.endTime).toBeNull();

      // Update timer (set end time)
      const updateReq = new Request(`http://localhost/timers/${timerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endTime: '2024-01-01T10:30:00.000Z'
        })
      });
      
      const updateRes = await request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.timer.endTime).toBe('2024-01-01T10:30:00.000Z');

      // Delete timer
      const deleteReq = new Request(`http://localhost/timers/${timerId}`, {
        method: 'DELETE'
      });
      
      const deleteRes = await request(deleteReq);
      expect(deleteRes.status).toBe(200);

      // Verify timer is deleted
      const verifyReq = new Request(`http://localhost/timers/${timerId}`);
      const verifyRes = await request(verifyReq);
      expect(verifyRes.status).toBe(404);
    });
  });
});
