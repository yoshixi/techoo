#!/usr/bin/env npx tsx
/**
 * E2E test script — runs against a real server, no mocks.
 *
 * Usage:
 *   # Start the server first:
 *   pnpm --filter @apps/backend run dev
 *
 *   # Then run the e2e tests:
 *   pnpm --filter @apps/backend run e2e
 *
 *   # Or against a custom URL:
 *   BASE_URL=https://api.example.com pnpm --filter @apps/backend run e2e
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787'
const API = `${BASE_URL}/api`

// Unique email per run to avoid conflicts
const RUN_ID = Date.now()
const TEST_EMAIL = `e2e-${RUN_ID}@test.example.com`
const TEST_PASSWORD = 'e2e-test-password-123456'
const TEST_NAME = `E2E User ${RUN_ID}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passCount = 0
let failCount = 0

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passCount++
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failCount++
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`  ✗ ${name}`)
    console.error(`    ${msg}`)
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

async function api(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, headers: res.headers }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function testSignUp() {
  console.log('\n--- Sign-up ---')

  let sessionToken: string | null = null

  await test('should sign up a new user', async () => {
    const { status, data, headers } = await api('/auth/sign-up/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    })
    assertEqual(status, 200, 'status')
    assert(data.user !== undefined, 'response should have user')
    assertEqual(data.user.email, TEST_EMAIL, 'email')
    sessionToken = headers.get('set-auth-token')
    assert(sessionToken !== null, 'should return session token')
  })

  await test('should reject duplicate email', async () => {
    const { status } = await api('/auth/sign-up/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    })
    assert(status !== 200, `expected non-200, got ${status}`)
  })

  return sessionToken!
}

async function testTokenExchange(sessionToken: string) {
  console.log('\n--- Token exchange ---')

  let jwt: string = ''

  await test('should exchange session token for JWT', async () => {
    const { status, data } = await api('/token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assertEqual(status, 200, 'status')
    assert(typeof data.token === 'string', 'should return JWT')
    assert(data.token.split('.').length === 3, 'JWT should have 3 parts')
    jwt = data.token
  })

  await test('should reject invalid session token', async () => {
    const { status } = await api('/token', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token' },
    })
    assertEqual(status, 401, 'status')
  })

  return jwt
}

async function testCrudTasks(jwt: string) {
  console.log('\n--- CRUD Tasks ---')

  const auth = { Authorization: `Bearer ${jwt}` }
  let taskId: number

  await test('should list tasks (empty)', async () => {
    const { status, data } = await api('/tasks', { headers: auth })
    assertEqual(status, 200, 'status')
    assertEqual(data.total, 0, 'total')
  })

  await test('should create a task', async () => {
    const { status, data } = await api('/tasks', {
      method: 'POST',
      headers: auth,
      body: { title: 'E2E Task', description: 'Created by e2e script' },
    })
    assertEqual(status, 201, 'status')
    assertEqual(data.task.title, 'E2E Task', 'title')
    taskId = data.task.id
  })

  await test('should read the task', async () => {
    const { status, data } = await api(`/tasks/${taskId}`, { headers: auth })
    assertEqual(status, 200, 'status')
    assertEqual(data.task.title, 'E2E Task', 'title')
  })

  await test('should update the task', async () => {
    const { status, data } = await api(`/tasks/${taskId}`, {
      method: 'PUT',
      headers: auth,
      body: { title: 'Updated E2E Task' },
    })
    assertEqual(status, 200, 'status')
    assertEqual(data.task.title, 'Updated E2E Task', 'title')
  })

  await test('should delete the task', async () => {
    const { status } = await api(`/tasks/${taskId}`, { method: 'DELETE', headers: auth })
    assertEqual(status, 200, 'status')
  })

  await test('should return 404 for deleted task', async () => {
    const { status } = await api(`/tasks/${taskId}`, { headers: auth })
    assertEqual(status, 404, 'status')
  })
}

async function testCrudNotes(jwt: string) {
  console.log('\n--- CRUD Notes ---')

  const auth = { Authorization: `Bearer ${jwt}` }
  let noteId: number

  await test('should list notes (empty)', async () => {
    const { status, data } = await api('/notes', { headers: auth })
    assertEqual(status, 200, 'status')
    assertEqual(data.total, 0, 'total')
  })

  await test('should create a note', async () => {
    const { status, data } = await api('/notes', {
      method: 'POST',
      headers: auth,
      body: { title: 'E2E Note', content: 'Created by e2e script' },
    })
    assertEqual(status, 201, 'status')
    assertEqual(data.note.title, 'E2E Note', 'title')
    noteId = data.note.id
  })

  await test('should read the note', async () => {
    const { status, data } = await api(`/notes/${noteId}`, { headers: auth })
    assertEqual(status, 200, 'status')
    assertEqual(data.note.title, 'E2E Note', 'title')
  })

  await test('should update the note', async () => {
    const { status, data } = await api(`/notes/${noteId}`, {
      method: 'PUT',
      headers: auth,
      body: { title: 'Updated E2E Note' },
    })
    assertEqual(status, 200, 'status')
    assertEqual(data.note.title, 'Updated E2E Note', 'title')
  })

  await test('should convert note to task', async () => {
    const { status, data } = await api(`/notes/${noteId}/task_conversions`, {
      method: 'POST',
      headers: auth,
      body: {},
    })
    assertEqual(status, 201, 'status')
    assert(data.task !== undefined, 'should return task')
    assertEqual(data.task.title, 'Updated E2E Note', 'task title should match note title')

    // Clean up the created task
    await api(`/tasks/${data.task.id}`, { method: 'DELETE', headers: auth })
  })

  await test('should delete the note', async () => {
    // Note was archived by convert, create a new one to delete
    const { data: created } = await api('/notes', {
      method: 'POST',
      headers: auth,
      body: { title: 'To delete' },
    })
    const { status } = await api(`/notes/${created.note.id}`, { method: 'DELETE', headers: auth })
    assertEqual(status, 200, 'status')
  })
}

async function testSignOut(sessionToken: string) {
  console.log('\n--- Sign-out ---')

  await test('should sign out', async () => {
    const { status } = await api('/auth/sign-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assertEqual(status, 200, 'status')
  })

  await test('should reject token exchange after sign-out', async () => {
    const { status } = await api('/token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assertEqual(status, 401, 'status')
  })
}

async function testSignIn() {
  console.log('\n--- Sign-in ---')

  let jwt: string = ''

  await test('should sign in with correct credentials', async () => {
    const { status, data, headers } = await api('/auth/sign-in/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    assertEqual(status, 200, 'status')
    assert(data.user !== undefined, 'response should have user')
    assertEqual(data.user.email, TEST_EMAIL, 'email')

    const sessionToken = headers.get('set-auth-token')
    assert(sessionToken !== null, 'should return session token')

    const tokenRes = await api('/token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assertEqual(tokenRes.status, 200, 'token status')
    jwt = tokenRes.data.token
  })

  await test('should reject wrong password', async () => {
    const { status } = await api('/auth/sign-in/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrong-password' },
    })
    assert(status !== 200, `expected non-200, got ${status}`)
  })

  await test('should access protected routes after sign-in', async () => {
    const { status, data } = await api('/tasks', {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    assertEqual(status, 200, 'status')
    assert(Array.isArray(data.tasks), 'should return tasks array')
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nE2E tests against ${BASE_URL}`)
  console.log(`Test user: ${TEST_EMAIL}\n`)

  // Check server is reachable
  try {
    const res = await fetch(`${API}/health`)
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  } catch (error) {
    console.error(`Cannot reach server at ${BASE_URL}. Is it running?`)
    process.exit(1)
  }

  // Run tests in order — each depends on the previous
  const sessionToken = await testSignUp()
  const jwt = await testTokenExchange(sessionToken)
  await testCrudTasks(jwt)
  await testCrudNotes(jwt)
  await testSignOut(sessionToken)
  await testSignIn()

  // Summary
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`${passCount} passed, ${failCount} failed`)
  if (failCount > 0) process.exit(1)
}

main()
