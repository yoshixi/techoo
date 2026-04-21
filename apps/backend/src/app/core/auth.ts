import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { getMainDb } from "./internal/main-db";
import { googleCalendarProvider } from "./calendar-providers/google.service";
import { getEnv } from "./env";
import { rootLogger } from "../lib/logger";
import { readPossiblyProtectedValue } from "./data-protection";

const authLogger = rootLogger.child({ module: 'auth' });
import {
  usersTable,
  sessionsTable,
  accountsTable,
  verificationsTable,
} from "../db/schema/schema";

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

  const accessToken = await readPossiblyProtectedValue(account.accessToken);
  const refreshToken = account.refreshToken
    ? await readPossiblyProtectedValue(account.refreshToken)
    : "";

  const info = await googleCalendarProvider.getUserInfo?.({
    accessToken,
    refreshToken,
    expiresAt: account.accessTokenExpiresAt || new Date(0)
  });

  if (!info) return;

  const accountId = Number(account.id);
  const userId = Number(account.userId);
  if (Number.isNaN(accountId) || Number.isNaN(userId)) return;

  const db = getMainDb();

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

  const secret = env.BETTER_AUTH_SECRET
  const betterAuthUrl = env.BETTER_AUTH_URL
  const googleClientId = env.GOOGLE_CLIENT_ID
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET
  const googleRedirectUri = env.GOOGLE_REDIRECT_URI

  if (!isProduction) {
    authLogger.debug({
      secretLength: secret.length,
      urlLength: betterAuthUrl.length,
      googleClientIdLength: googleClientId.length,
      googleClientSecretLength: googleClientSecret.length,
      googleRedirectUriLength: googleRedirectUri.length,
    }, 'auth config loaded')
  }
  return betterAuth({
    secret,
    baseURL: betterAuthUrl || "http://localhost:8787",
    database: drizzleAdapter(getMainDb(), {
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
        authLogger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'debug']({ metadata: args }, String(message));
      }
    },
    emailAndPassword: { enabled: true },
    account: {
      accountLinking: {
        allowDifferentEmails: true,
        trustedProviders: ["google"],
        updateUserInfoOnLink: true,
      },
      encryptOAuthTokens: true,
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
      ...(env.TRUSTED_ORIGINS || "http://localhost:5173")
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
              authLogger.error({ err: error }, 'failed to fetch google account email');
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
              authLogger.error({ err: error }, 'failed to refresh google account profile');
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
