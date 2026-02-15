import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { getDb } from "./common.db";
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "../db/schema/schema";

export const createAuth = (database: Parameters<typeof getDb>[0]) =>
  betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8787",
    database: drizzleAdapter(getDb(database), {
      provider: "sqlite",
      usePlural: true,
      schema: {
        users: usersTable,
        sessions: sessionsTable,
        accounts: accountsTable,
        verifications: verificationsTable,
      },
    }),
    logger: {
      level: "debug",
      log: (level, message, ...args) => {
        console.log({
          level,
          message,
          metadata: args,
          timestamp: new Date().toISOString()
        });
      }
    },
    emailAndPassword: { enabled: true },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events.readonly'
        ],
        accessType: 'offline', // Request refresh token
      },
      // TODO: GitHub and Apple OAuth are not supported yet
      // github: {
      //   clientId: process.env.GITHUB_CLIENT_ID!,
      //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // },
      // apple: {
      //   clientId: process.env.APPLE_CLIENT_ID!,
      //   clientSecret: process.env.APPLE_CLIENT_SECRET!,
      // },
    },
    trustedOrigins: (process.env.TRUSTED_ORIGINS || "http://localhost:5173").split(","),
    plugins: [bearer()],
    advanced: {
      database: { generateId: false },
    },
  });
