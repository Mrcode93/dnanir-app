const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Expo config plugin: copies custom Android launcher icons from
 * assets/icons/android/res to the native Android project during prebuild.
 * This makes EAS Build and local builds use your icons in assets/icons/android.
 */
function withAndroidIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const sourceRes = path.join(projectRoot, 'assets', 'icons', 'android', 'res');
      const targetRes = path.join(platformRoot, 'app', 'src', 'main', 'res');

      if (!fs.existsSync(sourceRes)) {
        console.warn('[withAndroidIcons] Source not found:', sourceRes);
        return config;
      }

      if (!fs.existsSync(targetRes)) {
        console.warn('[withAndroidIcons] Android res not found (run prebuild first):', targetRes);
        return config;
      }

      const dirs = fs.readdirSync(sourceRes, { withFileTypes: true });
      for (const dirent of dirs) {
        if (!dirent.isDirectory()) continue;
        const name = dirent.name;
        if (!name.startsWith('mipmap')) continue;
        const src = path.join(sourceRes, name);
        const dest = path.join(targetRes, name);
        fs.cpSync(src, dest, { recursive: true });
        console.log('[withAndroidIcons] Copied', name);
      }

      // Remove Expo-generated .webp launcher files to avoid "Duplicate resources" error
      // (Expo creates .webp; we use .png from assets/icons/android)
      const targetDirs = fs.readdirSync(targetRes, { withFileTypes: true });
      for (const dirent of targetDirs) {
        if (!dirent.isDirectory() || !dirent.name.startsWith('mipmap')) continue;
        const mipmapDir = path.join(targetRes, dirent.name);
        const files = fs.readdirSync(mipmapDir);
        for (const file of files) {
          if (file.endsWith('.webp')) {
            const webpPath = path.join(mipmapDir, file);
            fs.unlinkSync(webpPath);
            console.log('[withAndroidIcons] Removed duplicate', path.join(dirent.name, file));
          }
        }
      }

      return config;
    },
  ]);
}

module.exports = withAndroidIcons;
