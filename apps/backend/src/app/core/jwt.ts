import { SignJWT, jwtVerify } from "jose";

const ISSUER = process.env.BETTER_AUTH_URL || "http://localhost:8787";
const JWT_EXPIRATION = "15m";
let cachedJwtSecret: Uint8Array | null = null;

const getJwtSecret = () => {
  if (cachedJwtSecret) return cachedJwtSecret;
  const rawSecret = process.env.JWT_SECRET || "";
  if (!rawSecret) {
    console.error("JWT_SECRET is missing or empty");
    throw new Error("JWT_SECRET is required");
  }
  cachedJwtSecret = new TextEncoder().encode(rawSecret);
  console.log(`JWT_SECRET length ${rawSecret.length}`);
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
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), { issuer: ISSUER });
  return {
    sub: payload.sub!,
    email: payload.email as string,
    name: payload.name as string,
  };
}
