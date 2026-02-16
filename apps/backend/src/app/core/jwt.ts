import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const ISSUER = process.env.BETTER_AUTH_URL || "http://localhost:8787";
const JWT_EXPIRATION = "15m";

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
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: ISSUER });
  return {
    sub: payload.sub!,
    email: payload.email as string,
    name: payload.name as string,
  };
}
