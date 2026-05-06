const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// React Native 0.81+ `package.json` `exports` plus Metro's existence checks
// produces "invalid package.json configuration" warnings and can break
// resolution for deep `Libraries/*` paths. Legacy resolution matches RN CLI.
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
