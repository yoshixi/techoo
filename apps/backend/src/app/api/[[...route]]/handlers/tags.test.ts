import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppBindings } from '../types';
import {
  listTagsRoute,
  getTagRoute,
  createTagRoute,
  updateTagRoute,
  deleteTagRoute
} from '../routes/tags';
import {
  listTagsHandler,
  getTagHandler,
  createTagHandler,
  updateTagHandler,
  deleteTagHandler
} from './tags';
import {
  listTasksRoute,
  createTaskRoute,
  updateTaskRoute
} from '../routes/tasks';
import {
  listTasksHandler,
  createTaskHandler,
  updateTaskHandler
} from './tasks';
import { createSqliteLibsqlTestContext, createTestRequest, createTestUser, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils';

type TestUser = { id: number; email: string; name: string };

// Create a test app with tag and task routes
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

  // Register tag routes
  app.openapi(listTagsRoute, listTagsHandler);
  app.openapi(getTagRoute, getTagHandler);
  app.openapi(createTagRoute, createTagHandler);
  app.openapi(updateTagRoute, updateTagHandler);
  app.openapi(deleteTagRoute, deleteTagHandler);

  // Register task routes for integration tests
  app.openapi(listTasksRoute, listTasksHandler);
  app.openapi(createTaskRoute, createTaskHandler);
  app.openapi(updateTaskRoute, updateTaskHandler);

  return app;
};

describe('Tag Handlers', () => {
  let testContext: SqliteLibsqlTestContext;
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
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
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.reset();
      await testContext.stop();
    }
  });

  describe('POST /tags - Create Tag', () => {
    it('should create a new tag', async () => {
      const req = new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      });
      const res = await request(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.tag).toBeDefined();
      expect(data.tag.name).toBe('urgent');
      expect(data.tag.id).toBeDefined();
      expect(data.tag.createdAt).toBeDefined();
      expect(data.tag.updatedAt).toBeDefined();
    });

    it('should reject duplicate tag names', async () => {
      // Create first tag
      await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));

      // Try to create duplicate
      const res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Bad request');
      expect(data.message).toContain('already exists');
    });

    it('should reject empty tag names', async () => {
      const res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' })
      }));

      expect(res.status).toBe(400);
    });

    it('should reject tag names longer than 50 characters', async () => {
      const longName = 'a'.repeat(51);
      const res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName })
      }));

      expect(res.status).toBe(400);
    });
  });

  describe('GET /tags - List Tags', () => {
    it('should return empty tags list initially', async () => {
      const req = new Request('http://localhost/tags');
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        tags: [],
        total: 0
      });
    });

    it('should return all tags for the user', async () => {
      // Create multiple tags
      const tagNames = ['urgent', 'work', 'personal'];
      for (const name of tagNames) {
        await request(new Request('http://localhost/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        }));
      }

      const res = await request(new Request('http://localhost/tags'));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.total).toBe(3);
      expect(data.tags).toHaveLength(3);
      expect(data.tags.map((t: any) => t.name).sort()).toEqual(['personal', 'urgent', 'work']);
    });
  });

  describe('GET /tags/{id} - Get Tag', () => {
    it('should return a specific tag', async () => {
      // Create a tag
      const createRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: createdTag } = await createRes.json();

      // Get the tag
      const res = await request(new Request(`http://localhost/tags/${createdTag.id}`));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.tag.id).toBe(createdTag.id);
      expect(data.tag.name).toBe('urgent');
    });

    it('should return 404 for non-existent tag', async () => {
      const fakeId = 999999;
      const res = await request(new Request(`http://localhost/tags/${fakeId}`));

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
    });
  });

  describe('PUT /tags/{id} - Update Tag', () => {
    it('should update a tag name', async () => {
      // Create a tag
      const createRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: createdTag } = await createRes.json();

      // Update the tag
      const updateRes = await request(new Request(`http://localhost/tags/${createdTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'high-priority' })
      }));

      expect(updateRes.status).toBe(200);
      const data = await updateRes.json();
      expect(data.tag.name).toBe('high-priority');
      expect(data.tag.id).toBe(createdTag.id);
    });

    it('should reject update to duplicate name', async () => {
      // Create two tags
      await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));

      const createRes2 = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'work' })
      }));
      const { tag: tag2 } = await createRes2.json();

      // Try to update tag2 to have same name as tag1
      const res = await request(new Request(`http://localhost/tags/${tag2.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('already exists');
    });

    it('should return 404 for non-existent tag', async () => {
      const fakeId = 999999;
      const res = await request(new Request(`http://localhost/tags/${fakeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'updated' })
      }));

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /tags/{id} - Delete Tag', () => {
    it('should delete a tag', async () => {
      // Create a tag
      const createRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: createdTag } = await createRes.json();

      // Delete the tag
      const deleteRes = await request(new Request(`http://localhost/tags/${createdTag.id}`, {
        method: 'DELETE'
      }));

      expect(deleteRes.status).toBe(200);
      const data = await deleteRes.json();
      expect(data.tag.id).toBe(createdTag.id);

      // Verify it's gone
      const getRes = await request(new Request(`http://localhost/tags/${createdTag.id}`));
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent tag', async () => {
      const fakeId = 999999;
      const res = await request(new Request(`http://localhost/tags/${fakeId}`, {
        method: 'DELETE'
      }));

      expect(res.status).toBe(404);
    });

    it('should remove tag from all associated tasks', async () => {
      // Create a tag
      const tagRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag } = await tagRes.json();

      // Create a task with the tag
      const taskRes = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test task', tagIds: [tag.id] })
      }));
      const { task } = await taskRes.json();
      expect(task.tags).toHaveLength(1);

      // Delete the tag
      await request(new Request(`http://localhost/tags/${tag.id}`, {
        method: 'DELETE'
      }));

      // Verify task has no tags
      const tasksRes = await request(new Request('http://localhost/tasks'));
      const { tasks } = await tasksRes.json();
      expect(tasks[0].tags).toHaveLength(0);
    });
  });

  describe('Task-Tag Integration', () => {
    it('should create task with tags', async () => {
      // Create tags
      const tag1Res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: tag1 } = await tag1Res.json();

      const tag2Res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'work' })
      }));
      const { tag: tag2 } = await tag2Res.json();

      // Create task with tags
      const taskRes = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test task',
          tagIds: [tag1.id, tag2.id]
        })
      }));

      expect(taskRes.status).toBe(201);
      const { task } = await taskRes.json();
      expect(task.tags).toHaveLength(2);
      expect(task.tags.map((t: any) => t.name).sort()).toEqual(['urgent', 'work']);
    });

    it('should filter tasks by tag ID', async () => {
      // Create tags
      const urgentRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: urgentTag } = await urgentRes.json();

      const workRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'work' })
      }));
      const { tag: workTag } = await workRes.json();

      // Create tasks with different tags
      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Urgent task', tagIds: [urgentTag.id] })
      }));

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Work task', tagIds: [workTag.id] })
      }));

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Both tags', tagIds: [urgentTag.id, workTag.id] })
      }));

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No tags' })
      }));

      // Filter by urgent tag
      const res = await request(new Request(`http://localhost/tasks?tags=${urgentTag.id}`));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.total).toBe(2); // "Urgent task" and "Both tags"
      expect(data.tasks.map((t: any) => t.title).sort()).toEqual(['Both tags', 'Urgent task']);
    });

    it('should reject filtering with non-numeric tag values', async () => {
      // Create tags
      const urgentRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: urgentTag } = await urgentRes.json();

      // Create tasks
      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Urgent task', tagIds: [urgentTag.id] })
      }));

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No tags' })
      }));

      // Filter by tag name (should return empty since we only accept numeric IDs now)
      const res = await request(new Request('http://localhost/tasks?tags=urgent'));
      expect(res.status).toBe(400);
    });

    it('should filter tasks by multiple tags (OR logic)', async () => {
      // Create tags
      const urgentRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: urgentTag } = await urgentRes.json();

      const workRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'work' })
      }));
      const { tag: workTag } = await workRes.json();

      // Create tasks
      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Urgent only', tagIds: [urgentTag.id] })
      }));

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Work only', tagIds: [workTag.id] })
      }));

      await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No tags' })
      }));

      // Filter by multiple tags (comma-separated IDs)
      const res = await request(new Request(`http://localhost/tasks?tags=${urgentTag.id},${workTag.id}`));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.total).toBe(2); // OR logic: tasks with urgent OR work
      expect(data.tasks.map((t: any) => t.title).sort()).toEqual(['Urgent only', 'Work only']);
    });

    it('should reject creating task with invalid tag IDs', async () => {
      const fakeTagId = 999999;
      const res = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test task',
          tagIds: [fakeTagId]
        })
      }));

      expect(res.status).toBe(500); // Error from validation
    });

    it('should update task tags by replacing all existing tags', async () => {
      // Create tags
      const tag1Res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag: tag1 } = await tag1Res.json();

      const tag2Res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'work' })
      }));
      const { tag: tag2 } = await tag2Res.json();

      const tag3Res = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'personal' })
      }));
      const { tag: tag3 } = await tag3Res.json();

      // Create task with tag1
      const createRes = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test task', tagIds: [tag1.id] })
      }));
      const { task } = await createRes.json();

      // Update task to have tag2 and tag3 (replacing tag1)
      const updateRes = await request(new Request(`http://localhost/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [tag2.id, tag3.id] })
      }));

      expect(updateRes.status).toBe(200);
      const { task: updatedTask } = await updateRes.json();
      expect(updatedTask.tags).toHaveLength(2);
      expect(updatedTask.tags.map((t: any) => t.name).sort()).toEqual(['personal', 'work']);
    });

    it('should remove all tags when updating task with empty tagIds array', async () => {
      // Create a tag
      const tagRes = await request(new Request('http://localhost/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'urgent' })
      }));
      const { tag } = await tagRes.json();

      // Create task with tag
      const createRes = await request(new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test task', tagIds: [tag.id] })
      }));
      const { task } = await createRes.json();
      expect(task.tags).toHaveLength(1);

      // Update task to remove all tags
      const updateRes = await request(new Request(`http://localhost/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [] })
      }));

      expect(updateRes.status).toBe(200);
      const { task: updatedTask } = await updateRes.json();
      expect(updatedTask.tags).toHaveLength(0);
    });
  });
});
