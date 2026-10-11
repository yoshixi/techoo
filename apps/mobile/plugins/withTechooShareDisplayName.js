const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('@expo/config-plugins');

const DISPLAY_NAME = 'techoo';

/**
 * The share extension target stays `ShareExtension` so it does not collide with the app target.
 * The share sheet label is the product name, matching Android.
 */
function withTechooShareDisplayName(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const plistPath = path.join(
        config.modRequest.platformProjectRoot,
        'ShareExtension',
        'ShareExtension-Info.plist'
      );
      if (!fs.existsSync(plistPath)) return config;

      const contents = fs.readFileSync(plistPath, 'utf8');
      const next = contents.replace(
        /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${DISPLAY_NAME}$2`
      );
      if (next !== contents) {
        fs.writeFileSync(plistPath, next);
      }
      return config;
    },
  ]);
}

module.exports = withTechooShareDisplayName;
