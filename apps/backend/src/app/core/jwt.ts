import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "./env";

const JWT_EXPIRATION = "15m";
let cachedJwtSecret: Uint8Array | null = null;
let cachedIssuer: string | null = null;

const getIssuer = () => {
  if (cachedIssuer) return cachedIssuer;
  cachedIssuer = getEnv().BETTER_AUTH_URL;
  return cachedIssuer;
};

const getJwtSecret = () => {
  if (cachedJwtSecret) return cachedJwtSecret;
  cachedJwtSecret = new TextEncoder().encode(getEnv().JWT_SECRET);
  return cachedJwtSecret;
};

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export async function signJwt(user: {
  id: number;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(getIssuer())
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), { issuer: getIssuer() });
  return {
    sub: payload.sub!,
    email: payload.email as string,
    name: payload.name as string,
  };
}
