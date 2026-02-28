/**
 * Expo Config Plugin — Android Home Screen Widget
 *
 * On every `expo prebuild` (including EAS cloud builds):
 *   1. Injects AQIWidgetProvider <receiver> into AndroidManifest.xml
 *   2. Registers WidgetDataPackage in MainApplication.kt
 *   3. Writes all native source/resource files if they don't exist yet
 *      (EAS servers start with no android/ folder — files must be embedded here)
 */

const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ─── 1. AndroidManifest.xml ────────────────────────────────────────────────────

function addWidgetToManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];
    const receivers   = application.receiver ?? [];
    if (receivers.some((r) => r.$?.['android:name'] === '.AQIWidgetProvider')) return mod;

    application.receiver = [
      ...receivers,
      {
        $: { 'android:name': '.AQIWidgetProvider', 'android:exported': 'true', 'android:label': 'Saans AQI' },
        'intent-filter': [{
          action: [
            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            { $: { 'android:name': 'com.shubham.saans.WIDGET_REFRESH' } },
          ],
        }],
        'meta-data': [{
          $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/aqi_widget_info' },
        }],
      },
    ];
    return mod;
  });
}

// ─── 2. MainApplication.kt ────────────────────────────────────────────────────

function addWidgetPackage(config) {
  return withMainApplication(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes('WidgetDataPackage')) return mod;

    src = src.replace(
      'import com.facebook.react.ReactPackage',
      'import com.facebook.react.ReactPackage\nimport com.shubham.saans.WidgetDataPackage',
    );
    src = src.replace(
      '// Packages that cannot be autolinked yet can be added manually here, for example:',
      '// Packages that cannot be autolinked yet can be added manually here, for example:\n              add(WidgetDataPackage())',
    );
    mod.modResults.contents = src;
    return mod;
  });
}

// ─── 3. Native files ──────────────────────────────────────────────────────────

function writeNativeFiles(config) {
  return withDangerousMod(config, ['android', (mod) => {
    const root  = mod.modRequest.platformProjectRoot;
    const ktDir = path.join(root, 'app/src/main/java/com/shubham/saans');

    [
      path.join(root, 'app/src/main/res/xml'),
      path.join(root, 'app/src/main/res/layout'),
      path.join(root, 'app/src/main/res/drawable'),
      ktDir,
    ].forEach((d) => fs.mkdirSync(d, { recursive: true }));

    // Always overwrite config XMLs (they have no user-editable content)
    fs.writeFileSync(path.join(root, 'app/src/main/res/xml/aqi_widget_info.xml'),
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
    android:description="Saans AQI Widget" />\n`);

    fs.writeFileSync(path.join(root, 'app/src/main/res/drawable/widget_background.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFFFF" />
    <corners android:radius="16dp" />
</shape>\n`);

    // Write layout + Kotlin only when missing (preserve local edits)
    writeIfMissing(path.join(root, 'app/src/main/res/layout/aqi_widget.xml'), LAYOUT_XML);
    writeIfMissing(path.join(ktDir, 'AQIWidgetProvider.kt'), PROVIDER_KT);
    writeIfMissing(path.join(ktDir, 'WidgetDataModule.kt'),  MODULE_KT);
    writeIfMissing(path.join(ktDir, 'WidgetDataPackage.kt'), PACKAGE_KT);

    return mod;
  }]);
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content);
}

// ─── Embedded file contents ───────────────────────────────────────────────────

const LAYOUT_XML =
`<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:padding="14dp"
    android:background="@drawable/widget_background"
    android:gravity="center_vertical">

    <LinearLayout
        android:id="@+id/widget_aqi_badge"
        android:layout_width="72dp"
        android:layout_height="72dp"
        android:orientation="vertical"
        android:gravity="center"
        android:background="#FFFF7E00">

        <TextView
            android:id="@+id/widget_aqi"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="--"
            android:textSize="30sp"
            android:textStyle="bold"
            android:textColor="#FFFFFFFF" />

        <TextView
            android:id="@+id/widget_aqi_label"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="AQI"
            android:textSize="10sp"
            android:textColor="#CCFFFFFF"
            android:letterSpacing="0.1" />

    </LinearLayout>

    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:orientation="vertical"
        android:paddingLeft="14dp"
        android:gravity="center_vertical">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <TextView
                android:id="@+id/widget_status"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Loading..."
                android:textSize="15sp"
                android:textStyle="bold"
                android:textColor="#FF1A1A1A" />

            <TextView
                android:id="@+id/widget_city"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text=""
                android:textSize="12sp"
                android:textColor="#FF888888"
                android:paddingLeft="6dp"
                android:maxLines="1"
                android:ellipsize="end" />

        </LinearLayout>

        <TextView
            android:id="@+id/widget_guidance"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Open app to load"
            android:textSize="13sp"
            android:textColor="#FF555555"
            android:layout_marginTop="6dp"
            android:maxLines="2"
            android:ellipsize="end" />

        <TextView
            android:id="@+id/widget_updated"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text=""
            android:textSize="10sp"
            android:textColor="#FFBBBBBB"
            android:layout_marginTop="4dp" />

    </LinearLayout>

</LinearLayout>\n`;

const PROVIDER_KT =
`package com.shubham.saans

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AQIWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) updateWidget(context, appWidgetManager, widgetId)
        scheduleRepeatingUpdate(context)
    }

    override fun onEnabled(context: Context) { super.onEnabled(context); scheduleRepeatingUpdate(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); cancelRepeatingUpdate(context) }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, AQIWidgetProvider::class.java))
            for (id in ids) updateWidget(context, manager, id)
        }
    }

    companion object {
        private const val PREFS_NAME         = "SaansWidgetPrefs"
        private const val KEY_DATA           = "saans_widget_data"
        private const val ACTION_REFRESH     = "com.shubham.saans.WIDGET_REFRESH"
        private const val ALARM_REQUEST_CODE = 5001

        fun updateAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, AQIWidgetProvider::class.java))
            for (id in ids) updateWidget(context, manager, id)
        }

        fun saveDataAndRefresh(context: Context, jsonData: String) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(KEY_DATA, jsonData).apply()
            updateAllWidgets(context)
        }

        private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val prefs   = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val dataStr = prefs.getString(KEY_DATA, null)
            val views   = RemoteViews(context.packageName, R.layout.aqi_widget)

            if (dataStr != null) {
                try {
                    val data     = JSONObject(dataStr)
                    val aqi      = data.optInt("aqi", 0)
                    val status   = data.optString("status", "")
                    val city     = data.optString("city", "")
                    val guidance = data.optString("firstGuidanceCard", "Open app for guidance")
                    val colorHex = data.optString("color", "#FF7E00")
                    val updated  = data.optString("updatedAt", "")

                    views.setTextViewText(R.id.widget_aqi, aqi.toString())
                    views.setTextViewText(R.id.widget_status, status)
                    views.setTextViewText(R.id.widget_city, city)
                    views.setTextViewText(R.id.widget_guidance, guidance)
                    views.setTextViewText(R.id.widget_updated, formatUpdated(updated))

                    val badgeColor = try { Color.parseColor(colorHex) } catch (_: Exception) { Color.parseColor("#FF7E00") }
                    views.setInt(R.id.widget_aqi_badge, "setBackgroundColor", badgeColor)
                } catch (_: Exception) { setPlaceholder(views) }
            } else { setPlaceholder(views) }

            val tapIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val tapPending = PendingIntent.getActivity(context, 0, tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, tapPending)
            manager.updateAppWidget(widgetId, views)
        }

        private fun setPlaceholder(views: RemoteViews) {
            views.setTextViewText(R.id.widget_aqi, "--")
            views.setTextViewText(R.id.widget_status, "Open app")
            views.setTextViewText(R.id.widget_city, "")
            views.setTextViewText(R.id.widget_guidance, "Tap to load air quality data")
            views.setTextViewText(R.id.widget_updated, "")
            views.setInt(R.id.widget_aqi_badge, "setBackgroundColor", Color.parseColor("#FFAAAAAA"))
        }

        private fun formatUpdated(isoDate: String): String {
            if (isoDate.isEmpty()) return ""
            return try {
                val fmt  = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                val date = fmt.parse(isoDate.take(19).replace("Z", "")) ?: return ""
                val diffMs = Date().time - date.time
                val mins   = (diffMs / 60_000).toInt()
                when { mins < 2 -> "Just updated"; mins < 60 -> "Updated \${mins}m ago"; else -> "Updated \${mins / 60}h ago" }
            } catch (_: Exception) { "" }
        }

        private fun scheduleRepeatingUpdate(context: Context) {
            val alarm   = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent  = Intent(context, AQIWidgetProvider::class.java).apply { action = ACTION_REFRESH }
            val pending = PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            alarm.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 30 * 60_000L, 30 * 60_000L, pending)
        }

        private fun cancelRepeatingUpdate(context: Context) {
            val alarm   = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent  = Intent(context, AQIWidgetProvider::class.java).apply { action = ACTION_REFRESH }
            val pending = PendingIntent.getBroadcast(context, ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            alarm.cancel(pending)
        }
    }
}\n`;

const MODULE_KT =
`package com.shubham.saans

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetDataModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetData"

    @ReactMethod
    fun setWidgetData(jsonData: String) {
        AQIWidgetProvider.saveDataAndRefresh(reactContext, jsonData)
    }
}\n`;

const PACKAGE_KT =
`package com.shubham.saans

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetDataPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(WidgetDataModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}\n`;

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = function withAndroidWidget(config) {
  config = addWidgetToManifest(config);
  config = addWidgetPackage(config);
  config = writeNativeFiles(config);
  return config;
};
