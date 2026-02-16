import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppBindings } from '../types';
import { createD1TestContext, createTestRequest, type D1TestContext } from '../../../db/tests/d1TestUtils';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { SignJWT, jwtVerify } from 'jose';
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from '../../../db/schema/schema';

// Test JWT secret (only used in this test file)
const TEST_JWT_SECRET = new TextEncoder().encode(
  'test-jwt-secret-that-is-at-least-32-characters-long'
);
const TEST_ISSUER = 'http://localhost';

async function testSignJwt(user: {
  id: number;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuer(TEST_ISSUER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(TEST_JWT_SECRET);
}

async function testVerifyJwt(token: string) {
  const { payload } = await jwtVerify(token, TEST_JWT_SECRET, {
    issuer: TEST_ISSUER,
  });
  return {
    sub: payload.sub!,
    email: payload.email as string,
    name: payload.name as string,
  };
}

describe('Auth & Token Endpoints', () => {
  let testContext: D1TestContext;
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

  beforeAll(async () => {
    testContext = await createD1TestContext();

    // Create a test-local better-auth instance with the test DB
    const testAuth = betterAuth({
      database: drizzleAdapter(testContext.db, {
        provider: 'sqlite',
        usePlural: true,
        schema: {
          users: usersTable,
          sessions: sessionsTable,
          accounts: accountsTable,
          verifications: verificationsTable,
        },
      }),
      emailAndPassword: { enabled: true },
      plugins: [bearer()],
      advanced: { database: { generateId: false } },
      trustedOrigins: ['http://localhost'],
      secret: 'test-better-auth-secret-at-least-32-chars-long',
      baseURL: 'http://localhost',
      basePath: '/api/auth',
    });

    app = new OpenAPIHono<AppBindings>().basePath('/api')
    request = createTestRequest(testContext)(app)
    
    // Mount better-auth handler
    app.on(['POST', 'GET'], '/auth/*', (c) => {
      return testAuth.handler(c.req.raw);
    });

    // Token exchange endpoint (mirrors route.ts)
    app.post('/token', async (c) => {
      let session = await testAuth.api.getSession({
        headers: c.req.raw.headers,
      });
      const authHeader = c.req.header('Authorization');
      if (!session && authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const headers = new Headers(c.req.raw.headers);
        headers.set('cookie', `better-auth.session_token=${token}`);
        session = await testAuth.api.getSession({ headers });
      }
      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      const jwt = await testSignJwt({
        id: Number(session.user.id),
        email: session.user.email,
        name: session.user.name,
      });
      return c.json({ token: jwt });
    });

    // Session lookup endpoint (mirrors route.ts)
    app.get('/session', async (c) => {
      let session = await testAuth.api.getSession({
        headers: c.req.raw.headers,
      });
      const authHeader = c.req.header('Authorization');
      if (!session && authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const headers = new Headers(c.req.raw.headers);
        headers.set('cookie', `better-auth.session_token=${token}`);
        session = await testAuth.api.getSession({ headers });
      }
      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      return c.json({
        user: {
          id: Number(session.user.id),
          email: session.user.email,
          name: session.user.name,
        },
        session: session.session,
      });
    });

    // JWT auth middleware (mirrors route.ts)
    app.use('/*', async (c, next) => {
      const path = c.req.path;
      if (
        path.startsWith('/api/auth') ||
        path === '/api/token' ||
        path === '/api/session' ||
        path === '/api/health'
      ) {
        return next();
      }

      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      try {
        const payload = await testVerifyJwt(authHeader.slice(7));
        c.set('user', {
          id: Number(payload.sub),
          email: payload.email,
          name: payload.name,
        });
        await next();
      } catch {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    });

    // A simple protected route for testing JWT middleware
    app.get('/protected', (c) => {
      const user = c.get('user');
      return c.json({ user });
    });
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

  // Helper: sign up and return the Response
  async function signUp(
    email = 'test@example.com',
    password = 'password123456',
    name = 'Test User'
  ) {
    return request(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
    );
  }

  // Helper: extract session token from the set-auth-token header (bearer plugin)
  function getSessionToken(res: Response): string | null {
    return res.headers.get('set-auth-token');
  }

  describe('POST /api/auth/sign-up/email', () => {
    it('should sign up a new user with email and password', async () => {
      const res = await signUp();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('test@example.com');
      expect(data.user.name).toBe('Test User');
    });

    it('should return a session token via set-auth-token header', async () => {
      const res = await signUp();
      expect(res.status).toBe(200);

      const token = getSessionToken(res);
      expect(token).toBeTruthy();
    });

    it('should reject duplicate email sign-up', async () => {
      const first = await signUp('dup@example.com');
      expect(first.status).toBe(200);

      const second = await signUp('dup@example.com');
      expect(second.status).not.toBe(200);
    });
  });

  describe('POST /api/auth/sign-in/email', () => {
    it('should sign in with valid credentials', async () => {
      await signUp('signin@example.com', 'password123456', 'Sign In User');

      const res = await request(
        new Request('http://localhost/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'signin@example.com',
            password: 'password123456',
          }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('signin@example.com');

      const token = getSessionToken(res);
      expect(token).toBeTruthy();
    });

    it('should reject invalid password', async () => {
      await signUp('wrong@example.com', 'password123456', 'Wrong Pass');

      const res = await request(
        new Request('http://localhost/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'wrong@example.com',
            password: 'wrongpassword',
          }),
        })
      );

      expect(res.status).not.toBe(200);
    });

    it('should reject non-existent email', async () => {
      const res = await request(
        new Request('http://localhost/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'password123456',
          }),
        })
      );

      expect(res.status).not.toBe(200);
    });
  });

  describe('POST /api/token', () => {
    it('should exchange session token for JWT', async () => {
      const signUpRes = await signUp(
        'token@example.com',
        'password123456',
        'Token User'
      );
      const sessionToken = getSessionToken(signUpRes);
      expect(sessionToken).toBeTruthy();

      const res = await request(
        new Request('http://localhost/api/token', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeTruthy();

      // Verify the JWT contains the correct user info
      const payload = await testVerifyJwt(data.token);
      expect(payload.email).toBe('token@example.com');
      expect(payload.name).toBe('Token User');
      expect(payload.sub).toBeTruthy();
    });

    it('should reject request without Authorization header', async () => {
      const res = await request(
        new Request('http://localhost/api/token', {
          method: 'POST',
        })
      );

      expect(res.status).toBe(401);
    });

    it('should reject invalid session token', async () => {
      const res = await request(
        new Request('http://localhost/api/token', {
          method: 'POST',
          headers: { Authorization: 'Bearer invalid-session-token' },
        })
      );

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/session', () => {
    it('should return session data with bearer session token', async () => {
      const signUpRes = await signUp(
        'session@example.com',
        'password123456',
        'Session User'
      );
      const sessionToken = getSessionToken(signUpRes);
      expect(sessionToken).toBeTruthy();

      const res = await request(
        new Request('http://localhost/api/session', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('session@example.com');
    });

    it('should reject request without Authorization header', async () => {
      const res = await request(new Request('http://localhost/api/session'));
      expect(res.status).toBe(401);
    });

    it('should reject invalid session token', async () => {
      const res = await request(
        new Request('http://localhost/api/session', {
          headers: { Authorization: 'Bearer invalid-session-token' },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/get-session', () => {
    it('should return session data with bearer session token', async () => {
      const signUpRes = await signUp(
        'session@example.com',
        'password123456',
        'Session User'
      );
      const sessionToken = getSessionToken(signUpRes);
      expect(sessionToken).toBeTruthy();

      const res = await request(
        new Request('http://localhost/api/auth/get-session', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('session@example.com');
    });
  });

  describe('JWT Auth Middleware', () => {
    it('should allow access to protected route with valid JWT', async () => {
      // Sign up and get session token
      const signUpRes = await signUp(
        'jwt@example.com',
        'password123456',
        'JWT User'
      );
      const sessionToken = getSessionToken(signUpRes);

      // Exchange for JWT
      const tokenRes = await request(
        new Request('http://localhost/api/token', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );
      const { token: jwt } = await tokenRes.json();

      // Access protected route
      const res = await request(
        new Request('http://localhost/api/protected', {
          headers: { Authorization: `Bearer ${jwt}` },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('jwt@example.com');
      expect(data.user.name).toBe('JWT User');
      expect(data.user.id).toBeTypeOf('number');
    });

    it('should reject request without Authorization header', async () => {
      const res = await request(
        new Request('http://localhost/api/protected')
      );
      expect(res.status).toBe(401);
    });

    it('should reject invalid JWT', async () => {
      const res = await request(
        new Request('http://localhost/api/protected', {
          headers: { Authorization: 'Bearer invalid-jwt-token' },
        })
      );
      expect(res.status).toBe(401);
    });

    it('should reject non-Bearer auth scheme', async () => {
      const res = await request(
        new Request('http://localhost/api/protected', {
          headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe('Full Auth Flow', () => {
    it('should complete sign-up → token exchange → protected API access', async () => {
      // 1. Sign up
      const signUpRes = await signUp(
        'flow@example.com',
        'password123456',
        'Flow User'
      );
      expect(signUpRes.status).toBe(200);
      const sessionToken = getSessionToken(signUpRes);
      expect(sessionToken).toBeTruthy();

      // 2. Exchange session token for JWT
      const tokenRes = await request(
        new Request('http://localhost/api/token', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );
      expect(tokenRes.status).toBe(200);
      const { token: jwt } = await tokenRes.json();

      // 3. Access protected resource
      const protectedRes = await request(
        new Request('http://localhost/api/protected', {
          headers: { Authorization: `Bearer ${jwt}` },
        })
      );
      expect(protectedRes.status).toBe(200);
      const data = await protectedRes.json();
      expect(data.user.email).toBe('flow@example.com');
    });

    it('should complete sign-up → sign-in → token exchange → protected API access', async () => {
      // 1. Sign up
      await signUp('lifecycle@example.com', 'password123456', 'Lifecycle User');

      // 2. Sign in (creates a new session)
      const signInRes = await request(
        new Request('http://localhost/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'lifecycle@example.com',
            password: 'password123456',
          }),
        })
      );
      expect(signInRes.status).toBe(200);
      const sessionToken = getSessionToken(signInRes);
      expect(sessionToken).toBeTruthy();

      // 3. Exchange for JWT
      const tokenRes = await request(
        new Request('http://localhost/api/token', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        })
      );
      expect(tokenRes.status).toBe(200);
      const { token: jwt } = await tokenRes.json();

      // 4. Access protected resource
      const protectedRes = await request(
        new Request('http://localhost/api/protected', {
          headers: { Authorization: `Bearer ${jwt}` },
        })
      );
      expect(protectedRes.status).toBe(200);
      const data = await protectedRes.json();
      expect(data.user.email).toBe('lifecycle@example.com');
    });
  });
});
