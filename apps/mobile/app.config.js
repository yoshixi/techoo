// Load environment variables from .env.local (local dev overrides).
// Do not use apps/mobile/.env for API URL — Expo loads it into process.env and would
// point local simulators at production. EAS builds use EXPO_PUBLIC_API_BASE_URL from eas.json.
const fs = require('fs');
const path = require('path');

// Simple .env.local parser
const loadEnvLocal = () => {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
};

const localEnv = loadEnvLocal();

function getApiBaseUrl() {
  if (localEnv.EXPO_PUBLIC_API_BASE_URL) {
    return localEnv.EXPO_PUBLIC_API_BASE_URL;
  }
  // EAS cloud builds only — not `expo start` on your machine (which also sets process.env from .env).
  if (process.env.EAS_BUILD === 'true' && process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  return 'http://localhost:8787';
}

/** DEBUG / API error details in alerts — opt-in; `pnpm run dev` sets DEBUG=true. */
function envFlag(localVal, processVal) {
  const v = localVal !== undefined && localVal !== '' ? localVal : processVal;
  if (v === undefined || v === null || v === '') return false;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      package: 'app.techoo',
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'app.techoo',
    },
    extra: {
      ...config.extra,
      // API URL: .env.local for local dev, eas.json env for EAS builds, else localhost.
      apiUrl: getApiBaseUrl(),
      apiDebug: envFlag(localEnv.DEBUG, process.env.DEBUG),
    },
  };
};
