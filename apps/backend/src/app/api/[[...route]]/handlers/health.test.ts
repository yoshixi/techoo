import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppBindings } from '../types';
import { healthRoute } from '../routes/health';
import { healthHandler } from './index';
import { createD1TestContext, createTestRequest, type D1TestContext } from '../../../db/tests/d1TestUtils';

// Create a test app with the health endpoint
const createTestApp = () => {
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

  // Register health route with handler
  app.openapi(healthRoute, healthHandler);

  return app;
};

describe('Health Handler', () => {
  let testContext: D1TestContext;
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  beforeAll(async () => {
    testContext = await createD1TestContext();
    app = createTestApp();
    request = createTestRequest(testContext)(app);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  afterAll(async () => {
    if (testContext) {
      await testContext.reset();
      await testContext.stop();
    }
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const req = new Request('http://localhost/health');
      const res = await request(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('message', 'Shuchu API is running');
      expect(data).toHaveProperty('timestamp');
      
      // Validate timestamp format (ISO 8601)
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      
      // Timestamp should be recent (within the last 5 seconds)
      const timestampDate = new Date(data.timestamp);
      const now = new Date();
      const timeDiff = now.getTime() - timestampDate.getTime();
      expect(timeDiff).toBeLessThan(5000); // 5 seconds
    });

    it('should return correct CORS headers', async () => {
      const req = new Request('http://localhost/health');
      const res = await request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should handle OPTIONS preflight request', async () => {
      const req = new Request('http://localhost/health', {
        method: 'OPTIONS'
      });
      const res = await request(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });
  });

  describe('Health Check Reliability', () => {
    it('should consistently return same structure', async () => {
      const requests = [
        new Request('http://localhost/health'),
        new Request('http://localhost/health'),
        new Request('http://localhost/health')
      ];

      const responses = await Promise.all(
        requests.map(req => request(req))
      );

      for (const res of responses) {
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('status', 'ok');
        expect(data).toHaveProperty('message', 'Shuchu API is running');
        expect(data).toHaveProperty('timestamp');
      }
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, () => 
        new Request('http://localhost/health')
      );

      const results = await Promise.all(
        concurrentRequests.map(req => request(req))
      );

      results.forEach(res => {
        expect(res.status).toBe(200);
      });
    });
  });
});
