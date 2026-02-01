import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { v7 as uuidv7 } from 'uuid';
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

// Create a test app with timer and task routes
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
  let app: OpenAPIHono;
  let sampleTaskId: string;

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext();
    // Set the global test database for the mock to use
    (globalThis as TestGlobal).testDb = testContext.db;
    app = createTestApp();
  });

  beforeEach(async () => {
    await testContext.reset();

    // Create a sample task for timer tests
    const createTaskReq = createAuthRequest('http://localhost/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Sample Task for Timers',
        description: 'This task will have timers'
      })
    });

    const createTaskRes = await app.request(createTaskReq);
    expect(createTaskRes.status).toBe(201);
    const taskData = await createTaskRes.json();
    sampleTaskId = taskData.task.id;
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.reset();
    }
  });

  describe('GET /timers', () => {
    it('should return empty timers list initially', async () => {
      const req = createAuthRequest('http://localhost/timers');
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        timers: [],
        total: 0
      });
    });

    it('should filter timers by taskIds query', async () => {
      const secondTaskReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Second Task'
        })
      });
      const secondTaskRes = await app.request(secondTaskReq);
      const secondTaskData = await secondTaskRes.json();
      const secondTaskId = secondTaskData.task.id;

      const createTimerReqA = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: sampleTaskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });
      const createTimerReqB = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: secondTaskId,
          startTime: '2024-01-01T11:00:00.000Z'
        })
      });

      await app.request(createTimerReqA);
      await app.request(createTimerReqB);

      const query = new URLSearchParams([['taskIds', sampleTaskId]]);
      const req = createAuthRequest(`http://localhost/timers?${query.toString()}`);
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timers).toHaveLength(1);
      expect(data.timers[0].taskId).toBe(sampleTaskId);
    });

    it('should return timers for multiple taskIds', async () => {
      const secondTaskReq = createAuthRequest('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Second Task'
        })
      });
      const secondTaskRes = await app.request(secondTaskReq);
      const secondTaskData = await secondTaskRes.json();
      const secondTaskId = secondTaskData.task.id;

      await app.request(
        createAuthRequest('http://localhost/timers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: sampleTaskId,
            startTime: '2024-01-01T10:00:00.000Z'
          })
        })
      );
      await app.request(
        createAuthRequest('http://localhost/timers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: secondTaskId,
            startTime: '2024-01-01T11:00:00.000Z'
          })
        })
      );

      const query = new URLSearchParams([
        ['taskIds', sampleTaskId],
        ['taskIds', secondTaskId]
      ]);
      const req = createAuthRequest(`http://localhost/timers?${query.toString()}`);
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timers).toHaveLength(2);
      const taskIds = data.timers.map((timer: { taskId: string }) => timer.taskId);
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

      const req = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timerData)
      });

      const res = await app.request(req);

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
      const req = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: '01916b3e-1234-7890-abcd-ef1234567890',  // Valid UUID v7 format
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });

      const res = await app.request(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
      expect(data.message).toBe('Task not found');
    });
  });

  describe('GET /tasks/{taskId}/timers', () => {
    it('should return empty timers list for task with no timers', async () => {
      const req = createAuthRequest(`http://localhost/tasks/${sampleTaskId}/timers`);
      const res = await app.request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        timers: [],
        total: 0
      });
    });

    it('should return timers for specific task', async () => {
      // Create a timer for the task
      const createTimerReq = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: sampleTaskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });

      await app.request(createTimerReq);

      // Get timers for the task
      const getTimersReq = createAuthRequest(`http://localhost/tasks/${sampleTaskId}/timers`);
      const res = await app.request(getTimersReq);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timers).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.timers[0].taskId).toBe(sampleTaskId);
    });

    it('should return 404 for non-existent task', async () => {
      const req = createAuthRequest('http://localhost/tasks/01916b3e-1234-7890-abcd-ef1234567890/timers');  // Valid UUID v7 format
      const res = await app.request(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
      expect(data.message).toBe('Task not found');
    });
  });

  describe('Complete Timer Lifecycle', () => {
    it('should complete create, update, and delete cycle', async () => {
      // Create timer
      const createReq = createAuthRequest('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: sampleTaskId,
          startTime: '2024-01-01T10:00:00.000Z'
        })
      });

      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      const timerId = createData.timer.id;

      // Read timer
      const readReq = createAuthRequest(`http://localhost/timers/${timerId}`);
      const readRes = await app.request(readReq);
      expect(readRes.status).toBe(200);
      const readData = await readRes.json();
      expect(readData.timer.id).toBe(timerId);
      expect(readData.timer.endTime).toBeNull();

      // Update timer (set end time)
      const updateReq = createAuthRequest(`http://localhost/timers/${timerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endTime: '2024-01-01T10:30:00.000Z'
        })
      });

      const updateRes = await app.request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.timer.endTime).toBe('2024-01-01T10:30:00.000Z');

      // Delete timer
      const deleteReq = createAuthRequest(`http://localhost/timers/${timerId}`, {
        method: 'DELETE'
      });

      const deleteRes = await app.request(deleteReq);
      expect(deleteRes.status).toBe(200);

      // Verify timer is deleted
      const verifyReq = createAuthRequest(`http://localhost/timers/${timerId}`);
      const verifyRes = await app.request(verifyReq);
      expect(verifyRes.status).toBe(404);
    });
  });
});
