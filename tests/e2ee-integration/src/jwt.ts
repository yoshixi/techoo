import { SignJWT } from 'jose'

/** Matches the secret bound on the local worker. Longer than the server's 32-character minimum. */
export const JWT_SECRET = 'e2ee-integration-jwt-secret-32chars-min'

/** Issuer baked into the worker binding. It does not have to equal the ephemeral listen port. */
export const JWT_ISSUER = 'http://127.0.0.1:8787'

export interface TestUser {
  id: number
  email: string
  name: string
}

let nextUserId = 100

export function testUser(name: string): TestUser {
  const id = nextUserId
  nextUserId += 1
  return { id, email: `${name}-${id}@example.com`, name }
}

/** Sign the same HS256 claims the API's `signJwt` helper issues. */
export async function signUserJwt(user: TestUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(JWT_SECRET))
}
