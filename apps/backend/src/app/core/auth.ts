import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { getDb } from "./common.db";
import { googleCalendarProvider } from "./calendar-providers/google.service";
import { requireEnv } from "../lib/utils";
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "../db/schema/schema";
const getEnv = (): Record<string, string | undefined> =>
  (typeof process === "undefined" ? {} : (process.env as Record<string, string | undefined>));

const updateGoogleAccountProfile = async (account: {
  id?: number | string
  userId?: number | string
  providerId?: string
  accessToken?: string | null
  refreshToken?: string | null
  accessTokenExpiresAt?: Date | null
  providerEmail?: string | null
}) => {
  if (account.providerId !== "google") return;
  if (!account.accessToken) return;
  if (account.userId === undefined || account.userId === null) return;
  if (account.id === undefined || account.id === null) return;

  const info = await googleCalendarProvider.getUserInfo?.({
    accessToken: account.accessToken,
    refreshToken: account.refreshToken || "",
    expiresAt: account.accessTokenExpiresAt || new Date(0)
  });

  if (!info) return;

  const accountId = Number(account.id);
  const userId = Number(account.userId);
  if (Number.isNaN(accountId) || Number.isNaN(userId)) return;

  const db = getDb();

  if (info.email && info.email !== account.providerEmail) {
    await db
      .update(accountsTable)
      .set({ providerEmail: info.email })
      .where(eq(accountsTable.id, accountId));
  }

  if (info.picture) {
    await db
      .update(usersTable)
      .set({ image: info.picture })
      .where(eq(usersTable.id, userId));
  }
};

export const createAuth = () => {
  const env = getEnv()
  const isProduction = env.NODE_ENV === "production"

  const secret = requireEnv(env.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET", isProduction)
  const betterAuthUrl = requireEnv(env.BETTER_AUTH_URL, "BETTER_AUTH_URL", isProduction)
  const googleClientId = requireEnv(env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID", isProduction)
  const googleClientSecret = requireEnv(env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET", isProduction)
  const googleRedirectUri = env.GOOGLE_REDIRECT_URI ?? ""

  if (!googleRedirectUri) {
    const message = "GOOGLE_REDIRECT_URI is missing or empty"
    if (isProduction) {
      throw new Error(message)
    }
    console.error(message)
  }

  if (!isProduction) {
    if (secret) console.log(`BETTER_AUTH_SECRET length ${secret.length}`)
    if (betterAuthUrl) console.log(`BETTER_AUTH_URL length ${betterAuthUrl.length}`)
    if (googleClientId) console.log(`GOOGLE_CLIENT_ID length ${googleClientId.length}`)
    if (googleClientSecret) console.log(`GOOGLE_CLIENT_SECRET length ${googleClientSecret.length}`)
    if (googleRedirectUri) console.log(`GOOGLE_REDIRECT_URI length ${googleRedirectUri.length}`)
  }
  return betterAuth({
    secret,
    baseURL: betterAuthUrl || "http://localhost:8787",
    database: drizzleAdapter(getDb(), {
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
    account: {
      accountLinking: {
        allowDifferentEmails: true,
        trustedProviders: ["google"],
        updateUserInfoOnLink: true,
      },
    },
    socialProviders: {
      ...(googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              scope: [
                'openid',
                'email',
                'profile',
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/calendar.events.readonly'
              ],
              accessType: 'offline', // Request refresh token
            },
          }
        : {}),
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
    trustedOrigins: [
      ...(process.env.TRUSTED_ORIGINS || "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      "http://127.0.0.1:*",
      "http://localhost:*"
    ],
    databaseHooks: {
      account: {
        create: {
          after: async (account: {
            id?: string | number
            userId?: string | number
            providerId?: string
            accessToken?: string | null
            refreshToken?: string | null
            accessTokenExpiresAt?: Date | null
            providerEmail?: string | null
          }) => {
            try {
              await updateGoogleAccountProfile(account);
            } catch (error) {
              console.warn("Failed to fetch Google account email:", error);
            }
          }
        },
        update: {
          after: async (account: {
            id?: string | number
            userId?: string | number
            providerId?: string
            accessToken?: string | null
            refreshToken?: string | null
            accessTokenExpiresAt?: Date | null
            providerEmail?: string | null
          }) => {
            try {
              await updateGoogleAccountProfile(account);
            } catch (error) {
              console.warn("Failed to refresh Google account profile:", error);
            }
          }
        }
      }
    },
    plugins: [bearer()],
    advanced: {
      database: { generateId: false },
    },
  });
};
