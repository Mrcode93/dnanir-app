const { withDangerousMod, withAndroidManifest, withEntitlementsPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add Home Screen Widgets to Dnanir.
 */
function withWidget(config) {
  // 1. Android Configuration
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    // Add Receiver for Widget
    const receiver = {
      $: {
        'android:name': '.DnanirWidget',
        'android:exported': 'false',
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

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const targetResPath = path.join(platformRoot, 'app/src/main/res');
      const pluginResPath = path.join(projectRoot, 'plugins/widgets/android/res');

      if (fs.existsSync(pluginResPath)) {
        ['layout', 'xml'].forEach((dir) => {
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

      // Copy Kotlin class
      const packageName = config.android?.package || 'com.mrcodeiq.dinar';
      const packagePath = packageName.replace(/\./g, '/');
      const kotlinTargetDir = path.join(platformRoot, `app/src/main/java/${packagePath}`);
      const kotlinSrc = path.join(projectRoot, 'plugins/widgets/android/DnanirWidget.kt');
      
      if (fs.existsSync(kotlinSrc)) {
        if (!fs.existsSync(kotlinTargetDir)) fs.mkdirSync(kotlinTargetDir, { recursive: true });
        fs.copyFileSync(kotlinSrc, path.join(kotlinTargetDir, 'DnanirWidget.kt'));
      }

      return config;
    },
  ]);

  // 2. iOS Configuration: Add App Groups Entitlement
  config = withEntitlementsPlist(config, (config) => {
    const appGroup = config.ios?.appGroups?.[0] || `group.${config.ios?.bundleIdentifier || 'com.mrcodeiq.dinar'}`;
    config.modResults['com.apple.security.application-groups'] = [appGroup];
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;
      
      // Target directory for the Swift file
      const iosTargetDir = path.join(platformRoot, projectName);
      const swiftSrc = path.join(projectRoot, 'plugins/widgets/ios/DnanirWidget.swift');
      
      if (!fs.existsSync(iosTargetDir)) fs.mkdirSync(iosTargetDir, { recursive: true });
      fs.copyFileSync(swiftSrc, path.join(iosTargetDir, 'DnanirWidget.swift'));
      
      console.log('[withWidget] Copied DnanirWidget.swift to', iosTargetDir);
      return config;
    },
  ]);

  return config;
}

module.exports = withWidget;
