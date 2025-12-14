import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
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

// Mock the database connection
vi.mock('../../../core/common.db', () => {
  return {
    getDb: () => global.testDb,
    createId: () => {
      const { v7: uuidv7 } = require('uuid');
      return uuidv7();
    }
  };
});

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
    (global as any).testDb = testContext.db;
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
      expect(data.task.status).toBe('To Do');
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
      expect(data.task.status).toBe('To Do');
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
          title: 'Updated Lifecycle Task',
          status: 'Done'
        })
      });
      
      const updateRes = await app.request(updateReq);
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.task.title).toBe('Updated Lifecycle Task');
      expect(updateData.task.status).toBe('Done');

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
});