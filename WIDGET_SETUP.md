# Widget Setup Guide

This guide explains how to set up and use the home screen widgets for دنانير (Dnanir) app.

## Widget Features

The app includes three types of widgets:

1. **Quick Balance Widget** - Shows current balance, total income, and total expenses
2. **Monthly Summary Widget** - Shows monthly income, expenses, transaction counts, and balance
3. **Quick Add Widget** - Quick access to add expenses or income using shortcuts

## iOS Setup

### 1. Add App Group

1. Open the project in Xcode
2. Select the main app target
3. Go to "Signing & Capabilities"
4. Click "+ Capability" and add "App Groups"
5. Create a new group: `group.com.mrcodeiq.dinar`
6. Repeat for the widget extension target

### 2. Create Widget Extension

1. In Xcode, go to File > New > Target
2. Select "Widget Extension"
3. Name it "DnanyrWidget"
4. Make sure "Include Configuration Intent" is checked for Quick Add widget
5. Copy the widget Swift files to the extension:
   - `DnanyrWidget.swift`
   - `MonthlySummaryWidget.swift`
   - `QuickAddWidget.swift`

### 3. Configure Widget Extension

1. Set the deployment target to iOS 14.0 or later
2. Add the widget files to the extension target
3. Ensure the extension has access to the App Group

### 4. Build and Run

1. Build the project
2. Run the app on a device or simulator
3. Long press on the home screen
4. Tap the "+" button
5. Search for "دنانير" and add widgets

## Android Setup

### 1. Update AndroidManifest.xml

Add the widget receivers inside the `<application>` tag:

```xml
<receiver android:name=".BalanceWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/balance_widget_info" />
</receiver>

<receiver android:name=".MonthlySummaryWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/monthly_summary_widget_info" />
</receiver>

<receiver android:name=".QuickAddWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/quick_add_widget_info" />
</receiver>
```

### 2. Register Native Module

In `MainApplication.java` or `MainApplication.kt`, register the WidgetModule:

```java
@Override
protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
        // ... other packages
        new ReactPackage() {
            @Override
            public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
                return Arrays.<NativeModule>asList(
                    new WidgetModule(reactContext)
                );
            }
            // ... ViewManagers
        }
    );
}
```

### 3. Build and Install

1. Build the Android app
2. Install on a device
3. Long press on the home screen
4. Select "Widgets"
5. Find "دنانير" and add widgets

## Data Sharing

Widgets access data through:
- **iOS**: App Groups (UserDefaults with suite name `group.com.mrcodeiq.dinar`)
- **Android**: SharedPreferences (key: `widget_data`)

The app automatically updates widget data when:
- Expenses are added, updated, or deleted
- Income is added, updated, or deleted
- App starts or comes to foreground

## Widget Update Frequency

- Widgets update automatically when data changes in the app
- iOS widgets can also update on a schedule (system managed)
- Android widgets update every 30 minutes by default (configurable)

## Troubleshooting

### iOS Widgets Not Showing

1. Ensure App Groups are configured for both app and extension
2. Check that widget extension is included in the build
3. Verify widget files are added to the extension target

### Android Widgets Not Updating

1. Check that WidgetModule is registered in MainApplication
2. Verify AndroidManifest.xml includes widget receivers
3. Ensure SharedPreferences are being written correctly

### Data Not Appearing

1. Make sure the app has run at least once to initialize data
2. Check that `initializeWidgetData()` is called in App.tsx
3. Verify native modules are properly linked

## Notes

- Widgets require iOS 14+ or Android 5.0+
- Widget data is stored locally and synced automatically
- Quick Add widget requires shortcuts to be set up in the app first
