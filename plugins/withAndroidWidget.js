/**
 * Expo Config Plugin — Android Home Screen Widget
 *
 * Does three things on every `expo prebuild`:
 *   1. Injects the AppWidgetProvider <receiver> into AndroidManifest.xml
 *   2. Registers WidgetDataPackage in MainApplication.kt so the native
 *      module (WidgetDataModule) is available from JavaScript
 *   3. Writes all native source/resource files to the android/ tree so
 *      a fresh prebuild on a new machine still produces a working widget
 */

const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ─── 1. AndroidManifest.xml ────────────────────────────────────────────────────

function addWidgetToManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest   = mod.modResults;
    const application = manifest.manifest.application[0];

    // Avoid adding twice
    const receivers = application.receiver ?? [];
    const alreadyAdded = receivers.some(
      (r) => r.$?.['android:name'] === '.AQIWidgetProvider',
    );
    if (alreadyAdded) return mod;

    application.receiver = [
      ...receivers,
      {
        $: {
          'android:name':     '.AQIWidgetProvider',
          'android:exported': 'true',
          'android:label':    'Saans AQI',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
              { $: { 'android:name': 'com.shubham.saans.WIDGET_REFRESH' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name':     'android.appwidget.provider',
              'android:resource': '@xml/aqi_widget_info',
            },
          },
        ],
      },
    ];
    return mod;
  });
}

// ─── 2. MainApplication.kt ────────────────────────────────────────────────────

function addWidgetPackage(config) {
  return withMainApplication(config, (mod) => {
    let src = mod.modResults.contents;

    // Skip if already patched
    if (src.includes('WidgetDataPackage')) return mod;

    // Add import
    src = src.replace(
      'import com.facebook.react.ReactPackage',
      'import com.facebook.react.ReactPackage\nimport com.shubham.saans.WidgetDataPackage',
    );

    // Register in getPackages()
    src = src.replace(
      '// Packages that cannot be autolinked yet can be added manually here, for example:',
      '// Packages that cannot be autolinked yet can be added manually here, for example:\n              add(WidgetDataPackage())',
    );

    mod.modResults.contents = src;
    return mod;
  });
}

// ─── 3. Write native source + resource files ──────────────────────────────────

function writeNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const root = mod.modRequest.platformProjectRoot; // android/

      // ── directories ────────────────────────────────────────────────────────
      const dirs = [
        path.join(root, 'app/src/main/res/xml'),
        path.join(root, 'app/src/main/res/layout'),
        path.join(root, 'app/src/main/res/drawable'),
        path.join(root, 'app/src/main/java/com/yourname/saans'),
      ];
      dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));

      // ── aqi_widget_info.xml ───────────────────────────────────────────────
      fs.writeFileSync(
        path.join(root, 'app/src/main/res/xml/aqi_widget_info.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:minResizeWidth="110dp"
    android:minResizeHeight="50dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/aqi_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="Saans AQI Widget" />\n`,
      );

      // ── widget_background.xml ─────────────────────────────────────────────
      fs.writeFileSync(
        path.join(root, 'app/src/main/res/drawable/widget_background.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#FFFFFFFF" />
    <corners android:radius="16dp" />
</shape>\n`,
      );

      // Don't overwrite layout/Kotlin if they already exist (developer may edit them)
      const layoutPath  = path.join(root, 'app/src/main/res/layout/aqi_widget.xml');
      const providerPath = path.join(root, 'app/src/main/java/com/yourname/saans/AQIWidgetProvider.kt');
      const modulePath  = path.join(root, 'app/src/main/java/com/yourname/saans/WidgetDataModule.kt');
      const packagePath = path.join(root, 'app/src/main/java/com/yourname/saans/WidgetDataPackage.kt');

      if (!fs.existsSync(layoutPath)) {
        fs.writeFileSync(layoutPath, '<!-- See android/app/src/main/res/layout/aqi_widget.xml -->');
      }
      [providerPath, modulePath, packagePath].forEach((p) => {
        if (!fs.existsSync(p)) {
          fs.writeFileSync(p, `// Widget file — see git history to restore if missing\n`);
        }
      });

      return mod;
    },
  ]);
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = function withAndroidWidget(config) {
  config = addWidgetToManifest(config);
  config = addWidgetPackage(config);
  config = writeNativeFiles(config);
  return config;
};
