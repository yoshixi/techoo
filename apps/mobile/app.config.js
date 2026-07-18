// Load environment variables from .env.local
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
      // API URL from environment variable, defaults to localhost
      apiUrl: localEnv.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8787',
      apiDebug: envFlag(localEnv.DEBUG, process.env.DEBUG),
    },
  };
};
