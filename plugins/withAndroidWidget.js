const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add Android Home Screen Widgets.
 */
function withAndroidWidget(config) {
  // 1. Android Manifest Configuration
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    const receiver = {
      $: {
        'android:name': '.DnanirWidget',
        'android:exported': 'true',
        'android:label': 'دنانير - اختصارات',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/widget_info',
          },
        },
      ],
    };

    if (!mainApplication.receiver) mainApplication.receiver = [];
    const exists = mainApplication.receiver.some(r => r.$['android:name'] === '.DnanirWidget');
    if (!exists) mainApplication.receiver.push(receiver);

    return config;
  });

  // 2. Resource Copying
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const targetResPath = path.join(platformRoot, 'app/src/main/res');
      const pluginResPath = path.join(projectRoot, 'plugins/widgets/android/res');

      if (fs.existsSync(pluginResPath)) {
        ['layout', 'xml', 'drawable'].forEach((dir) => {
          const src = path.join(pluginResPath, dir);
          const dest = path.join(targetResPath, dir);
          if (fs.existsSync(src)) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach((file) => {
              fs.copyFileSync(path.join(src, file), path.join(dest, file));
            });
          }
        });
      }

      const packageName = config.android?.package || 'com.mrcodeiq.dinar';
      const packagePath = packageName.replace(/\./g, '/');
      const kotlinTargetDir = path.join(platformRoot, `app/src/main/java/${packagePath}`);
      const kotlinSrc = path.join(projectRoot, 'plugins/widgets/android/DnanirWidget.kt');
      
      if (fs.existsSync(kotlinSrc)) {
        if (!fs.existsSync(kotlinTargetDir)) fs.mkdirSync(kotlinTargetDir, { recursive: true });
        const content = fs.readFileSync(kotlinSrc, 'utf8');
        // Ensure package name is correct in the Kotlin file
        const finalContent = content.startsWith('package') 
          ? content.replace(/package .*/, `package ${packageName}`)
          : `package ${packageName}\n\n${content}`;
        fs.writeFileSync(path.join(kotlinTargetDir, 'DnanirWidget.kt'), finalContent);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidWidget;
