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

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      // API URL from environment variable, defaults to localhost
      apiUrl: localEnv.API_URL || process.env.API_URL || 'http://localhost:8787',
    },
  };
};
