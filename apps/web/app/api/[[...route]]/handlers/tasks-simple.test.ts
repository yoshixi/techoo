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
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils';

type TestGlobal = typeof globalThis & { testDb?: SqliteLibsqlTestContext['db'] };

// Mock the database connection
vi.mock('../../../core/common.db', () => ({
  getDb: () => (globalThis as TestGlobal).testDb!,
  createId: () => {
    return uuidv7();
  }
}));

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

  // Register routes with handlers
  app.openapi(listTasksRoute, listTasksHandler);
  app.openapi(getTaskRoute, getTaskHandler);
  app.openapi(createTaskRoute, createTaskHandler);
  app.openapi(updateTaskRoute, updateTaskHandler);
  app.openapi(deleteTaskRoute, deleteTaskHandler);

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
      const req = new Request('http://localhost/tasks');
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
        const res = await app.request(new Request('http://localhost/tasks', {
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
      const completeRes = await app.request(new Request(`http://localhost/tasks/${completedTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      }));
      expect(completeRes.status).toBe(200);

      const completedRes = await app.request(new Request('http://localhost/tasks?completed=true'));
      expect(completedRes.status).toBe(200);
      const completedData = await completedRes.json();
      expect(completedData.tasks).toHaveLength(1);
      expect(completedData.tasks.every((task: { completedAt: string | null }) => task.completedAt !== null)).toBe(true);
      const completedIds = completedData.tasks.map((task: { id: string }) => task.id);
      expect(completedIds).toContain(completedTaskId);
      expect(completedIds).not.toContain(incompleteTaskId);

      const incompleteRes = await app.request(new Request('http://localhost/tasks?completed=false'));
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

      const req = new Request('http://localhost/tasks', {
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

      const req = new Request('http://localhost/tasks', {
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
      
      const res = await app.request(req);
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
      
      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      const taskId = createData.task.id;

      // Read task
      const readReq = new Request(`http://localhost/tasks/${taskId}`);
      const readRes = await app.request(readReq);
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
      
      const updateRes = await app.request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.task.title).toBe('Updated Lifecycle Task');

      // Delete task
      const deleteReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'DELETE'
      });
      
      const deleteRes = await app.request(deleteReq);
      expect(deleteRes.status).toBe(200);

      // Verify task is deleted
      const verifyReq = new Request(`http://localhost/tasks/${taskId}`);
      const verifyRes = await app.request(verifyReq);
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
      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;

      const completionTimestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      const completeReq = new Request(`http://localhost/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: completionTimestamp })
      });
      const completeRes = await app.request(completeReq);
      expect(completeRes.status).toBe(200);
      const completeData = await completeRes.json();
      expect(completeData.task.completedAt).toBe(completionTimestamp);

      const reopenReq = new Request(`http://localhost/tasks/${taskId}`, {
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

      const req = new Request('http://localhost/tasks', {
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
      const createReq = new Request('http://localhost/tasks', {
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
      const updateReq = new Request(`http://localhost/tasks/${taskId}`, {
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
      const createReq = new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Clear start date test', startAt: startAt })
      });
      const createRes = await app.request(createReq);
      expect(createRes.status).toBe(201);
      const { task } = await createRes.json();
      const taskId = task.id;
      expect(task.startAt).toBe(startAt);

      const clearReq = new Request(`http://localhost/tasks/${taskId}`, {
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

      await app.request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task1Data)
      }));
      await app.request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task2Data)
      }));
      await app.request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task3Data)
      }));

      const listReq = new Request('http://localhost/tasks?sortBy=startAt');
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
});
