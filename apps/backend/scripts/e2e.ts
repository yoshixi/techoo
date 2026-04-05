#!/usr/bin/env npx tsx
/**
 * E2E test script — runs against a real server, no mocks.
 *
 * The auth flow mirrors the OAuth path used by clients:
 *   sign-up/sign-in → session token → /session-code → /token (with code) → JWT
 *
 * Usage:
 *   pnpm --filter @apps/backend run dev    # start server
 *   pnpm --filter @apps/backend run e2e    # run tests
 *
 *   BASE_URL=https://api.example.com pnpm --filter @apps/backend run e2e
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787'
const API = `${BASE_URL}/api`

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
  if (!condition) throw new Error(message)
}

interface ApiResponse {
  status: number
  data: any
  headers: Headers
  endpoint: string
}

/** Assert status code — on failure shows endpoint, actual status, and body */
function assertStatus(res: ApiResponse, expected: number) {
  if (res.status !== expected) {
    throw new Error(
      `${res.endpoint} → ${res.status} (expected ${expected})\n` +
      `      body: ${JSON.stringify(res.data)}`
    )
  }
}

/** Assert a non-success status (anything other than the given code) */
function assertNotStatus(res: ApiResponse, notExpected: number) {
  if (res.status === notExpected) {
    throw new Error(
      `${res.endpoint} → ${res.status} (expected NOT ${notExpected})\n` +
      `      body: ${JSON.stringify(res.data)}`
    )
  }
}

async function api(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<ApiResponse> {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: BASE_URL,
    ...options.headers,
  }
  const needsBody = method !== 'GET' && method !== 'HEAD'
  const body = options.body
    ? JSON.stringify(options.body)
    : needsBody ? '{}' : undefined

  const endpoint = `${method} /api${path}`
  const res = await fetch(`${API}${path}`, { method, headers, body })
  const data = await res.json().catch(() => null)
  return { status: res.status, data, headers: res.headers, endpoint }
}

/**
 * Exchange a session token for a JWT via the code flow.
 * This mirrors the OAuth flow: session-token → exchange code → /token
 */
async function sessionToJwt(sessionToken: string): Promise<string> {
  const codeRes = await api('/session-code', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  if (codeRes.status !== 200 || !codeRes.data?.code) {
    throw new Error(
      `${codeRes.endpoint} → ${codeRes.status}\n` +
      `      body: ${JSON.stringify(codeRes.data)}`
    )
  }

  const tokenRes = await api('/token', {
    method: 'POST',
    body: { code: codeRes.data.code },
  })
  if (tokenRes.status !== 200 || !tokenRes.data?.token) {
    throw new Error(
      `${tokenRes.endpoint} → ${tokenRes.status}\n` +
      `      body: ${JSON.stringify(tokenRes.data)}`
    )
  }

  return tokenRes.data.token
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function testSignUp() {
  console.log('\n--- Sign-up ---')

  let sessionToken: string | null = null

  await test('POST /auth/sign-up/email → sign up a new user', async () => {
    const res = await api('/auth/sign-up/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    })
    assertStatus(res, 200)
    assert(res.data.user !== undefined, 'response should have user')
    assert(res.data.user.email === TEST_EMAIL, `email mismatch: ${res.data.user.email}`)
    sessionToken = res.headers.get('set-auth-token')
    assert(sessionToken !== null, 'should return session token in set-auth-token header')
  })

  await test('POST /auth/sign-up/email → reject duplicate email', async () => {
    const res = await api('/auth/sign-up/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
    })
    assertNotStatus(res, 200)
  })

  return sessionToken!
}

async function testTokenExchange(sessionToken: string) {
  console.log('\n--- Token exchange (code flow) ---')

  let jwt: string = ''

  await test('POST /session-code → create exchange code', async () => {
    const res = await api('/session-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assertStatus(res, 200)
    assert(typeof res.data.code === 'string', 'should return code')
  })

  await test('POST /token { code } → exchange code for JWT', async () => {
    jwt = await sessionToJwt(sessionToken)
    assert(typeof jwt === 'string', 'should return JWT')
    assert(jwt.split('.').length === 3, 'JWT should have 3 parts')
  })

  await test('POST /token { code: invalid } → reject invalid code', async () => {
    const res = await api('/token', {
      method: 'POST',
      body: { code: 'invalid-code' },
    })
    assertStatus(res, 400)
  })

  await test('POST /session-code (invalid token) → reject', async () => {
    const res = await api('/session-code', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token' },
    })
    assert(
      res.status === 400 || res.status === 401,
      `${res.endpoint} → ${res.status} (expected 400 or 401)\n      body: ${JSON.stringify(res.data)}`
    )
  })

  return jwt
}

async function testCrudTasks(jwt: string) {
  console.log('\n--- CRUD Tasks ---')

  const auth = { Authorization: `Bearer ${jwt}` }
  let taskId: number

  await test('GET /tasks → empty list', async () => {
    const res = await api('/tasks', { headers: auth })
    assertStatus(res, 200)
    assert(res.data.total === 0, `expected 0 tasks, got ${res.data.total}`)
  })

  await test('POST /tasks → create', async () => {
    const res = await api('/tasks', {
      method: 'POST',
      headers: auth,
      body: { title: 'E2E Task', description: 'Created by e2e script' },
    })
    assertStatus(res, 201)
    assert(res.data.task.title === 'E2E Task', `title: ${res.data.task.title}`)
    taskId = res.data.task.id
  })

  await test('GET /tasks/:id → read', async () => {
    const res = await api(`/tasks/${taskId}`, { headers: auth })
    assertStatus(res, 200)
    assert(res.data.task.title === 'E2E Task', `title: ${res.data.task.title}`)
  })

  await test('PUT /tasks/:id → update', async () => {
    const res = await api(`/tasks/${taskId}`, {
      method: 'PUT',
      headers: auth,
      body: { title: 'Updated E2E Task' },
    })
    assertStatus(res, 200)
    assert(res.data.task.title === 'Updated E2E Task', `title: ${res.data.task.title}`)
  })

  await test('DELETE /tasks/:id → delete', async () => {
    const res = await api(`/tasks/${taskId}`, { method: 'DELETE', headers: auth })
    assertStatus(res, 200)
  })

  await test('GET /tasks/:id → 404 after delete', async () => {
    const res = await api(`/tasks/${taskId}`, { headers: auth })
    assertStatus(res, 404)
  })
}

async function testCrudNotes(jwt: string) {
  console.log('\n--- CRUD Notes ---')

  const auth = { Authorization: `Bearer ${jwt}` }
  let noteId: number

  await test('GET /notes → empty list', async () => {
    const res = await api('/notes', { headers: auth })
    assertStatus(res, 200)
    assert(res.data.total === 0, `expected 0 notes, got ${res.data.total}`)
  })

  await test('POST /notes → create', async () => {
    const res = await api('/notes', {
      method: 'POST',
      headers: auth,
      body: { title: 'E2E Note', content: 'Created by e2e script' },
    })
    assertStatus(res, 201)
    assert(res.data.note.title === 'E2E Note', `title: ${res.data.note.title}`)
    noteId = res.data.note.id
  })

  await test('GET /notes/:id → read', async () => {
    const res = await api(`/notes/${noteId}`, { headers: auth })
    assertStatus(res, 200)
    assert(res.data.note.title === 'E2E Note', `title: ${res.data.note.title}`)
  })

  await test('PUT /notes/:id → update', async () => {
    const res = await api(`/notes/${noteId}`, {
      method: 'PUT',
      headers: auth,
      body: { title: 'Updated E2E Note' },
    })
    assertStatus(res, 200)
    assert(res.data.note.title === 'Updated E2E Note', `title: ${res.data.note.title}`)
  })

  await test('POST /notes/:id/task_conversions → convert to task', async () => {
    const res = await api(`/notes/${noteId}/task_conversions`, {
      method: 'POST',
      headers: auth,
    })
    assertStatus(res, 201)
    assert(res.data.task !== undefined, 'should return task')
    assert(res.data.task.title === 'Updated E2E Note', `task title: ${res.data.task.title}`)
    await api(`/tasks/${res.data.task.id}`, { method: 'DELETE', headers: auth })
  })

  await test('DELETE /notes/:id → delete', async () => {
    const createRes = await api('/notes', {
      method: 'POST',
      headers: auth,
      body: { title: 'To delete' },
    })
    assertStatus(createRes, 201)
    const res = await api(`/notes/${createRes.data.note.id}`, { method: 'DELETE', headers: auth })
    assertStatus(res, 200)
  })
}

async function testSignOut(sessionToken: string) {
  console.log('\n--- Sign-out ---')

  await test('POST /auth/sign-out → sign out', async () => {
    const res = await api('/auth/sign-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assertStatus(res, 200)
  })

  await test('POST /session-code → reject after sign-out', async () => {
    const res = await api('/session-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
    assert(
      res.status === 400 || res.status === 401,
      `${res.endpoint} → ${res.status} (expected 400 or 401)\n      body: ${JSON.stringify(res.data)}`
    )
  })
}

async function testSignIn() {
  console.log('\n--- Sign-in (code flow) ---')

  let jwt: string = ''

  await test('POST /auth/sign-in/email → sign in + code flow JWT', async () => {
    const res = await api('/auth/sign-in/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    assertStatus(res, 200)
    assert(res.data.user.email === TEST_EMAIL, `email: ${res.data.user.email}`)

    const sessionToken = res.headers.get('set-auth-token')
    assert(sessionToken !== null, 'should return session token')
    jwt = await sessionToJwt(sessionToken!)
    assert(jwt.split('.').length === 3, 'JWT should have 3 parts')
  })

  await test('POST /auth/sign-in/email → reject wrong password', async () => {
    const res = await api('/auth/sign-in/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrong-password' },
    })
    assertNotStatus(res, 200)
  })

  await test('GET /tasks → access protected route after sign-in', async () => {
    const res = await api('/tasks', { headers: { Authorization: `Bearer ${jwt}` } })
    assertStatus(res, 200)
    assert(Array.isArray(res.data.tasks), 'should return tasks array')
  })
}

async function testCleanup() {
  console.log('\n--- Cleanup ---')

  // Sign in to get a fresh session + JWT for the cleanup call
  const signInRes = await api('/auth/sign-in/email', {
    method: 'POST',
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  const sessionToken = signInRes.headers.get('set-auth-token')!
  const jwt = await sessionToJwt(sessionToken)

  await test('DELETE /account → delete test user and all data', async () => {
    const res = await api('/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })
    assertStatus(res, 200)
    assert(res.data.message === 'Account deleted', `message: ${res.data.message}`)
  })

  await test('POST /auth/sign-in/email → reject after account deletion', async () => {
    const res = await api('/auth/sign-in/email', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    assertNotStatus(res, 200)
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nE2E tests against ${BASE_URL}`)
  console.log(`Test user: ${TEST_EMAIL}`)
  console.log(`Auth flow: session-token → /session-code → /token (code exchange)\n`)

  try {
    const res = await fetch(`${API}/health`)
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  } catch {
    console.error(`Cannot reach server at ${BASE_URL}. Is it running?`)
    process.exit(1)
  }

  const sessionToken = await testSignUp()
  const jwt = await testTokenExchange(sessionToken)
  await testCrudTasks(jwt)
  await testCrudNotes(jwt)
  await testSignOut(sessionToken)
  await testSignIn()
  await testCleanup()

  console.log(`\n${'─'.repeat(40)}`)
  console.log(`${passCount} passed, ${failCount} failed`)
  if (failCount > 0) process.exit(1)
}

main()
